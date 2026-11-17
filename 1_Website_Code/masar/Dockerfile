# Runs Masar as one container: builds the React app, then the API serves it.
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/
RUN npm ci --prefix server --omit=dev && npm ci --prefix client
COPY . .
RUN npm run build --prefix client

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/server ./server
COPY --from=build /app/client/dist ./client/dist
COPY package.json ./
EXPOSE 5000
CMD ["npm", "start"]
