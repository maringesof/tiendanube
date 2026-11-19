# Imagen ligera con Python 3.12
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

# Factor II: dependencias declaradas e instaladas durante la construcción
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Solo el código; las credenciales llegan por variables de entorno (factor III)
COPY app ./app

# Factor VII: el servicio expone su puerto
EXPOSE 8001
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8001}"]
