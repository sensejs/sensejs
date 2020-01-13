#!/bin/bash

#PWD=$(pwd)
#echo "FROM ${BASE_IMAGE}"
#echo "COPY pnpm-lock.yaml ./"
#pnpm recursive exec -- echo "ADD ${pwd}/package.json $(pwd | tr $PWD ' ')}"

function baseImage() {

    echo "FROM node:${NODE_VERSION-lts} as base"
    echo "RUN curl -L https://unpkg.com/@pnpm/self-installer | node"
    echo "WORKDIR /opt/sensejs"
    echo "ADD package.json pnpm-lock.yaml pnpm-workspace.yaml ./"
    for package in packages/* tools/* examples/*; do
        if [[ -f ${package}/package.json ]]; then
            echo "COPY ${package}/*.json ${package}/"
        fi
    done
}

function buildRoot() {
    echo "FROM base AS dev"
    echo "RUN pnpm recursive install --frozen-lockfile "
    echo "COPY . ./"
    echo "RUN pnpm run build"
}

(baseImage; buildRoot) | docker build -f - -t sensejs . $@
