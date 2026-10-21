# --- build ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Same-origin endpoints served by the bundled nginx proxy (see deploy/nginx.conf).
ENV VITE_TILER_URL="/tiler/cog/tiles/WebMercatorQuad/{z}/{x}/{y}.png?url={url}" \
    VITE_GEOCODER_URL="/geocode/search"
RUN npm run build

# --- serve ---
FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK CMD wget -qO- http://127.0.0.1/healthz || exit 1
