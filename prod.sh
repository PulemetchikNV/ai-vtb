#!/bin/bash

set -euo pipefail

# Use the same compose file and a dedicated project name for all actions
docker compose -f docker-compose.yml -p ai-vtb down --remove-orphans || true
docker compose -f docker-compose.yml -p ai-vtb build
docker compose -f docker-compose.yml -p ai-vtb up -d