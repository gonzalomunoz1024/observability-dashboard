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
set OUTPUT_DIR=%SCRIPT_DIR%

:: Clean previous static resources
echo.
echo [1/5] Cleaning previous build...
if exist "%BACKEND_DIR%\src\main\resources\static" rmdir /s /q "%BACKEND_DIR%\src\main\resources\static"
mkdir "%BACKEND_DIR%\src\main\resources\static"

:: Build React frontend
echo.
echo [2/5] Building React frontend...
cd /d "%FRONTEND_DIR%"
set REACT_APP_PROXY_URL=
call npm install --silent
call npm run build

if errorlevel 1 (
    echo Frontend build failed!
    exit /b 1
)

:: Copy frontend build to backend static resources
echo.
echo [3/5] Copying frontend build to backend...
xcopy /s /e /y "%FRONTEND_DIR%\build\*" "%BACKEND_DIR%\src\main\resources\static\"

:: Build Spring Boot JAR
echo.
echo [4/5] Building Spring Boot JAR...
cd /d "%BACKEND_DIR%"
call gradlew.bat clean bootJar --warning-mode=none

if errorlevel 1 (
    echo Backend build failed!
    exit /b 1
)

:: Copy JAR to output directory
echo.
echo [5/5] Copying JAR to local-artifacts...
copy /y "%BACKEND_DIR%\build\libs\*.jar" "%OUTPUT_DIR%\dashboard.jar"

echo.
echo ========================================
echo   Build complete!
echo ========================================
echo.
echo Output: %OUTPUT_DIR%\dashboard.jar
echo.
echo To run: run.bat
echo Or:     java -jar dashboard.jar
echo.

endlocal
