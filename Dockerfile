FROM node:14-buster AS pnpm-installed
ARG PNPM_VERSION=6.0.1
RUN npm install -g pnpm@${PNPM_VERSION}
WORKDIR /opt/sensejs
COPY pnpm-lock.yaml .
RUN pnpm fetch
COPY . .
RUN pnpm recursive install --offline --frozen-lockfile
RUN pnpm rebuild -r
RUN pnpm m run build
