@echo off
setlocal enabledelayedexpansion

echo ========================================
echo   Dashboard Local Bundle Builder
echo ========================================

:: Get directories
set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR%..
set FRONTEND_DIR=%PROJECT_ROOT%\frontend
set BACKEND_DIR=%PROJECT_ROOT%\backend
set SERVER_DIR=%PROJECT_ROOT%\frontend\server
set OUTPUT_DIR=%SCRIPT_DIR%

:: Clean previous static resources
echo.
echo [1/6] Cleaning previous build...
if exist "%BACKEND_DIR%\src\main\resources\static" rmdir /s /q "%BACKEND_DIR%\src\main\resources\static"
mkdir "%BACKEND_DIR%\src\main\resources\static"

:: Build React frontend
echo.
echo [2/6] Building React frontend...
cd /d "%FRONTEND_DIR%"
set REACT_APP_PROXY_URL=http://localhost:3001
call npm install --silent
call npm run build

if errorlevel 1 (
    echo Frontend build failed!
    exit /b 1
)

:: Copy frontend build to backend static resources
echo.
echo [3/6] Copying frontend build to backend...
xcopy /s /e /y "%FRONTEND_DIR%\build\*" "%BACKEND_DIR%\src\main\resources\static\"

:: Build Spring Boot JAR
echo.
echo [4/6] Building Spring Boot JAR...
cd /d "%BACKEND_DIR%"
call gradlew.bat clean bootJar --warning-mode=none

if errorlevel 1 (
    echo Backend build failed!
    exit /b 1
)

:: Copy JAR to output directory
echo.
echo [5/6] Copying JAR to local-artifacts...
copy /y "%BACKEND_DIR%\build\libs\*.jar" "%OUTPUT_DIR%\dashboard.jar"

:: Bundle CLI proxy server
echo.
echo [6/6] Bundling CLI proxy server...
if exist "%OUTPUT_DIR%\cli-server" rmdir /s /q "%OUTPUT_DIR%\cli-server"
mkdir "%OUTPUT_DIR%\cli-server"
copy /y "%SERVER_DIR%\package.json" "%OUTPUT_DIR%\cli-server\"
copy /y "%SERVER_DIR%\index.js" "%OUTPUT_DIR%\cli-server\"
cd /d "%OUTPUT_DIR%\cli-server"
call npm install --silent --production

echo.
echo ========================================
echo   Build complete!
echo ========================================
echo.
echo Output:
echo   - %OUTPUT_DIR%\dashboard.jar
echo   - %OUTPUT_DIR%\cli-server\
echo.
echo To run: run.bat
echo.

endlocal
