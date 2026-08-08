#!/bin/sh
set -eu

package_owner="$(stat -c '%u:%g' /app/package.json)"
lock_owner="$(stat -c '%u:%g' /app/pnpm-lock.yaml)"

restore_ownership() {
    chown "$package_owner" /app/package.json
    chown "$lock_owner" /app/pnpm-lock.yaml
    chown -R node:node /app/node_modules /pnpm/store
}
trap restore_ownership EXIT

pnpm --dir /app "$@" --store-dir /pnpm/store
