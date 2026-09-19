FROM node:24-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/web/package*.json ./apps/web/
RUN npm ci && npm ci --prefix apps/api && npm ci --prefix apps/web

COPY . .
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app/apps/api
ENV NODE_ENV=production

COPY --from=builder /app/apps/api/package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/public ./public

EXPOSE 3000
CMD ["node", "dist/main.js"]
