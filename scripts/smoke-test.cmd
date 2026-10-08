@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0.."
set "PYTHONUTF8=1"
set "PYTHONIOENCODING=utf-8"

if not exist ".venv\Scripts\python.exe" (
  echo Environment not found. Please run the launcher first.
  pause
  exit /b 1
)

".venv\Scripts\python.exe" "scripts\smoke_test.py" %*
set "CODE=%ERRORLEVEL%"

if not "%CODE%"=="0" (
  echo.
  echo Smoke test failed with exit code %CODE%.
  pause
)

endlocal
