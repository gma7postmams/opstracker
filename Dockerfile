FROM node:22-bookworm-slim AS base

WORKDIR /app
RUN apt-get update \
    && apt-get install --no-install-recommends -y openssl \
    && rm -rf /var/lib/apt/lists/*

FROM base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM dependencies AS seeder
COPY . .
RUN npx prisma generate
CMD ["sh", "-c", "npx prisma migrate deploy --schema=/app/prisma/schema.prisma && npm run db:seed"]

FROM node:22-bookworm-slim AS runner
ARG PRISMA_VERSION=5.18.0
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000

WORKDIR /app

RUN apt-get update \
    && apt-get install --no-install-recommends -y openssl \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global "prisma@${PRISMA_VERSION}" \
    && npm cache clean --force \
    && groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --chown=nextjs:nodejs --chmod=755 entrypoint.sh ./entrypoint.sh

RUN mkdir -p /app/public/uploads \
    && chown -R nextjs:nodejs /app/public/uploads

USER nextjs
EXPOSE 3000

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "server.js"]