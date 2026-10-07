# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS dependencies
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/admin/package.json apps/admin/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/cms-ui/package.json packages/cms-ui/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/editorial/package.json packages/editorial/package.json

RUN npm install --global npm@11.6.2 && npm ci

FROM dependencies AS source
COPY . .

FROM source AS admin-builder
RUN npm run build --workspace=@nite/admin

FROM source AS api-builder
RUN npm run build --workspace=@nite/cms-api

FROM node:22-bookworm-slim AS admin
ENV HOSTNAME=0.0.0.0 \
    NODE_ENV=production \
    PORT=3001
WORKDIR /app

COPY --from=admin-builder --chown=node:node /app/apps/admin/.next/standalone ./
COPY --from=admin-builder --chown=node:node /app/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=admin-builder --chown=node:node /app/apps/admin/public ./apps/admin/public
RUN mkdir -p /app/apps/admin/.next/cache && chown -R node:node /app/apps/admin/.next

USER node
EXPOSE 3001
CMD ["node", "apps/admin/server.js"]

FROM node:22-bookworm-slim AS api
ENV HOSTNAME=0.0.0.0 \
    NODE_ENV=production \
    PORT=3002
WORKDIR /app

COPY --from=api-builder --chown=node:node /app/apps/api/.next/standalone ./
COPY --from=api-builder --chown=node:node /app/apps/api/.next/static ./apps/api/.next/static

USER node
EXPOSE 3002
CMD ["node", "apps/api/server.js"]

FROM node:22-bookworm-slim AS scheduler
ENV NODE_ENV=production
WORKDIR /app

COPY --chown=node:node deploy/vm/outbox-scheduler.mjs ./outbox-scheduler.mjs

USER node
CMD ["node", "outbox-scheduler.mjs"]

FROM source AS migration
ENV NODE_ENV=production
WORKDIR /app

USER node
CMD ["npm", "run", "db:migrate"]
