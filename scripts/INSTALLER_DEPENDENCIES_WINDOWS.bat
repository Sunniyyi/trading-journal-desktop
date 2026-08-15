@echo off
setlocal
cd /d "%~dp0\.."
echo.
echo ==============================================
echo   Trading Journal Desktop - Installation
echo ==============================================
echo.
echo Prerequis: Node.js installe sur Windows.
echo.
npm install
if errorlevel 1 goto :error
echo.
echo Installation terminee.
echo Lance ensuite START_WINDOWS.bat
pause
exit /b 0
:error
echo.
echo ERREUR pendant npm install.
pause
exit /b 1
