// Persistencia de pedidos en Oracle Autonomous Database.
import oracledb from "oracledb";

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

const COLUMNS = `id, product_id, product_name, unit_price, quantity, total,
                 customer_name, status, created_by, created_at`;

function mapRow(r) {
  if (!r) return null;
  return {
    id: r.ID,
    product_id: r.PRODUCT_ID,
    product_name: r.PRODUCT_NAME,
    unit_price: r.UNIT_PRICE,
    quantity: r.QUANTITY,
    total: r.TOTAL,
    customer_name: r.CUSTOMER_NAME,
    status: r.STATUS,
    created_by: r.CREATED_BY,
    created_at: r.CREATED_AT,
  };
}

export class OrderRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async run(fn) {
    const conn = await this.pool.getConnection();
    try {
      return await fn(conn);
    } finally {
      await conn.close();
    }
  }

  list() {
    return this.run(async (c) => {
      const r = await c.execute(`SELECT ${COLUMNS} FROM orders ORDER BY created_at DESC`);
      return r.rows.map(mapRow);
    });
  }

  findById(id) {
    return this.run(async (c) => {
      // Los binds (:id) evitan inyección SQL.
      const r = await c.execute(`SELECT ${COLUMNS} FROM orders WHERE id = :id`, { id: Number(id) });
      return mapRow(r.rows[0]);
    });
  }

  async create(order) {
    const id = await this.run(async (c) => {
      const r = await c.execute(
        `INSERT INTO orders
           (product_id, product_name, unit_price, quantity, total, customer_name, status, created_by)
         VALUES (:productId, :productName, :unitPrice, :quantity, :total, :customerName, 'pendiente', :createdBy)
         RETURNING id INTO :id`,
        { ...order, id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } },
        { autoCommit: true },
      );
      return r.outBinds.id[0];
    });
    return this.findById(id);
  }

  async updateStatus(id, status) {
    const rows = await this.run(async (c) => {
      const r = await c.execute(
        `UPDATE orders SET status = :status WHERE id = :id`,
        { status, id: Number(id) },
        { autoCommit: true },
      );
      return r.rowsAffected;
    });
    return rows ? this.findById(id) : null;
  }
}
