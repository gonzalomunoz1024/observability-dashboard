@echo off
setlocal EnableDelayedExpansion

set SCRIPT_DIR=%~dp0

:: Check for required files
if not exist "%SCRIPT_DIR%dashboard.jar" (
    echo Error: dashboard.jar not found!
    echo Run build.bat first to create the bundle.
    exit /b 1
)

if not exist "%SCRIPT_DIR%cli-server" (
    echo Error: cli-server directory not found!
    echo Run build.bat first to create the bundle.
    exit /b 1
)

:: Check for Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Error: Node.js is required but not installed.
    echo Please install Node.js from https://nodejs.org/
    exit /b 1
)

:: Check for Java
where java >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Error: Java is required but not installed.
    echo Please install Java 17+ from https://adoptium.net/
    exit /b 1
)

echo ========================================
echo   Observability Forge Dashboard
echo ========================================
echo.

:: Start CLI proxy server
echo Starting CLI proxy server on port 3001...
cd /d "%SCRIPT_DIR%cli-server"
start /b node index.js

:: Wait a moment
timeout /t 2 /nobreak >nul

:: Start Dashboard (Spring Boot)
echo Starting Dashboard on port 8080...
cd /d "%SCRIPT_DIR%"

echo.
echo ========================================
echo   Services Running
echo ========================================
echo.
echo   Dashboard:   http://localhost:8080
echo   CLI Proxy:   http://localhost:3001
echo.
echo Press Ctrl+C to stop
echo.

java ^
    -Dspring.kafka.bootstrap-servers= ^
    -Dspring.cloud.stream.kafka.binder.brokers= ^
    -Dhealth-monitor.scheduler.enabled=false ^
    -jar "%SCRIPT_DIR%dashboard.jar" ^
    %*

endlocal
