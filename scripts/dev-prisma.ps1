$ErrorActionPreference = "Stop"

param(
  [switch]$Push
)

# Путь к compose-файлу
$composeFile = Join-Path $PSScriptRoot "..\docker-compose.dev.yml"

# Проверяем, что стек запущен
$ps = docker compose -f $composeFile ps --format json | ConvertFrom-Json
$backend = $ps | Where-Object { $_.Name -eq "backend-dev" }
if (-not $backend -or $backend.State -ne "running") {
  Write-Host "Starting backend-dev service..."
  docker compose -f $composeFile up -d backend-dev | Out-Null
}

if ($Push) {
  docker compose -f $composeFile exec backend-dev npx prisma db push
} else {
  docker compose -f $composeFile exec backend-dev npx prisma migrate dev --name update
}
docker compose -f $composeFile exec backend-dev npx prisma generate
Write-Host "Prisma sync completed."


