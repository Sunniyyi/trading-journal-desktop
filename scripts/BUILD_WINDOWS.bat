@echo off
setlocal
cd /d "%~dp0\.."
if not exist node_modules (
  echo Les dependances ne sont pas installees.
  echo Lance d'abord INSTALLER_DEPENDENCIES_WINDOWS.bat
  pause
  exit /b 1
)
echo Construction de l'installateur Windows...
npm run make
if errorlevel 1 goto :error
echo.
echo Build termine. Regarde le dossier out\make\
pause
exit /b 0
:error
echo.
echo ERREUR pendant la construction.
pause
exit /b 1
