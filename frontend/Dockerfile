ARG NODE_VERSION=22.17.0-alpine3.22
ARG PNPM_VERSION=10.13.1

FROM node:${NODE_VERSION} AS base

ARG PNPM_VERSION

ENV PNPM_HOME=/pnpm
ENV COREPACK_HOME=/opt/corepack
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable \
    && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

FROM base AS dependencies

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --store-dir /pnpm/store

FROM dependencies AS development

RUN apk add --no-cache su-exec

COPY . .
RUN chmod 755 /app/docker-entrypoint.sh /app/manage-dependencies.sh

ENTRYPOINT ["/app/docker-entrypoint.sh"]

EXPOSE 5173

CMD ["pnpm", "dev", "--host", "0.0.0.0"]

FROM dependencies AS build

COPY . .
RUN pnpm build
