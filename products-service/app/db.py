"""Conexión a MongoDB Atlas (servicio de respaldo externo, factor IV)."""
from pymongo import MongoClient

from . import config

client = MongoClient(config.MONGODB_URI, serverSelectionTimeoutMS=8000)
db = client[config.MONGODB_DB_NAME]
products = db["products"]


def ping() -> None:
    """Falla al arrancar si la URI, la clave o la IP de Atlas son incorrectas."""
    client.admin.command("ping")
