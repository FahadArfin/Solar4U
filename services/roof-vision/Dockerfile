FROM python:3.12-slim AS local

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends libexpat1 \
    && rm -rf /var/lib/apt/lists/*
COPY services/roof-vision/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY services/roof-vision/ ./

EXPOSE 4005
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "4005"]

FROM local AS samgeo
COPY services/roof-vision/requirements-samgeo.txt ./requirements-samgeo.txt
RUN pip install --no-cache-dir -r requirements-samgeo.txt
