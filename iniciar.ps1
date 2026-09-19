$ErrorActionPreference = "Stop"

$mongoService = Get-Service -Name "MongoDB" -ErrorAction SilentlyContinue
if ($mongoService -and $mongoService.Status -ne "Running") {
    Write-Host "O servico MongoDB esta parado. Tentando iniciar..." -ForegroundColor Yellow
    try { Start-Service -Name "MongoDB" } catch {
        Write-Host "Abra o PowerShell como Administrador e execute: Start-Service MongoDB" -ForegroundColor Yellow
    }
}

$mongoTest = Test-NetConnection -ComputerName localhost -Port 27017 -WarningAction SilentlyContinue
if (-not $mongoTest.TcpTestSucceeded) {
    throw "MongoDB nao esta respondendo em localhost:27017. Inicie o servico MongoDB antes de continuar."
}

if (-not (Test-Path ".\apps\api\.env")) {
    Copy-Item ".\apps\api\.env.example" ".\apps\api\.env"
    Write-Host "Arquivo .env criado." -ForegroundColor Green
}

Write-Host "Iniciando API e Angular..." -ForegroundColor Cyan
Write-Host "Abra http://localhost:4200 no notebook." -ForegroundColor Green
npm run dev
