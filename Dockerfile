# Build Stage
FROM node:20-alpine AS build
WORKDIR /app

ARG VITE_API_BASE_URL
ARG VITE_ADMIN_SECRET
ARG VITE_ADMIN_EMAIL
ARG VITE_ADMIN_PASSWORD
ARG VITE_USER_EMAIL
ARG VITE_USER_PASSWORD

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_ADMIN_SECRET=$VITE_ADMIN_SECRET
ENV VITE_ADMIN_EMAIL=$VITE_ADMIN_EMAIL
ENV VITE_ADMIN_PASSWORD=$VITE_ADMIN_PASSWORD
ENV VITE_USER_EMAIL=$VITE_USER_EMAIL
ENV VITE_USER_PASSWORD=$VITE_USER_PASSWORD

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Runtime Stage
FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY --from=build /app/package-lock.json ./
RUN npm install --omit=dev

# Kopiere gebuildetes Frontend von Build Stage
COPY --from=build /app/dist ./dist

# Kopiere Server
COPY server.js .


# Declare persistent data directory
VOLUME ["/app/data"]

EXPOSE 3001

ENV NODE_ENV=production
ENV DB_TYPE=file-json

CMD ["node", "server.js"]
