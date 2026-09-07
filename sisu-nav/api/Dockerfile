FROM node:22-alpine AS web
WORKDIR /src
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY api/server.mjs ./
COPY api/weather ./weather
COPY --from=web /src/dist ./public
ENV NODE_ENV=production
ENV SISU_TILES_DIR=/data/tiles
ENV SISU_NAV_PORT=8088
EXPOSE 8088
USER node
CMD ["node", "server.mjs"]
