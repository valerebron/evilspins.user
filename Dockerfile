# Builder
FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

# Runtime
FROM node:22-alpine AS runner

WORKDIR /app
COPY --from=builder /app/.output ./.output
COPY package*.json ./
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
