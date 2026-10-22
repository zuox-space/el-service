# Один клик на Windows: сборка, миграция, запуск.
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

if (-not (Test-Path "deploy\env.production")) {
    Copy-Item "deploy\env.production.example" "deploy\env.production"
    Write-Host "Создан deploy\env.production — заполните его и запустите снова."
    exit 1
}

Write-Host "== сборка образа =="
docker compose build

Write-Host "== миграция схемы =="
docker compose --profile setup run --rm migrate

Write-Host "== запуск приложения =="
docker compose up -d app

Write-Host "== ожидание healthcheck =="
$id = (docker compose ps -q app).Trim()
for ($i = 1; $i -le 60; $i++) {
    $status = docker inspect --format '{{.State.Health.Status}}' $id 2>$null
    Write-Host ("  {0}/60: {1}" -f $i, $status)
    if ($status -eq "healthy") {
        Write-Host "Готово: приложение поднято."
        exit 0
    }
    Start-Sleep -Seconds 2
}

Write-Host "Приложение не стало healthy за 2 минуты. Логи:"
docker compose logs --tail=80 app
exit 1
