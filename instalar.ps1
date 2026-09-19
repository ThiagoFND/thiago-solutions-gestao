$ErrorActionPreference = "Stop"

Write-Host "Verificando Node.js e npm..." -ForegroundColor Cyan
node --version
npm --version

Write-Host "Instalando dependencias do projeto..." -ForegroundColor Cyan
npm install
npm run install:all

if (-not (Test-Path ".\apps\api\.env")) {
    Copy-Item ".\apps\api\.env.example" ".\apps\api\.env"
}

Write-Host "Instalacao concluida. Execute .\iniciar.ps1" -ForegroundColor Green
