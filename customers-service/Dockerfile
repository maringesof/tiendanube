FROM node:24-alpine
WORKDIR /app

# Factor II: dependencias del lockfile instaladas al construir
COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

# Factor VII: puerto explícito
EXPOSE 8003
CMD ["npm", "start"]
