#!/bin/bash

#PWD=$(pwd)
#echo "FROM ${BASE_IMAGE}"
#echo "COPY pnpm-lock.yaml ./"
#pnpm recursive exec -- echo "ADD ${pwd}/package.json $(pwd | tr $PWD ' ')}"

function baseImage() {

    echo "# syntax = docker/dockerfile:experimental"
    echo "FROM node:${NODE_VERSION-lts} as base"
    echo "RUN curl -L https://unpkg.com/@pnpm/self-installer | node"
    echo "WORKDIR /opt/sensejs"
    echo "ADD pnpmfile.js package.json pnpm-lock.yaml pnpm-workspace.yaml ./"
    echo "RUN pnpm config store-dir /.pnpm-store"
    for package in packages/* tools/* examples/*; do
        if [[ -f ${package}/package.json ]]; then
            echo "COPY ${package}/*.json ${package}/"
        fi
    done
}

function buildRoot() {
    echo "FROM base AS dev"
    if [[ -n "$PNPM_STORE_CACHE" ]]; then
      RUN_OPT="--mount=type=bind,source=${PNPM_STORE_CACHE},target=/.pnpm-store"
    fi
    echo "RUN ${RUN_OPT-} pnpm recursive install --frozen-lockfile "
    echo "COPY . ./"
    echo "RUN pnpm run build"
}
# Using docker buildkit to ensure bind mount
export DOCKER_BUILDKIT=1
(baseImage; buildRoot) | docker build -f - -t sensejs . $@
