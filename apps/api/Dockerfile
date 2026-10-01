# Build context must be the repo root (needs apps/api/ AND data/) —
# see docker-compose.yml, which sets context: .
FROM python:3.11-slim

WORKDIR /app

COPY apps/api/requirements.txt apps/api/requirements.txt
RUN pip install --no-cache-dir -r apps/api/requirements.txt

COPY apps/api/app apps/api/app
COPY data data

# Preserves the same relative nesting apps/api/app/core/config.py expects
# locally (four parents up = repo root), so DATA_DIR resolves to /app/data
# without needing an explicit override. See app/core/config.py.
WORKDIR /app/apps/api

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host ${API_HOST:-0.0.0.0} --port ${API_PORT:-8000}"]
