@echo off
setlocal EnableExtensions
cd /d "%~dp0\.."
if not exist node_modules (
  echo Installation des dependances...
  call npm install
  if errorlevel 1 goto :error
)
echo Construction de Trading Journal...
call npm run make
if errorlevel 1 goto :error
set "SETUP="
for /r "%CD%\out\make\squirrel.windows" %%F in (*Setup.exe) do set "SETUP=%%F"
if not defined SETUP (
  echo Installateur introuvable dans out\make\squirrel.windows
  goto :error
)
echo.
echo Installateur : %SETUP%
echo Lancement de l'installation...
start "" "%SETUP%"
exit /b 0
:error
echo.
echo ERREUR pendant la preparation de l'installation.
pause
exit /b 1
