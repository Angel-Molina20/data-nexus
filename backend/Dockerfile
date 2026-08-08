ARG PYTHON_VERSION=3.12.13-slim-bookworm

FROM python:${PYTHON_VERSION} AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    VIRTUAL_ENV=/opt/venv \
    PATH=/opt/venv/bin:$PATH \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    TZ=UTC

WORKDIR /app

RUN addgroup --system datanexus \
    && adduser --system --ingroup datanexus --home /home/datanexus datanexus \
    && python -m venv "$VIRTUAL_ENV"

FROM base AS dependencies

COPY pyproject.toml README.md requirements.lock ./
RUN pip install pip==26.2.1 setuptools==80.9.0 wheel==0.45.1 \
    && pip install --constraint requirements.lock --no-build-isolation --editable ".[dev]"

FROM dependencies AS development

COPY --chown=datanexus:datanexus . .

USER datanexus

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
