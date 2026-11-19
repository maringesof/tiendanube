// Configuración leída solo desde variables de entorno (factor III).
function required(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`Falta la variable obligatoria ${name}`);
  return value;
}

export const config = Object.freeze({
  port: Number(process.env.PORT || 8002),
  oracle: Object.freeze({
    user: required("ORACLE_USER"),
    password: required("ORACLE_PASSWORD"),
    connectString: required("ORACLE_CONNECT_STRING"),
  }),
  // URL del microservicio de productos dentro de la red Docker (sin localhost).
  productsServiceUrl: required("PRODUCTS_SERVICE_URL").replace(/\/+$/, ""),
});
