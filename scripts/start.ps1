#Requires -Version 5.1
<#
  知析台 · 一键启动
  首次运行会自动创建虚拟环境、安装后端依赖、构建前端，然后在本机启动服务。
  重新运行只会做缺失的步骤，几秒内即可启动。
#>
[CmdletBinding()]
param(
    [int]$Port = 8765,
    [switch]$Rebuild,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false) } catch { }

$Root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $Root

function Write-Step { param([string]$Text) Write-Host "==> $Text" -ForegroundColor Cyan }
function Write-Ok { param([string]$Text) Write-Host "    $Text" -ForegroundColor DarkGray }
function Fail { param([string]$Text) Write-Host "错误：$Text" -ForegroundColor Red; exit 1 }

Write-Host ''
Write-Host '  知析台 · 本地文献研究工作台' -ForegroundColor White
Write-Host '  数据全部留在本机，出站请求只发往你自己配置的接口。' -ForegroundColor DarkGray
Write-Host ''

# ---------- 1. Python 虚拟环境 ----------
$Venv = Join-Path $Root '.venv'
$Python = Join-Path $Venv 'Scripts\python.exe'

if (-not (Test-Path -LiteralPath $Python)) {
    Write-Step '首次运行：创建 Python 虚拟环境'
    $launcher = Get-Command python -ErrorAction SilentlyContinue
    if (-not $launcher) { $launcher = Get-Command py -ErrorAction SilentlyContinue }
    if (-not $launcher) { Fail '未找到 Python。请安装 Python 3.11 或更高版本，并在安装时勾选 Add to PATH。' }
    & $launcher.Source -m venv $Venv
    if ($LASTEXITCODE -ne 0) { Fail '创建虚拟环境失败。' }
}

# ---------- 2. 后端依赖 ----------
& $Python -c "import fastapi, uvicorn, fitz, docx, httpx, multipart" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Step '安装后端依赖（首次约需 1-3 分钟）'
    & $Python -m pip install --disable-pip-version-check --quiet --upgrade pip
    & $Python -m pip install --disable-pip-version-check --quiet -r (Join-Path $Root 'backend\requirements.txt')
    if ($LASTEXITCODE -ne 0) { Fail '后端依赖安装失败，请检查网络后重试。' }
}

# ---------- 3. 前端构建 ----------
$FrontendDir = Join-Path $Root 'frontend'
$Dist = Join-Path $FrontendDir 'dist\index.html'

if ($Rebuild -or -not (Test-Path -LiteralPath $Dist)) {
    $Npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if (-not $Npm) { $Npm = Get-Command npm -ErrorAction SilentlyContinue }
    if (-not $Npm) { Fail '未找到 npm。请安装 Node.js 18 或更高版本。' }

    if (-not (Test-Path -LiteralPath (Join-Path $FrontendDir 'node_modules'))) {
        Write-Step '安装前端依赖（首次约需 1-3 分钟）'
        Push-Location -LiteralPath $FrontendDir
        & $Npm.Source install --no-fund --no-audit
        $code = $LASTEXITCODE
        Pop-Location
        if ($code -ne 0) { Fail '前端依赖安装失败，请检查网络后重试。' }
    }

    Write-Step '构建前端界面'
    Push-Location -LiteralPath $FrontendDir
    & $Npm.Source run build
    $code = $LASTEXITCODE
    Pop-Location
    if ($code -ne 0) { Fail '前端构建失败。' }
}

# ---------- 4. 启动服务 ----------
$Url = "http://127.0.0.1:$Port"
Write-Step "启动本地服务 $Url"

# 端口预检：否则旧实例在对外服务、新实例 bind 失败悄悄退出，
# 而健康检查打到了旧实例上，脚本会误报「服务已就绪」。
$probe = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
try {
    $probe.Start()
}
catch {
    Fail "端口 $Port 已被占用。可能已经有一个知析台在运行，请先关掉它，或者用 -Port 换一个端口。"
}
finally {
    try { $probe.Stop() } catch { }
}

$env:PYTHONUTF8 = '1'
$server = Start-Process -FilePath $Python -PassThru -NoNewWindow -ArgumentList @(
    '-m', 'uvicorn', 'app.main:app',
    '--host', '127.0.0.1',
    '--port', "$Port",
    '--app-dir', (Join-Path $Root 'backend')
)

$deadline = (Get-Date).AddSeconds(45)
$ready = $false
while ((Get-Date) -lt $deadline) {
    if ($server.HasExited) { Fail "服务异常退出，退出码 $($server.ExitCode)。端口 $Port 可能已被占用。" }
    try {
        $response = Invoke-WebRequest -Uri "$Url/api/health" -UseBasicParsing -TimeoutSec 2
        if ($response.StatusCode -eq 200) { $ready = $true; break }
    }
    catch { Start-Sleep -Milliseconds 400 }
}

if (-not $ready -or $server.HasExited) {
    try { $server | Stop-Process -Force -ErrorAction SilentlyContinue } catch { }
    Fail "服务未能正常启动（端口 $Port 可能已被占用）。"
}

Write-Ok '服务已就绪。'
if (-not $NoBrowser) { Start-Process $Url }

Write-Host ''
Write-Host "  已打开 $Url" -ForegroundColor Green
Write-Host '  关闭此窗口或按 Ctrl+C 停止服务。' -ForegroundColor DarkGray
Write-Host ''

try {
    Wait-Process -Id $server.Id -ErrorAction SilentlyContinue
}
finally {
    if ($server -and -not $server.HasExited) {
        try { $server | Stop-Process -Force -ErrorAction SilentlyContinue } catch { }
    }
}
