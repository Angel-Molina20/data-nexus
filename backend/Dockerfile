FROM python:3.12-slim AS development

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN addgroup --system datanexus \
    && adduser --system --ingroup datanexus --home /home/datanexus datanexus

COPY pyproject.toml README.md ./
RUN pip install --upgrade pip \
    && pip install --editable ".[dev]"

COPY --chown=datanexus:datanexus . .

USER datanexus

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
