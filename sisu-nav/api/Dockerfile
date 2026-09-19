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
ENV SISU_POLAR_DIR=/app/polar
ENV NODE_ENV=production
ENV SISU_TILES_DIR=/data/tiles
ENV SISU_NAV_PORT=8088
EXPOSE 8088
USER node
# --experimental-sqlite: node:sqlite (api/harvest/mbtiles.mjs) is still flagged on Node 22.
CMD ["node", "--experimental-sqlite", "server.mjs"]
