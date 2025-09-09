#!/bin/bash

set -euo pipefail

# Use the same compose file and a dedicated project name for all actions
docker compose -f docker-compose.dev.yml -p ai-vtb-dev down --remove-orphans || true
docker compose -f docker-compose.dev.yml -p ai-vtb-dev build
docker compose -f docker-compose.dev.yml -p ai-vtb-dev up -d