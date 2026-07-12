FROM node:24-alpine AS deps

WORKDIR /app

COPY package.json yarn.lock ./
COPY packages/translation-core/package.json packages/translation-core/package.json
COPY apps/server/package.json apps/server/package.json

RUN yarn install --frozen-lockfile --network-timeout 100000

FROM deps AS builder

COPY packages/translation-core packages/translation-core
COPY apps/server apps/server

RUN yarn workspace @subtitle-translator/translation-core build \
  && yarn workspace @subtitle-translator/server build

FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8787

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 server

COPY package.json yarn.lock ./
COPY packages/translation-core/package.json packages/translation-core/package.json
COPY apps/server/package.json apps/server/package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/translation-core/dist packages/translation-core/dist
COPY --from=builder /app/apps/server/dist apps/server/dist

USER server

EXPOSE 8787

CMD ["yarn", "workspace", "@subtitle-translator/server", "start"]
