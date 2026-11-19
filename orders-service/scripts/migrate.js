// Proceso administrativo (factor XII): crea la tabla ORDERS si no existe.
// Uso: docker compose run --rm orders-service npm run migrate
import { readFile } from "node:fs/promises";

import oracledb from "oracledb";

import { config } from "../src/config.js";

const sql = await readFile(new URL("../sql/001_orders.sql", import.meta.url), "utf8");
const conn = await oracledb.getConnection(config.oracle);
try {
  await conn.execute(sql.replace(/;\s*$/, ""));
  console.log("Tabla ORDERS creada");
} catch (error) {
  if (error.errorNum === 955) console.log("La tabla ORDERS ya existía; no se hizo nada");
  else throw error;
} finally {
  await conn.close();
}
