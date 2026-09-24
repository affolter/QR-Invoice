FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
# npm ci on a Darwin lockfile skips the Linux Rollup binary (npm/cli#4828).
ARG TARGETARCH
RUN npm ci \
 && case "$TARGETARCH" in \
      amd64) npm install --no-save @rollup/rollup-linux-x64-gnu ;; \
      arm64) npm install --no-save @rollup/rollup-linux-arm64-gnu ;; \
      *) echo "unsupported TARGETARCH=$TARGETARCH" >&2; exit 1 ;; \
    esac
COPY vite.config.js jsconfig.json ./
COPY web ./web
COPY src ./src
ENV VITE_BASE=/qrcode/
RUN npm run build

FROM nginx:1.27-alpine
COPY deploy/nginx-frontend.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
