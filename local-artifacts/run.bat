@echo off
setlocal

set SCRIPT_DIR=%~dp0
set JAR_PATH=%SCRIPT_DIR%dashboard.jar

if not exist "%JAR_PATH%" (
    echo JAR not found. Running build first...
    call "%SCRIPT_DIR%build.bat"
)

echo ========================================
echo   Starting Dashboard
echo ========================================
echo.
echo Open in browser: http://localhost:3001
echo.

:: Run with sensible defaults - disable external services that may not be available
java ^
    -Dspring.kafka.bootstrap-servers= ^
    -Dspring.cloud.stream.kafka.binder.brokers= ^
    -Dhealth-monitor.scheduler.enabled=false ^
    -jar "%JAR_PATH%" ^
    %*

endlocal
