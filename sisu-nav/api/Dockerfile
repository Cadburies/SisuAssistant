FROM node:22-alpine AS web
WORKDIR /src
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY api/package.json api/package-lock.json ./
RUN npm ci --omit=dev
COPY api/server.mjs ./
COPY api/signalk-session.mjs ./
COPY api/weather ./weather
COPY api/harvest ./harvest
COPY api/route ./route
COPY api/roses ./roses
COPY api/ensemble ./ensemble
COPY api/ais-global ./ais-global
COPY api/hazards ./hazards
COPY api/basemaps ./basemaps
COPY api/marine ./marine
COPY api/pois ./pois
COPY api/aircraft ./aircraft
COPY api/satellites ./satellites
COPY api/settings ./settings
COPY polar ./polar
COPY api/providers.yaml ./
COPY --from=web /src/dist ./public
COPY api/docker-entrypoint.sh /entrypoint.sh
RUN chmod 755 /entrypoint.sh && apk add --no-cache su-exec openssl
ENV SISU_POLAR_DIR=/app/polar
ENV NODE_ENV=production
ENV SISU_TILES_DIR=/data/tiles
ENV SISU_NAV_PORT=8088
ENV SISU_NAV_TLS_PORT=8443
EXPOSE 8088 8443
# Start as root so the entrypoint can chmod TOS bind-mounts (often root:root
# 755 → EACCES for uid 1000), then su-exec node (#137).
# --experimental-sqlite: node:sqlite (api/harvest/mbtiles.mjs) is still flagged on Node 22.
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "--experimental-sqlite", "server.mjs"]
