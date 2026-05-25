#!/usr/bin/env pwsh
# Cortex — Windows Setup Script
# Run: powershell -ExecutionPolicy Bypass -File scripts/setup.ps1

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "  ╔═══════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║     Cortex Local AI — Setup           ║" -ForegroundColor Cyan
Write-Host "  ║     Privacy-first, 100% offline       ║" -ForegroundColor Cyan
Write-Host "  ╚═══════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ─── Check prerequisites ────────────────────────────────────────────────────

function Check-Command($cmd) {
    return $null -ne (Get-Command $cmd -ErrorAction SilentlyContinue)
}

Write-Host "Checking prerequisites..." -ForegroundColor Yellow

$missing = @()

if (-not (Check-Command "node")) { $missing += "Node.js 20+ (https://nodejs.org)" }
if (-not (Check-Command "pnpm")) { $missing += "pnpm (npm install -g pnpm)" }
if (-not (Check-Command "rustc")) { $missing += "Rust (https://rustup.rs)" }
if (-not (Check-Command "python")) { $missing += "Python 3.11+ (https://python.org)" }

if ($missing.Count -gt 0) {
    Write-Host ""
    Write-Host "Missing prerequisites:" -ForegroundColor Red
    foreach ($m in $missing) { Write-Host "  • $m" -ForegroundColor Red }
    Write-Host ""
    Write-Host "Please install them and re-run this script." -ForegroundColor Yellow
    exit 1
}

Write-Host "  ✓ Node.js $(node --version)" -ForegroundColor Green
Write-Host "  ✓ pnpm $(pnpm --version)" -ForegroundColor Green
Write-Host "  ✓ Rust $(rustc --version)" -ForegroundColor Green
Write-Host "  ✓ Python $(python --version)" -ForegroundColor Green

# ─── Install Ollama ─────────────────────────────────────────────────────────

Write-Host ""
Write-Host "Checking Ollama..." -ForegroundColor Yellow

if (-not (Check-Command "ollama")) {
    Write-Host "Installing Ollama..." -ForegroundColor Cyan
    $ollamaInstaller = "$env:TEMP\OllamaSetup.exe"
    Invoke-WebRequest -Uri "https://ollama.ai/download/windows" -OutFile $ollamaInstaller
    Start-Process -FilePath $ollamaInstaller -Wait
    Write-Host "  ✓ Ollama installed" -ForegroundColor Green
} else {
    Write-Host "  ✓ Ollama $(ollama --version)" -ForegroundColor Green
}

# ─── Install Node dependencies ───────────────────────────────────────────────

Write-Host ""
Write-Host "Installing Node.js dependencies..." -ForegroundColor Yellow
pnpm install
Write-Host "  ✓ Node dependencies installed" -ForegroundColor Green

# ─── Setup Python services ────────────────────────────────────────────────────

Write-Host ""
Write-Host "Setting up Python microservices..." -ForegroundColor Yellow

$services = @("embeddings", "whisper", "rag")
foreach ($svc in $services) {
    Write-Host "  Setting up $svc service..." -ForegroundColor Cyan
    Push-Location "services/$svc"
    python -m venv .venv
    .\.venv\Scripts\pip install --quiet --upgrade pip
    .\.venv\Scripts\pip install --quiet -r requirements.txt
    Pop-Location
    Write-Host "  ✓ $svc service ready" -ForegroundColor Green
}

# ─── Pull default Ollama model ────────────────────────────────────────────────

Write-Host ""
Write-Host "Would you like to download the default model (llama3:8b, ~4.7 GB)? [y/N]" -ForegroundColor Yellow
$response = Read-Host

if ($response -match "^[Yy]$") {
    Write-Host "Pulling llama3:8b (this may take several minutes)..." -ForegroundColor Cyan
    Start-Process "ollama" -ArgumentList "serve" -NoNewWindow
    Start-Sleep 2
    ollama pull llama3:8b
    Write-Host "  ✓ llama3:8b downloaded" -ForegroundColor Green
}

# ─── Create data directory ────────────────────────────────────────────────────

$dataDir = "$env:APPDATA\cortex"
if (-not (Test-Path $dataDir)) {
    New-Item -ItemType Directory -Path $dataDir | Out-Null
}
Write-Host "  ✓ Data directory: $dataDir" -ForegroundColor Green

# ─── Done ─────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "  ✓ Cortex setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Run the development server:  pnpm tauri:dev" -ForegroundColor White
Write-Host "  2. Build for production:        pnpm tauri:build" -ForegroundColor White
Write-Host "  3. Start Python services:       pnpm services:start" -ForegroundColor White
Write-Host ""
