#!/bin/sh
set -e

echo "Running db push..."
pnpm db:push

echo "Running db seed..."
pnpm db:seed

echo "Starting server..."
exec node build/index.js
