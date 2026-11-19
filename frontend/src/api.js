// Cliente HTTP: TODAS las peticiones van al API Gateway con el token de Firebase.
import { config } from "./config.js";
import { auth } from "./firebase.js";

async function request(path, { method = "GET", body } = {}) {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
  const res = await fetch(`${config.apiUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = Array.isArray(data.detail) ? "Datos inválidos" : data.detail;
    throw new Error(`${res.status}: ${detail || "Error en la petición"}`);
  }
  return data;
}

export const api = {
  servicesStatus: () => request("/health/services"),
  listCustomers: () => request("/api/customers"),
  createCustomer: (c) => request("/api/customers", { method: "POST", body: c }),
  listProducts: () => request("/api/products"),
  createProduct: (p) => request("/api/products", { method: "POST", body: p }),
  listOrders: () => request("/api/orders"),
  createOrder: (o) => request("/api/orders", { method: "POST", body: o }),
  updateOrderStatus: (id, status) =>
    request(`/api/orders/${id}/status`, { method: "PATCH", body: { status } }),
};
