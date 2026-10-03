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
  /data/keys \
  /data/state
# One self-signed cert so Follow me can run on the boat LAN (#188).
# Browsers only share device location on HTTPS. Kept under the state volume
# so a rebuild does not mint a new cert and break the warning the user already accepted.
TLS_DIR="${SISU_NAV_TLS_DIR:-/data/state/tls}"
mkdir -p "$TLS_DIR"
if [ ! -s "$TLS_DIR/cert.pem" ] || [ ! -s "$TLS_DIR/key.pem" ]; then
  openssl req -x509 -newkey rsa:2048 -sha256 -days 825 -nodes \
    -keyout "$TLS_DIR/key.pem" -out "$TLS_DIR/cert.pem" \
    -subj "/CN=sisu-nav" \
    -addext "subjectAltName=${SISU_NAV_TLS_SAN:-IP:192.168.0.21,IP:127.0.0.1,DNS:localhost}"
fi
chmod -R a+rwX "$TILES" /data/keys /data/state 2>/dev/null || true
# TOS bind mounts often reject chown. A 640 key owned by root makes node
# throw on read, and that takes the HTTP server down with the TLS listen.
if id node >/dev/null 2>&1 && chown -R node:node "$TLS_DIR" 2>/dev/null; then
  chmod 750 "$TLS_DIR" 2>/dev/null || true
  chmod 644 "$TLS_DIR/cert.pem" 2>/dev/null || true
  chmod 640 "$TLS_DIR/key.pem" 2>/dev/null || true
else
  chmod 755 "$TLS_DIR" 2>/dev/null || true
  chmod 644 "$TLS_DIR/cert.pem" "$TLS_DIR/key.pem" 2>/dev/null || true
fi
if [ "$(id -u)" = 0 ] && command -v su-exec >/dev/null 2>&1; then
  exec su-exec node "$@"
fi
exec "$@"
