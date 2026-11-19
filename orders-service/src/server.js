import oracledb from "oracledb";

import { createApp } from "./app.js";
import { config } from "./config.js";
import { OrderRepository } from "./repository.js";

async function main() {
  // Pool de conexiones a Oracle Autonomous Database (modo Thin, sin wallet).
  const pool = await oracledb.createPool(config.oracle);
  const conn = await pool.getConnection();
  await conn.execute("SELECT 1 FROM dual");
  await conn.close();
  console.log("Conectado a Oracle Autonomous Database");

  const app = createApp({ repository: new OrderRepository(pool), config });
  app.listen(config.port, "0.0.0.0", () => {
    console.log(`orders-service escuchando en el puerto ${config.port}`);
    console.log(`products-service configurado en ${config.productsServiceUrl}`);
  });
}

main().catch((error) => {
  console.error("No fue posible iniciar orders-service:", error.message);
  process.exit(1);
});
