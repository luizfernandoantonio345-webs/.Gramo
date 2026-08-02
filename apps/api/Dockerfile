# =============================================================================
# API REP-P - build multi-stage. Contexto de build = raiz do monorepo.
# =============================================================================
FROM node:22-alpine AS build
WORKDIR /repo

# Manifests primeiro (cache de layer de dependencias).
COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm install

# Codigo e build (shared -> prisma client -> api).
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @repp/shared \
  && npm run prisma:generate -w @repp/api \
  && npm run build -w @repp/api

# ---- Runtime enxuto ----
FROM node:22-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
# psql e usado por `db:rls` para aplicar as policies de RLS.
RUN apk add --no-cache postgresql-client
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages/shared/dist ./packages/shared/dist
COPY --from=build /repo/packages/shared/package.json ./packages/shared/
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/package.json ./apps/api/
COPY --from=build /repo/apps/api/prisma ./apps/api/prisma
WORKDIR /repo/apps/api
EXPOSE 3000
# Aplica migrations + RLS e sobe a API.
CMD ["sh", "-c", "npm run db:setup && node dist/main.js"]
