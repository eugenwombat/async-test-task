FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY tsconfig.json vite.config.ts tailwind.config.js postcss.config.js index.html ./
COPY src ./src
ARG VITE_API_BASE=/api
ARG VITE_EVENTS_BASE=/events
ARG VITE_API_KEY=dev-key-1
ENV VITE_API_BASE=$VITE_API_BASE \
    VITE_EVENTS_BASE=$VITE_EVENTS_BASE \
    VITE_API_KEY=$VITE_API_KEY
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s \
  CMD wget -qO- http://localhost/ >/dev/null || exit 1
