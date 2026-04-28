#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check for required files
if [ ! -f "$SCRIPT_DIR/dashboard.jar" ]; then
    echo -e "${RED}Error: dashboard.jar not found!${NC}"
    echo -e "Run ${YELLOW}./build.sh${NC} first to create the bundle."
    exit 1
fi

if [ ! -d "$SCRIPT_DIR/cli-server" ]; then
    echo -e "${RED}Error: cli-server directory not found!${NC}"
    echo -e "Run ${YELLOW}./build.sh${NC} first to create the bundle."
    exit 1
fi

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is required but not installed.${NC}"
    echo -e "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Check for Java
if ! command -v java &> /dev/null; then
    echo -e "${RED}Error: Java is required but not installed.${NC}"
    echo -e "Please install Java 17+ from https://adoptium.net/"
    exit 1
fi

# PIDs for cleanup
CLI_SERVER_PID=""
DASHBOARD_PID=""

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}Shutting down...${NC}"

    if [ -n "$CLI_SERVER_PID" ]; then
        kill $CLI_SERVER_PID 2>/dev/null
        wait $CLI_SERVER_PID 2>/dev/null
    fi

    if [ -n "$DASHBOARD_PID" ]; then
        kill $DASHBOARD_PID 2>/dev/null
        wait $DASHBOARD_PID 2>/dev/null
    fi

    echo -e "${GREEN}Stopped.${NC}"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Observability Forge Dashboard${NC}"
echo -e "${GREEN}========================================${NC}"

# Start CLI proxy server
echo -e "\n${CYAN}Starting CLI proxy server on port 3001...${NC}"
cd "$SCRIPT_DIR/cli-server"
node index.js &
CLI_SERVER_PID=$!

# Wait a moment for CLI server to start
sleep 1

# Check if CLI server started
if ! kill -0 $CLI_SERVER_PID 2>/dev/null; then
    echo -e "${RED}Failed to start CLI proxy server!${NC}"
    exit 1
fi

# Start Dashboard (Spring Boot)
echo -e "${CYAN}Starting Dashboard on port 8080...${NC}"
cd "$SCRIPT_DIR"
java \
    -Dspring.kafka.bootstrap-servers= \
    -Dspring.cloud.stream.kafka.binder.brokers= \
    -Dhealth-monitor.scheduler.enabled=false \
    -jar dashboard.jar \
    "$@" &
DASHBOARD_PID=$!

# Wait for dashboard to start
echo -e "\n${YELLOW}Waiting for services to start...${NC}"
sleep 3

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  Services Running${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "\n  Dashboard:   ${CYAN}http://localhost:8080${NC}"
echo -e "  CLI Proxy:   ${CYAN}http://localhost:3001${NC}"
echo -e "\n${YELLOW}Press Ctrl+C to stop${NC}\n"

# Wait for either process to exit
wait $DASHBOARD_PID $CLI_SERVER_PID
