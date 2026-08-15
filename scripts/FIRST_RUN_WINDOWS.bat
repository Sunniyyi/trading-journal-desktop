@echo off
setlocal
cd /d "%~dp0\.."
echo.
echo ==============================================
echo      TRADING JOURNAL DESKTOP - FIRST RUN
echo ==============================================
echo.
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js n'est pas installe.
  echo Installe Node.js puis relance ce fichier.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installation des composants Electron...
  call npm install
  if errorlevel 1 goto :error
)
echo Lancement de Trading Journal Desktop...
call npm start
exit /b %errorlevel%
:error
echo.
echo L'installation a echoue. Verifie ta connexion Internet puis reessaie.
pause
exit /b 1
