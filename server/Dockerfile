FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --omit=dev

EXPOSE 8080

CMD ["node", "dist/index.js"]
