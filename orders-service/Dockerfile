FROM node:24-alpine
WORKDIR /app

# Factor II: versiones fijadas en package-lock.json e instaladas al construir
COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY sql ./sql
COPY scripts ./scripts

# Factor VII: puerto explícito
EXPOSE 8002
CMD ["npm", "start"]
