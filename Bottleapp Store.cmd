@echo off
setlocal

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0launch-app.ps1"

if errorlevel 1 (
  echo.
  echo Bottleapp Store launch failed.
  pause
)
