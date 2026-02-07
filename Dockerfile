# --- Build stage ---
FROM node:22-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/

RUN npm ci

COPY tsconfig.json ./
COPY packages/shared/ packages/shared/
COPY packages/server/ packages/server/

RUN npm run build -w packages/shared && npm run build -w packages/server

# --- Production stage ---
FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/

RUN npm ci --omit=dev

COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/server/dist packages/server/dist

RUN mkdir -p data

EXPOSE 3000

CMD ["node", "packages/server/dist/index.js"]
