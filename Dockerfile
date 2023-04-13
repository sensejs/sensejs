# syntax=docker/dockerfile:1.2
ARG NODE_VERSION=14
FROM node:${NODE_VERSION} AS pnpm-installed
ARG PNPM_VERSION=^7.26.2
RUN npm install -g pnpm@${PNPM_VERSION}
WORKDIR /opt/sensejs
COPY pnpm-lock.yaml .
RUN --mount=type=cache,id=pnpm-cache-node-v${NODE_VERSION},target=/root/.local/share/pnpm/store pnpm fetch
COPY . .
RUN --mount=type=cache,id=pnpm-cache-node-v${NODE_VERSION},target=/root/.local/share/pnpm/store pnpm recursive install --offline --frozen-lockfile
RUN pnpm run build
