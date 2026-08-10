# =============================================================================
# PWA REP-P - build (Vite) + serve estatico (Nginx). Contexto = raiz do monorepo.
# =============================================================================
FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN npm install
COPY packages/shared packages/shared
COPY apps/web apps/web
# URL da API embutida no build (mesma origem por padrao; Nginx faz o proxy /api).
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
# Compila o pacote interno @repp/shared ANTES (gera dist/*.d.ts que o tsc do web
# resolve). Sem isto, o `tsc -b` do web falha com TS2307 (Cannot find module
# '@repp/shared'), pois packages/shared/dist nao e versionado.
RUN npm run build -w @repp/shared && npm run build -w @repp/web

# ---- Runtime: Nginx servindo o PWA + proxy para a API ----
FROM nginx:alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
