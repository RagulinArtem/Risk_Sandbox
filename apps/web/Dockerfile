# Build context must be the repo root — see docker-compose.yml.
# VITE_API_BASE_URL is baked in at build time (Vite env vars are
# build-time, not runtime, for a static SPA) via docker-compose's build.args.
FROM node:20-slim AS build
WORKDIR /app
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci
COPY apps/web ./
ARG VITE_API_BASE_URL=http://localhost:8000
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build
# The shared host proxy does not consistently forward Accept-Encoding to the
# web container. Pre-compress immutable assets so nginx can serve them with
# Content-Encoding even across that proxy hop.
RUN find dist/assets -type f \( -name '*.js' -o -name '*.css' \) -exec gzip -9 -k {} \;

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
