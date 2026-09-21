FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
# logo + Bengali font used by the PDF report — not part of dist/
COPY --from=build /app/assets ./assets
EXPOSE 4000
CMD ["node", "dist/server.js"]
