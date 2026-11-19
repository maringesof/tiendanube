"""Microservicio de PRODUCTOS (catálogo e inventario) con MongoDB Atlas.

Responsabilidad: registrar productos, consultarlos y descontar stock.
Solo recibe tráfico del API Gateway (o del microservicio de pedidos), que
envía la identidad del usuario ya validada en el encabezado X-User-Id.
"""
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from pymongo import ReturnDocument

from . import db

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("products-service")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    db.ping()
    log.info("Conectado a MongoDB Atlas, base '%s'", db.db.name)
    yield


app = FastAPI(title="products-service", lifespan=lifespan)


# ---------- Modelos de entrada ----------
class ProductIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    category: str = Field(min_length=2, max_length=60)
    price: float = Field(gt=0)
    stock: int = Field(ge=0)


class ReserveIn(BaseModel):
    quantity: int = Field(gt=0)


# ---------- Utilidades ----------
def identity(x_user_id: str = Header(default="")) -> str:
    """Exige la identidad que agrega el gateway después de validar Firebase."""
    if not x_user_id.strip():
        raise HTTPException(401, "Falta la identidad validada por el gateway")
    return x_user_id


def to_json(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "name": doc["name"],
        "category": doc["category"],
        "price": doc["price"],
        "stock": doc["stock"],
        "created_by": doc.get("created_by"),
        "created_at": doc.get("created_at"),
    }


def object_id(product_id: str) -> ObjectId:
    try:
        return ObjectId(product_id)
    except (InvalidId, TypeError):
        raise HTTPException(404, "Producto no encontrado")


# ---------- Endpoints ----------
@app.get("/api/health")
def health():
    return {"service": "products", "status": "ok"}


@app.get("/api/products")
def list_products(_uid: str = Depends(identity)):
    return [to_json(p) for p in db.products.find().sort("name", 1)]


@app.get("/api/products/{product_id}")
def get_product(product_id: str, _uid: str = Depends(identity)):
    doc = db.products.find_one({"_id": object_id(product_id)})
    if not doc:
        raise HTTPException(404, "Producto no encontrado")
    return to_json(doc)


@app.post("/api/products", status_code=201)
def create_product(body: ProductIn, uid: str = Depends(identity)):
    doc = body.model_dump() | {
        "created_by": uid,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = db.products.insert_one(doc)
    log.info("Producto creado %s por %s", result.inserted_id, uid)
    return to_json(doc | {"_id": result.inserted_id})


@app.post("/api/products/{product_id}/reserve")
def reserve_stock(product_id: str, body: ReserveIn, uid: str = Depends(identity)):
    """Descuenta stock de forma atómica. Lo llama el microservicio de pedidos.

    El filtro stock >= cantidad hace que dos pedidos simultáneos no puedan
    dejar el inventario en negativo.
    """
    oid = object_id(product_id)
    doc = db.products.find_one_and_update(
        {"_id": oid, "stock": {"$gte": body.quantity}},
        {"$inc": {"stock": -body.quantity}},
        return_document=ReturnDocument.AFTER,
    )
    if doc:
        log.info("Stock reservado: %s x%s (usuario %s)", product_id, body.quantity, uid)
        return to_json(doc)
    if not db.products.find_one({"_id": oid}):
        raise HTTPException(404, "Producto no encontrado")
    raise HTTPException(409, "Stock insuficiente")


@app.post("/api/products/{product_id}/release")
def release_stock(product_id: str, body: ReserveIn, uid: str = Depends(identity)):
    """Devuelve stock reservado (compensación si el pedido no se pudo guardar en Oracle)."""
    doc = db.products.find_one_and_update(
        {"_id": object_id(product_id)},
        {"$inc": {"stock": body.quantity}},
        return_document=ReturnDocument.AFTER,
    )
    if not doc:
        raise HTTPException(404, "Producto no encontrado")
    log.info("Stock devuelto: %s x%s (usuario %s)", product_id, body.quantity, uid)
    return to_json(doc)
