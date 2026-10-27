#!/bin/sh
set -eu

prisma migrate deploy --schema=/app/prisma/schema.prisma
exec "$@"