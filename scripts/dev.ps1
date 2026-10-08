#Requires -Version 5.1
<#
  知析台 · 开发模式
  后端带热重载跑在 8765，前端 Vite 开发服务器跑在 5173，/api 由 Vite 反向代理。
  界面改动即时生效，后端改动自动重启。
#>
[CmdletBinding()]
param(
    [int]$BackendPort = 8765,
    [int]$FrontendPort = 5173
)

$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false) } catch { }

$Root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $Root

function Write-Step { param([string]$Text) Write-Host "==> $Text" -ForegroundColor Cyan }
function Fail { param([string]$Text) Write-Host "错误：$Text" -ForegroundColor Red; exit 1 }

$Python = Join-Path $Root '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $Python)) {
    Fail '尚未创建虚拟环境。请先运行一次 启动网站.cmd，或执行 scripts\start.ps1。'
}

& $Python -c "import fastapi, uvicorn, fitz, docx, httpx, multipart" 2>$null
if ($LASTEXITCODE -ne 0) { Fail '后端依赖不完整，请先运行 scripts\start.ps1。' }

$Npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $Npm) { $Npm = Get-Command npm -ErrorAction SilentlyContinue }
if (-not $Npm) { Fail '未找到 npm。请安装 Node.js 18 或更高版本。' }

if (-not (Test-Path -LiteralPath (Join-Path $Root 'frontend\node_modules'))) {
    Write-Step '安装前端依赖'
    Push-Location -LiteralPath (Join-Path $Root 'frontend')
    & $Npm.Source install --no-fund --no-audit
    $code = $LASTEXITCODE
    Pop-Location
    if ($code -ne 0) { Fail '前端依赖安装失败。' }
}

# 后端热重载（独立窗口，日志单独可见）
Write-Step "后端热重载 http://127.0.0.1:$BackendPort"
$backend = Start-Process -FilePath $Python -PassThru -ArgumentList @(
    '-m', 'uvicorn', 'app.main:app',
    '--host', '127.0.0.1',
    '--port', "$BackendPort",
    '--reload',
    '--app-dir', (Join-Path $Root 'backend')
)

# 前端开发服务器（前台运行，Ctrl+C 退出）
Write-Step "前端开发服务器 http://127.0.0.1:$FrontendPort"
Start-Sleep -Seconds 2
Start-Process "http://127.0.0.1:$FrontendPort"

Push-Location -LiteralPath (Join-Path $Root 'frontend')
try {
    & $Npm.Source run dev -- --port $FrontendPort
}
finally {
    Pop-Location
    if ($backend -and -not $backend.HasExited) {
        try { $backend | Stop-Process -Force -ErrorAction SilentlyContinue } catch { }
    }
}
