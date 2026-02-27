#!/bin/sh
set -e

echo "Running db migrate..."
pnpm db:migrate

echo "Running db seed..."
pnpm db:seed

echo "Starting server..."
exec node build/index.js
