#!/usr/bin/env sh
set -euo pipefail

# Usage:
#  ./scripts/prod-prisma.sh            # migrate deploy && generate
#  ./scripts/prod-prisma.sh push       # db push && generate
#  ./scripts/prod-prisma.sh migrate    # migrate deploy && generate

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/../docker-compose.yml"
# Имя проекта docker compose (должно совпадать с уже запущенным стеком)
# можно переопределить через переменную окружения COMPOSE_PROJECT_NAME
PROJECT_NAME="${COMPOSE_PROJECT_NAME:-ai-vtb}"

# Ensure backend is up (idempotent)
docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" up -d backend --no-recreate

ACTION="${1:-migrate}"
if [ "$ACTION" = "push" ] || [ "$ACTION" = "--push" ]; then
  docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" exec backend npx prisma db push
else
  # Для прода используем migrate deploy вместо migrate dev
  docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" exec backend npx prisma migrate deploy
fi

docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" exec backend npx prisma generate
echo "Prisma prod sync completed."
