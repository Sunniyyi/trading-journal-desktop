@echo off
setlocal
cd /d "%~dp0\.."
if not exist node_modules (
  echo Les dependances ne sont pas installees.
  echo Lance d'abord INSTALLER_DEPENDENCIES_WINDOWS.bat
  pause
  exit /b 1
)
npm start
