# TiendaNube – Microservicios Cloud Native con Docker Desktop

**TiendaNube** es una tienda en línea mínima: se registran **productos** (catálogo e inventario),
**clientes** y **pedidos**. Al crear un pedido se valida y descuenta el stock automáticamente.

## Arquitectura

```
                         USUARIO
                            |
                            v
              FRONTEND (React + Nginx)  :8088
                            |   Firebase Authentication -> ID token (JWT)
                            |   Authorization: Bearer <token>
                            v
                API GATEWAY (Node.js)  :8080
           valida firma, emisor, audiencia y vigencia
          /                 |                    \
         v                  v                     v
 PRODUCTS-SERVICE     ORDERS-SERVICE        CUSTOMERS-SERVICE
  :8001 (Python)  <--  :8002 (Node.js)       :8003 (Node.js)
        |          REST       |                     |
        v                     v                     v
  MongoDB Atlas      Oracle Autonomous DB     MongoDB Atlas
 (tienda_productos)       (tabla ORDERS)     (tienda_clientes)
```

- Cada componente corre en **su propio contenedor** y cada microservicio tiene **su propia base**.
- **Comunicación entre microservicios:** al crear un pedido, `orders-service` llama por REST a
  `products-service` para validar el producto y descontar el stock (si no alcanza, **409**).
- **Independencia:** si un microservicio se cae, el gateway responde **502** solo en sus rutas y
  los demás siguen funcionando. El frontend muestra el estado de cada uno.

## Responsabilidades del equipo

| Estudiante | Componente | Carpeta | Tecnología | Base de datos | Imagen Docker Hub |
|---|---|---|---|---|---|
| Estudiante 1 | Microservicio de productos | `products-service/` | Python + FastAPI | MongoDB Atlas | `USUARIO/tienda-products-service:1.0` |
| Estudiante 2 | Microservicio de pedidos | `orders-service/` | Node.js + Express | Oracle Autonomous DB | `USUARIO/tienda-orders-service:1.0` |
| Estudiante 3 | Microservicio de clientes | `customers-service/` | Node.js + Express | MongoDB Atlas | `USUARIO/tienda-customers-service:1.0` |
| Estudiante 4 | Frontend + API Gateway | `frontend/`, `api-gateway/` | React + Nginx / Node.js | — (Firebase Auth) | `USUARIO/tienda-frontend:1.0`, `USUARIO/tienda-api-gateway:1.0` |

## Endpoints (por el gateway, puerto 8080)

| Método | Ruta | Servicio | Descripción |
|---|---|---|---|
| GET | `/health` | gateway | Salud del gateway (público) |
| GET | `/health/services` | gateway | Estado `up`/`down` de cada microservicio (público) |
| GET / POST | `/api/products` | products | Listar / crear `{name, category, price, stock}` |
| GET | `/api/products/{id}` | products | Consultar un producto |
| POST | `/api/products/{id}/reserve` | products | Descontar stock `{quantity}` (lo usa orders) |
| POST | `/api/products/{id}/release` | products | Devolver stock si el pedido falla en Oracle (compensación) |
| GET / POST | `/api/orders` | orders | Listar / crear `{product_id, quantity, customer_name}` |
| PATCH | `/api/orders/{id}/status` | orders | `pendiente`, `enviado`, `entregado`, `cancelado` |
| GET / POST | `/api/customers` | customers | Listar / crear `{name, email, phone, city}` |
| GET | `/api/customers/{id}` | customers | Consultar un cliente |

Las rutas `/api/*` exigen `Authorization: Bearer <ID token de Firebase>`; sin token: **401**.

## Preparar Oracle (una sola vez para todo el grupo)

**Oracle Autonomous Database:** usuario de aplicación y cadena de conexión **TLS** (puerto 1521,
   *Database connection → TLS*). La ACL debe permitir su IP. Crear el usuario como ADMIN
   (la contraseña **no** puede contener el nombre del usuario):
   ```sql
   CREATE USER TIENDA IDENTIFIED BY "UnaClaveSegura2026";
   GRANT CREATE SESSION, CREATE TABLE, CREATE SEQUENCE TO TIENDA;
   ALTER USER TIENDA QUOTA UNLIMITED ON DATA;
   ```

## Configuración (`.env`)

Cada componente tiene su `.env.example` (sin secretos). Se copia como `.env` y se completa.
Los `.env` **no se suben a GitHub** (están en `.gitignore`). Los valores se comparten en el grupo
por un canal privado: **todos usan el mismo Firebase, Atlas y Oracle**.

```powershell
copy .env.example .env
copy products-service\.env.example  products-service\.env
copy orders-service\.env.example    orders-service\.env
copy customers-service\.env.example customers-service\.env
copy api-gateway\.env.example       api-gateway\.env
copy frontend\.env.example          frontend\.env
```

## 1. Construir y publicar MI imagen (cada estudiante)

```powershell
docker login
docker build -t MIUSUARIO/tienda-products-service:1.0 ./products-service
docker push MIUSUARIO/tienda-products-service:1.0
```

(Cambiar la carpeta y el nombre según el componente; el estudiante 4 publica dos imágenes.)

## 2. Descargar las imágenes de los compañeros y ejecutar todo

En el `.env` de la raíz, poner las imágenes de cada compañero (`PRODUCTS_IMAGE`, `ORDERS_IMAGE`,
`CUSTOMERS_IMAGE`, `GATEWAY_IMAGE`, `FRONTEND_IMAGE`) y ejecutar:

```powershell
docker compose pull                    # descarga las imágenes de Docker Hub
docker compose up -d --no-build        # ejecuta sin reconstruir
docker compose ps
```

Primera vez (procesos administrativos, factor XII):

```powershell
docker compose run --rm orders-service npm run migrate        # crea la tabla ORDERS en Oracle
docker compose run --rm products-service python -m app.seed   # productos de ejemplo (opcional)
```

Abrir **http://localhost:8088** e iniciar sesión con el usuario de Firebase.

## 3. Pruebas

```powershell
curl.exe -i http://localhost:8080/health             # 200
curl.exe -i http://localhost:8080/api/products       # 401 (sin token = no autorizado)
curl.exe -s http://localhost:8080/health/services    # estado de los microservicios
```

En `tests/tienda.http` (extensión REST Client) están todas las pruebas. Para obtener un token:

```powershell
$body = @{ email="usuario@prueba.com"; password="CLAVE"; returnSecureToken=$true } | ConvertTo-Json
(Invoke-RestMethod -Method Post -ContentType "application/json" -Body $body `
  -Uri "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=TU_API_KEY").idToken
```

## 4. Prueba de fallas (apagar y recuperar un microservicio)

```powershell
docker compose stop customers-service      # apagar un microservicio
curl.exe -s http://localhost:8080/health/services
# {"products":"up","orders":"up","customers":"down"}
# En la web: Productos y Pedidos siguen funcionando; Clientes muestra "no está disponible" (502)

docker compose start customers-service     # reiniciarlo
# A los segundos vuelve a "up" y sus datos siguen ahí (están en Atlas, no en el contenedor)
```

También se puede hacer desde Docker Desktop con los botones **Stop** y **Start** del contenedor.
Si se apaga `products-service`, se pueden seguir viendo pedidos y clientes, pero no crear pedidos
(dependen del stock): el gateway responde con un mensaje claro en vez de caerse todo.

**Logs:** `docker compose logs -f api-gateway` (o el nombre de cualquier servicio).

## Aplicación de los doce factores

| Factor | Cómo se aplica |
|---|---|
| I. Codebase | Un repositorio GitHub con una carpeta por componente |
| II. Dependencies | `requirements.txt` con versiones fijas; `package.json` + `package-lock.json`; se instalan en el `Dockerfile` (`pip install`, `npm ci`) |
| III. Config | Credenciales, URLs y puertos en `.env` por servicio; `.env.example` sin secretos; el frontend recibe su config al iniciar (`runtime-config.js`) |
| IV. Backing services | MongoDB Atlas, Oracle ADB y Firebase son externos y se cambian solo con variables |
| V. Build, release, run | `docker build`/`push` (imagen) → `.env` (configuración) → `docker compose up` (ejecución) |
| VI. Processes | Servicios sin estado; los datos de negocio viven en las bases externas |
| VII. Port binding | Cada servicio expone su puerto: 80, 8080, 8001, 8002, 8003 |
| VIII. Concurrency | Servicios independientes, escalables por separado (el stock se descuenta de forma atómica) |
| IX. Disposability | Se pueden detener y reiniciar sin perder datos (`restart: unless-stopped`) |
| X. Dev/prod parity | Las mismas imágenes funcionan en cualquier Docker Desktop (y luego en OCI) cambiando solo `.env` |
| XI. Logs | Cada servicio escribe en stdout: `docker compose logs` |
| XII. Admin processes | `npm run migrate` (tabla Oracle) y `python -m app.seed` (datos de ejemplo) |
