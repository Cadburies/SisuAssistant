#!/bin/bash
# Directory-mode tileserver-gl: scan /data (including tiles/manual/) for
# .mbtiles/.pmtiles, write a generated config, SIGHUP on change so drop-in
# files appear without a container restart. Operator never maintains config.json.
set -u
if [ -e /tmp/.X99-lock ]; then rm -f /tmp/.X99-lock; fi
export DISPLAY=:99
Xvfb "${DISPLAY}" -nolisten unix >/tmp/xvfb.log 2>&1 &

DATA="${SISU_TILES_DIR:-/data}"
PORT="${TILESERVER_PORT:-8080}"
CFG=/tmp/sisu-tileserver.json
APP=/usr/src/app
pid=""

write_config() {
  mkdir -p "$DATA"
  {
    echo '{'
    echo '  "options": {'
    echo '    "paths": {'
    echo "      \"root\": \"${DATA}\","
    echo "      \"mbtiles\": \"${DATA}\","
    echo "      \"pmtiles\": \"${DATA}\""
    echo '    }'
    echo '  },'
    echo '  "data": {'
    first=1
    # Nested trees are #80; manual/ is the Phase 1 drop-in.
    while IFS= read -r -d '' f; do
      rel="${f#"${DATA}"/}"
      ext="${f##*.}"
      id=$(printf '%s' "$rel" | sed 's/\.[^.]*$//; s/[^A-Za-z0-9._-]/_/g')
      [ -n "$id" ] || continue
      if [ "$first" -eq 1 ]; then first=0; else echo ','; fi
      if [ "$ext" = "pmtiles" ] || [ "$ext" = "PMTILES" ]; then
        printf '    "%s": { "pmtiles": "%s" }' "$id" "$rel"
      else
        printf '    "%s": { "mbtiles": "%s" }' "$id" "$rel"
      fi
    done < <(find "$DATA" -type f \( -name '*.mbtiles' -o -name '*.pmtiles' \) -print0 2>/dev/null | sort -z)
    echo
    echo '  }'
    echo '}'
  } > "$CFG"
}

fingerprint() {
  find "$DATA" -type f \( -name '*.mbtiles' -o -name '*.pmtiles' \) -print 2>/dev/null | sort
}

start_server() {
  write_config
  node "$APP" --config "$CFG" --port "$PORT" --verbose --ignore-missing-files &
  pid=$!
}

stop_server() {
  if [ -n "${pid}" ] && kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
  fi
}

reload_or_restart() {
  write_config
  if [ -n "${pid}" ] && kill -0 "$pid" 2>/dev/null; then
    if kill -HUP "$pid" 2>/dev/null; then
      return
    fi
  fi
  stop_server
  start_server
}

trap 'stop_server; exit 0' TERM INT

start_server
prev="$(fingerprint)"
while true; do
  if [ -n "${pid}" ] && ! kill -0 "$pid" 2>/dev/null; then
    echo "tileserver-gl exited; restarting" >&2
    start_server
    prev="$(fingerprint)"
  fi
  sleep 3
  cur="$(fingerprint)"
  if [ "$cur" != "$prev" ]; then
    echo "tile set changed; reloading tileserver-gl" >&2
    reload_or_restart
    prev="$cur"
  fi
done
