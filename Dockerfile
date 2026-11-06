FROM node:22-bookworm-slim AS base

WORKDIR /app
RUN apt-get update \
    && apt-get install --no-install-recommends -y openssl \
    && rm -rf /var/lib/apt/lists/*

FROM base AS dependencies
COPY package.json package-lock.json ./
ENV PUPPETEER_SKIP_DOWNLOAD=true
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
RUN apt-get update \
    && apt-get install --no-install-recommends -y openssl chromium \
    && rm -rf /var/lib/apt/lists/*

ARG PRISMA_VERSION=5.18.0
ENV NODE_ENV=production
RUN npm install --global "prisma@${PRISMA_VERSION}" \
    && npm cache clean --force

WORKDIR /app

ENV HOSTNAME=0.0.0.0 \
    PORT=3000 \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --create-home --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --chown=nextjs:nodejs entrypoint.sh ./entrypoint.sh

RUN chmod 755 /app/entrypoint.sh

RUN mkdir -p /app/public/uploads \
    && chown -R nextjs:nodejs /app/public/uploads

USER nextjs
EXPOSE 3000

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "server.js"]