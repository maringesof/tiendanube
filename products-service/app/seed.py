"""Proceso administrativo (factor XII): carga productos de ejemplo.

Uso:  docker compose run --rm products-service python -m app.seed
"""
from datetime import datetime, timezone

from . import db

SAMPLE = [
    {"name": "Camiseta básica", "category": "Ropa", "price": 35000, "stock": 20},
    {"name": "Gorra deportiva", "category": "Accesorios", "price": 28000, "stock": 15},
    {"name": "Termo 750 ml", "category": "Hogar", "price": 42000, "stock": 10},
]

if __name__ == "__main__":
    db.ping()
    inserted = 0
    for item in SAMPLE:
        if not db.products.find_one({"name": item["name"]}):
            db.products.insert_one(item | {
                "created_by": "seed",
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            inserted += 1
    print(f"Seed terminado: {inserted} productos nuevos")
