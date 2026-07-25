FROM node:22-alpine AS development

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

USER node

EXPOSE 5173

CMD ["pnpm", "dev", "--host", "0.0.0.0"]
