"""Configuración leída SOLO desde variables de entorno (factor III)."""
import os


def required(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Falta la variable obligatoria {name}")
    return value


PORT = int(os.getenv("PORT", "8001"))
MONGODB_URI = required("MONGODB_URI")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "tienda_productos")
