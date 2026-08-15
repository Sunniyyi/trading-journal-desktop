@echo off
setlocal EnableExtensions
chcp 65001 >nul

echo.
echo ==========================================================
echo Trading Journal - activation des mises a jour automatiques
echo ==========================================================
echo.
echo Il faut un depot GitHub PUBLIC au format proprietaire/depot.
echo Exemple : noam/trading-journal-desktop
echo.
set "TJ_REPO=Sunniyyi/trading-journal-desktop"
echo Depot GitHub : %TJ_REPO%

if "%TJ_REPO%"=="" (
  echo Aucun depot saisi.
  pause
  exit /b 1
)

set "TJ_DIR=%APPDATA%\Trading Journal"
if not exist "%TJ_DIR%" mkdir "%TJ_DIR%"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$cfg = [ordered]@{ enabled = $true; githubRepo = '%TJ_REPO%'; feedUrl = ''; checkIntervalMinutes = 10; checkOnStartup = $true }; $json = $cfg | ConvertTo-Json; [System.IO.File]::WriteAllText('%TJ_DIR%\update-config.json', $json, (New-Object System.Text.UTF8Encoding($false)))"

if errorlevel 1 (
  echo Echec de l'ecriture de la configuration.
  pause
  exit /b 1
)

echo.
echo Configuration enregistree :
echo %TJ_DIR%\update-config.json
echo.
echo Redemarre Trading Journal.
pause
