// Microservicio de PEDIDOS: crear, consultar y actualizar el estado de pedidos.
import express from "express";

import { BusinessError, getProduct, releaseStock, reserveStock } from "./productsClient.js";

export const STATUSES = ["pendiente", "enviado", "entregado", "cancelado"];

/** Solo acepta tráfico que trae la identidad validada por el API Gateway. */
function gatewayIdentity(req, res, next) {
  const uid = String(req.get("X-User-Id") || "").trim();
  if (!uid) return res.status(401).json({ detail: "Falta la identidad validada por el gateway" });
  req.identity = { uid, email: String(req.get("X-User-Email") || "").trim() };
  return next();
}

function validateOrder(body = {}) {
  const productId = String(body.product_id || "").trim();
  const customerName = String(body.customer_name || "").trim();
  const quantity = Number(body.quantity);
  if (!productId) throw new BusinessError(400, "product_id es obligatorio");
  if (customerName.length < 2) throw new BusinessError(400, "customer_name es obligatorio");
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new BusinessError(400, "quantity debe ser un entero mayor que 0");
  }
  return { productId, customerName, quantity };
}

export function createApp({ repository, config }) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "50kb" }));

  app.get("/api/health", (req, res) => res.json({ service: "orders", status: "ok" }));
  app.use("/api", gatewayIdentity);

  app.get("/api/orders", async (req, res, next) => {
    try {
      res.json(await repository.list());
    } catch (e) {
      next(e);
    }
  });

  app.get("/api/orders/:id", async (req, res, next) => {
    try {
      const order = await repository.findById(req.params.id);
      return order ? res.json(order) : res.status(404).json({ detail: "Pedido no encontrado" });
    } catch (e) {
      return next(e);
    }
  });

  // Flujo que integra los DOS microservicios:
  // 1) consulta el producto, 2) descuenta stock, 3) guarda el pedido en Oracle.
  app.post("/api/orders", async (req, res, next) => {
    try {
      const { productId, customerName, quantity } = validateOrder(req.body);
      const product = await getProduct(config.productsServiceUrl, productId, req.identity);
      await reserveStock(config.productsServiceUrl, productId, quantity, req.identity);
      let order;
      try {
        order = await repository.create({
          productId,
          productName: product.name,
          unitPrice: product.price,
          quantity,
          total: product.price * quantity,
          customerName,
          createdBy: req.identity.uid,
        });
      } catch (dbError) {
        // Si Oracle falla, se devuelve el stock para no dejar inventario inconsistente.
        await releaseStock(config.productsServiceUrl, productId, quantity, req.identity);
        throw dbError;
      }
      console.log(`Pedido ${order.id} creado: ${product.name} x${quantity}`);
      return res.status(201).json(order);
    } catch (e) {
      return next(e);
    }
  });

  app.patch("/api/orders/:id/status", async (req, res, next) => {
    try {
      const status = String(req.body?.status || "").trim();
      if (!STATUSES.includes(status)) {
        throw new BusinessError(400, `status debe ser uno de: ${STATUSES.join(", ")}`);
      }
      const order = await repository.updateStatus(req.params.id, status);
      if (!order) return res.status(404).json({ detail: "Pedido no encontrado" });
      console.log(`Pedido ${order.id} ahora está ${status}`);
      return res.json(order);
    } catch (e) {
      return next(e);
    }
  });

  app.use((error, req, res, _next) => {
    if (error instanceof BusinessError) return res.status(error.status).json({ detail: error.message });
    console.error(error);
    return res.status(500).json({ detail: "Error interno" });
  });
  return app;
}
