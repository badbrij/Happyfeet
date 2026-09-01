# Stage 1: Build TypeScript
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Production Runtime
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production
COPY --from=builder /app/dist ./dist
ENV PORT=5000
EXPOSE 5000
CMD ["node", "dist/index.js"]
