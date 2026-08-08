#!/bin/sh
set -eu

modules_dir=/app/node_modules
store_dir=/pnpm/store
fingerprint_file="$modules_dir/.datanexus-dependencies.sha256"

mkdir -p "$modules_dir" "$store_dir"

expected_fingerprint="$({ sha256sum /app/package.json; sha256sum /app/pnpm-lock.yaml; } | sha256sum | cut -d ' ' -f 1)"
current_fingerprint=""
if [ -f "$fingerprint_file" ]; then
    current_fingerprint="$(cat "$fingerprint_file")"
fi

if [ "$current_fingerprint" != "$expected_fingerprint" ]; then
    echo "DataNexus frontend: synchronizing container dependencies..."
    chown -R node:node "$modules_dir" "$store_dir"
    su-exec node pnpm install --frozen-lockfile --store-dir "$store_dir"
    printf '%s\n' "$expected_fingerprint" > "$fingerprint_file"
    chown node:node "$fingerprint_file"
else
    chown node:node "$modules_dir" "$store_dir"
fi

exec su-exec node "$@"
