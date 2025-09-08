#!/usr/bin/env bash
set -euo pipefail

# Reset PostgreSQL in docker-compose: drop container and remove its data volume.
# Usage: ./scripts/reset-db.sh [-f compose_file] [-s service_name] [-v volume_name] [-y]
# Defaults: -f docker-compose.dev.yml, -s postgres, -v pg_data

COMPOSE_FILE="docker-compose.dev.yml"
SERVICE_NAME="postgres"
VOLUME_NAME="pg_data"
ASSUME_YES="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    -f|--file)
      COMPOSE_FILE="$2"; shift 2;;
    -s|--service)
      SERVICE_NAME="$2"; shift 2;;
    -v|--volume)
      VOLUME_NAME="$2"; shift 2;;
    -y|--yes)
      ASSUME_YES="true"; shift 1;;
    -h|--help)
      echo "Usage: $0 [-f compose_file] [-s service_name] [-v volume_name] [-y]"; exit 0;;
    *)
      echo "Unknown arg: $1"; exit 1;;
  esac
done

# Determine docker compose command
if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD=(docker compose -f "$COMPOSE_FILE")
elif docker-compose version >/dev/null 2>&1; then
  COMPOSE_CMD=(docker-compose -f "$COMPOSE_FILE")
else
  echo "docker compose not found" >&2
  exit 1
fi

echo "Compose file : $COMPOSE_FILE"
echo "Service      : $SERVICE_NAME"
echo "Volume       : $VOLUME_NAME"

if [[ "$ASSUME_YES" != "true" ]]; then
  read -r -p "This will STOP and REMOVE service '$SERVICE_NAME' and DELETE volume '$VOLUME_NAME'. Continue? [y/N] " ans
  case "$ans" in
    y|Y|yes|YES) :;;
    *) echo "Aborted"; exit 1;;
  esac
fi

echo "Stopping service $SERVICE_NAME ..."
"${COMPOSE_CMD[@]}" stop "$SERVICE_NAME" || true

echo "Removing service $SERVICE_NAME ..."
"${COMPOSE_CMD[@]}" rm -f -s "$SERVICE_NAME" || true

echo "Removing volume $VOLUME_NAME ..."
if docker volume inspect "$VOLUME_NAME" >/dev/null 2>&1; then
  docker volume rm "$VOLUME_NAME"
else
  echo "Volume $VOLUME_NAME does not exist, skipping"
fi

echo "Starting service $SERVICE_NAME ..."
"${COMPOSE_CMD[@]}" up -d "$SERVICE_NAME"

echo "Done."


