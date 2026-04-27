#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JAR_PATH="$SCRIPT_DIR/dashboard.jar"

if [ ! -f "$JAR_PATH" ]; then
    echo -e "${YELLOW}JAR not found. Running build first...${NC}"
    "$SCRIPT_DIR/build.sh"
fi

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Starting Dashboard${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "\nOpen in browser: ${YELLOW}http://localhost:3001${NC}\n"

# Run with sensible defaults - disable external services that may not be available
java \
    -Dspring.kafka.bootstrap-servers= \
    -Dspring.cloud.stream.kafka.binder.brokers= \
    -Dhealth-monitor.scheduler.enabled=false \
    -jar "$JAR_PATH" \
    "$@"
