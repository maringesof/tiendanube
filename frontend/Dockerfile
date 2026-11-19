# Etapa 1 (build): compila React con las dependencias del lockfile (factor II y V)
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Etapa 2 (run): solo Nginx con los archivos estáticos
FROM nginx:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker-entrypoint.d/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh
# Quita posibles CRLF de Windows y da permiso de ejecución
RUN sed -i 's/\r$//' /docker-entrypoint.d/40-runtime-config.sh \
 && chmod +x /docker-entrypoint.d/40-runtime-config.sh
EXPOSE 80
