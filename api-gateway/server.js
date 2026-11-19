// API GATEWAY: único punto de entrada del frontend.
// 1) Valida el ID token de Firebase (firma, emisor, audiencia y vigencia).
// 2) Si es válido, reenvía la petición al microservicio correspondiente
//    agregando la identidad del usuario en X-User-Id / X-User-Email.
import http from "node:http";

import { AuthenticationError, createFirebaseTokenValidator } from "./src/firebaseTokenValidator.js";

function required(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`Falta la variable obligatoria ${name}`);
  return value;
}

// Factor III: toda la configuración viene del entorno
const port = Number(process.env.PORT || 8080);
const projectId = required("FIREBASE_PROJECT_ID");
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:8088")
  .split(",").map((v) => v.trim()).filter(Boolean);

const routes = [
  { name: "products", prefix: "/api/products", origin: required("PRODUCTS_SERVICE_URL") },
  { name: "orders", prefix: "/api/orders", origin: required("ORDERS_SERVICE_URL") },
  { name: "customers", prefix: "/api/customers", origin: required("CUSTOMERS_SERVICE_URL") },
];

/** Consulta /api/health de cada microservicio (sirve para la prueba de fallas). */
async function servicesStatus() {
  const entries = await Promise.all(routes.map(async (r) => {
    try {
      const res = await fetch(`${r.origin.replace(/\/+$/, "")}/api/health`, { signal: AbortSignal.timeout(2000) });
      return [r.name, res.ok ? "up" : "down"];
    } catch {
      return [r.name, "down"];
    }
  }));
  return Object.fromEntries(entries);
}

const validateToken = createFirebaseTokenValidator({ projectId });

function cors(req) {
  const origin = allowedOrigins.includes(req.headers.origin) ? req.headers.origin : allowedOrigins[0];
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
    "access-control-allow-headers": "Authorization,Content-Type",
    vary: "Origin",
  };
}

function sendJson(req, res, status, body) {
  res.writeHead(status, { "content-type": "application/json", ...cors(req) });
  res.end(JSON.stringify(body));
}

async function proxy(req, res, route, identity) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);

  const headers = new Headers();
  headers.set("content-type", req.headers["content-type"] || "application/json");
  // El navegador nunca puede inventar su identidad: la pone el gateway.
  headers.set("X-User-Id", identity.uid);
  if (identity.email) headers.set("X-User-Email", identity.email);

  const method = req.method || "GET";
  const upstream = await fetch(`${route.origin.replace(/\/+$/, "")}${req.url}`, {
    method,
    headers,
    body: ["GET", "HEAD"].includes(method) ? undefined : Buffer.concat(chunks),
  });
  res.writeHead(upstream.status, {
    "content-type": upstream.headers.get("content-type") || "application/json",
    ...cors(req),
  });
  res.end(Buffer.from(await upstream.arrayBuffer()));
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, cors(req));
    return res.end();
  }
  if (req.url === "/health") {
    return sendJson(req, res, 200, { service: "api-gateway", status: "ok", auth: "firebase-jwt" });
  }

  if (req.url === "/health/services") {
    return sendJson(req, res, 200, await servicesStatus());
  }

  const route = routes.find(({ prefix }) =>
    req.url === prefix || req.url.startsWith(`${prefix}/`) || req.url.startsWith(`${prefix}?`));
  if (!route) return sendJson(req, res, 404, { detail: "Ruta no encontrada" });

  try {
    const identity = await validateToken(req.headers.authorization);
    console.log(`${req.method} ${req.url} -> ${route.origin} (usuario ${identity.email || identity.uid})`);
    return await proxy(req, res, route, identity);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      console.log(`401 ${req.method} ${req.url}: ${error.message}`);
      return sendJson(req, res, 401, { detail: error.message });
    }
    // Si un microservicio está apagado, solo falla su ruta; el resto sigue operando.
    console.error(`502 ${req.method} ${req.url}: ${route.name} no responde (${error.cause?.code || error.message})`);
    return sendJson(req, res, 502, { detail: `El microservicio ${route.name} no está disponible` });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`API Gateway escuchando en el puerto ${port}`);
  console.log(`Proyecto Firebase: ${projectId}`);
  routes.forEach((r) => console.log(`  ${r.prefix} -> ${r.origin}`));
});
