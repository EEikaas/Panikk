# ── Bygg ───────────────────────────────────────────────
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/game-engine/package.json packages/game-engine/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run db:generate && npm run build && npm prune --omit=dev --no-audit --no-fund

# ── Kjør ───────────────────────────────────────────────
FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production PORT=3001
RUN apt-get update && apt-get install -y --no-install-recommends openssl tini && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/apps/server/package.json apps/server/
COPY --from=build /app/apps/server/dist apps/server/dist
COPY --from=build /app/apps/server/prisma apps/server/prisma
COPY --from=build /app/apps/web/dist apps/web/dist
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://localhost:3001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--"]
# Databasemigrasjoner kjøres automatisk ved oppstart når DATABASE_URL er satt.
CMD ["sh", "-c", "if [ -n \"$DATABASE_URL\" ]; then node node_modules/prisma/build/index.js migrate deploy --schema apps/server/prisma/schema.prisma; fi && node apps/server/dist/index.js"]
