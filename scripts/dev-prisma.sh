#!/usr/bin/env sh
set -euo pipefail

# Usage:
#  ./scripts/dev-prisma.sh            # migrate dev --name update && generate
#  ./scripts/dev-prisma.sh push       # db push && generate
#  ./scripts/dev-prisma.sh migrate my_name  # migrate dev --name my_name && generate

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/../docker-compose.dev.yml"
# Имя проекта docker compose (должно совпадать с уже запущенным стеком)
# можно переопределить через переменную окружения COMPOSE_PROJECT_NAME
PROJECT_NAME="${COMPOSE_PROJECT_NAME:-ai-vtb-dev}"

# Ensure backend-dev is up (idempotent)
docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" up -d backend-dev --no-recreate

ACTION="${1:-migrate}"
if [ "$ACTION" = "push" ] || [ "$ACTION" = "--push" ]; then
  docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" exec backend-dev npx prisma db push
else
  NAME="${2:-update}"
  docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" exec backend-dev npx prisma migrate dev --name "$NAME"
fi

docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" exec backend-dev npx prisma generate
echo "Prisma sync completed."


