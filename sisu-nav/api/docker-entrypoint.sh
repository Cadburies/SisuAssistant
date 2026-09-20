#!/bin/sh
# Harvest writes dated dirs under /data/tiles. On TOS bind-mounts that tree
# often appears as root:root 755, so USER node (uid 1000) gets EACCES on mkdir
# (#137). Ensure write paths exist and are world-writable, then drop to node.
set -e
TILES="${SISU_TILES_DIR:-/data/tiles}"
mkdir -p \
  "$TILES/bathymetry" \
  "$TILES/satellite" \
  "$TILES/nautical" \
  "$TILES/manual" \
  "$TILES/inbox" \
  /data/keys
chmod -R a+rwX "$TILES" /data/keys 2>/dev/null || true
if [ "$(id -u)" = 0 ] && command -v su-exec >/dev/null 2>&1; then
  exec su-exec node "$@"
fi
exec "$@"
