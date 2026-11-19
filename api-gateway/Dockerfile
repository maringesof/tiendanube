FROM node:24-alpine
WORKDIR /app

# Factor II: dependencias del lockfile instaladas al construir
COPY package*.json ./
RUN npm ci --omit=dev

COPY server.js ./
COPY src ./src

EXPOSE 8080
CMD ["npm", "start"]
