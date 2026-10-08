@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

set "PSEXE=pwsh"
where pwsh >nul 2>nul || set "PSEXE=powershell"

"%PSEXE%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start.ps1" %*
set "CODE=%ERRORLEVEL%"

if not "%CODE%"=="0" (
  echo.
  echo Startup failed with exit code %CODE%.
  pause
)

endlocal
