// Comunicación REST con el microservicio de PRODUCTOS (regla de negocio).
// Pedidos nunca toca MongoDB: le pregunta al dueño de los datos por su API.

export class BusinessError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function headers(identity) {
  return {
    "Content-Type": "application/json",
    "X-User-Id": identity.uid,
    "X-User-Email": identity.email || "",
  };
}

async function call(url, options) {
  try {
    return await fetch(url, { ...options, signal: AbortSignal.timeout(5000) });
  } catch {
    throw new BusinessError(502, "El microservicio de productos no responde");
  }
}

/** 1) Verifica que el producto exista y obtiene su nombre y precio. */
export async function getProduct(baseUrl, productId, identity) {
  const res = await call(`${baseUrl}/api/products/${encodeURIComponent(productId)}`, {
    headers: headers(identity),
  });
  if (res.status === 404) throw new BusinessError(400, "El producto no existe");
  if (!res.ok) throw new BusinessError(502, "No fue posible consultar el producto");
  return res.json();
}

/** 2) Descuenta el stock en productos; si no alcanza, el pedido no se crea. */
export async function reserveStock(baseUrl, productId, quantity, identity) {
  const res = await call(`${baseUrl}/api/products/${encodeURIComponent(productId)}/reserve`, {
    method: "POST",
    headers: headers(identity),
    body: JSON.stringify({ quantity }),
  });
  if (res.status === 409) throw new BusinessError(409, "Stock insuficiente para el pedido");
  if (!res.ok) throw new BusinessError(502, "No fue posible reservar el stock");
  return res.json();
}

/** 3) Compensación: si Oracle falla después de reservar, devuelve el stock. */
export async function releaseStock(baseUrl, productId, quantity, identity) {
  try {
    await call(`${baseUrl}/api/products/${encodeURIComponent(productId)}/release`, {
      method: "POST",
      headers: headers(identity),
      body: JSON.stringify({ quantity }),
    });
    console.log(`Stock devuelto a productos: ${productId} x${quantity}`);
  } catch {
    console.error(`No se pudo devolver el stock de ${productId} x${quantity}`);
  }
}
