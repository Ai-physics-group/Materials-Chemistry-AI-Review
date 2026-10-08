@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

set "PSEXE=powershell"
where pwsh >nul 2>nul && set "PSEXE=pwsh"

"%PSEXE%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\dev.ps1" %*
set "CODE=%ERRORLEVEL%"

if not "%CODE%"=="0" (
  echo.
  echo Dev mode exited with code %CODE%.
  pause
)

endlocal
