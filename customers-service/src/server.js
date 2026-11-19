// Microservicio de CLIENTES: registrar y consultar clientes de la tienda.
// Persistencia: MongoDB Atlas, en su PROPIA base de datos (tienda_clientes).
// Es independiente: si productos o pedidos se caen, este sigue funcionando.
import express from "express";
import { MongoClient, ObjectId } from "mongodb";

function required(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`Falta la variable obligatoria ${name}`);
  return value;
}

// Factor III: configuración por variables de entorno
const PORT = Number(process.env.PORT || 8003);
const client = new MongoClient(required("MONGODB_URI"), { serverSelectionTimeoutMS: 8000 });
const DB_NAME = process.env.MONGODB_DB_NAME || "tienda_clientes";

function toJson(doc) {
  return {
    id: String(doc._id),
    name: doc.name,
    email: doc.email,
    phone: doc.phone,
    city: doc.city,
    created_at: doc.created_at,
  };
}

async function main() {
  await client.connect();
  await client.db("admin").command({ ping: 1 });
  const customers = client.db(DB_NAME).collection("customers");
  console.log(`Conectado a MongoDB Atlas, base '${DB_NAME}'`);

  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "50kb" }));

  app.get("/api/health", (req, res) => res.json({ service: "customers", status: "ok" }));

  // Solo acepta peticiones con la identidad validada por el API Gateway
  app.use("/api", (req, res, next) => {
    if (!String(req.get("X-User-Id") || "").trim()) {
      return res.status(401).json({ detail: "Falta la identidad validada por el gateway" });
    }
    return next();
  });

  app.get("/api/customers", async (req, res, next) => {
    try {
      const docs = await customers.find().sort({ name: 1 }).toArray();
      res.json(docs.map(toJson));
    } catch (e) {
      next(e);
    }
  });

  app.get("/api/customers/:id", async (req, res, next) => {
    try {
      if (!ObjectId.isValid(req.params.id)) return res.status(404).json({ detail: "Cliente no encontrado" });
      const doc = await customers.findOne({ _id: new ObjectId(req.params.id) });
      return doc ? res.json(toJson(doc)) : res.status(404).json({ detail: "Cliente no encontrado" });
    } catch (e) {
      return next(e);
    }
  });

  app.post("/api/customers", async (req, res, next) => {
    try {
      const name = String(req.body?.name || "").trim();
      const email = String(req.body?.email || "").trim().toLowerCase();
      const phone = String(req.body?.phone || "").trim();
      const city = String(req.body?.city || "").trim();
      if (name.length < 2) return res.status(400).json({ detail: "name es obligatorio" });
      if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ detail: "email no es válido" });
      if (await customers.findOne({ email })) {
        return res.status(409).json({ detail: "Ya existe un cliente con ese email" });
      }
      const doc = { name, email, phone, city, created_by: req.get("X-User-Id"), created_at: new Date().toISOString() };
      const result = await customers.insertOne(doc);
      console.log(`Cliente creado ${result.insertedId}: ${name}`);
      return res.status(201).json(toJson({ ...doc, _id: result.insertedId }));
    } catch (e) {
      return next(e);
    }
  });

  app.use((error, req, res, _next) => {
    console.error(error);
    res.status(500).json({ detail: "Error interno" });
  });

  app.listen(PORT, "0.0.0.0", () => console.log(`customers-service escuchando en el puerto ${PORT}`));
}

// Factor IX: si la base no está disponible, el proceso termina y Docker lo reinicia
main().catch((error) => {
  console.error("No fue posible iniciar customers-service:", error.message);
  process.exit(1);
});
