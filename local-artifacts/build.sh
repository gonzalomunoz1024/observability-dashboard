#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Dashboard Local Bundle Builder${NC}"
echo -e "${GREEN}========================================${NC}"

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

FRONTEND_DIR="$PROJECT_ROOT/frontend"
BACKEND_DIR="$PROJECT_ROOT/backend"
SERVER_DIR="$PROJECT_ROOT/frontend/server"
OUTPUT_DIR="$SCRIPT_DIR"

# Clean previous static resources
echo -e "\n${YELLOW}[1/6] Cleaning previous build...${NC}"
rm -rf "$BACKEND_DIR/src/main/resources/static"
mkdir -p "$BACKEND_DIR/src/main/resources/static"

# Build React frontend
echo -e "\n${YELLOW}[2/6] Building React frontend...${NC}"
cd "$FRONTEND_DIR"

# Set API URL to localhost:3001 for CLI proxy
export REACT_APP_PROXY_URL="http://localhost:3001"
npm install --silent
npm run build

# Copy frontend build to backend static resources
echo -e "\n${YELLOW}[3/6] Copying frontend build to backend...${NC}"
cp -r "$FRONTEND_DIR/build/"* "$BACKEND_DIR/src/main/resources/static/"

# Build Spring Boot JAR
echo -e "\n${YELLOW}[4/6] Building Spring Boot JAR...${NC}"
cd "$BACKEND_DIR"
./gradlew clean bootJar --warning-mode=none

# Copy JAR to output directory
echo -e "\n${YELLOW}[5/6] Copying JAR to local-artifacts...${NC}"
cp "$BACKEND_DIR/build/libs/"*.jar "$OUTPUT_DIR/dashboard.jar"

# Bundle CLI proxy server
echo -e "\n${YELLOW}[6/6] Bundling CLI proxy server...${NC}"
rm -rf "$OUTPUT_DIR/cli-server"
mkdir -p "$OUTPUT_DIR/cli-server"
cp "$SERVER_DIR/package.json" "$OUTPUT_DIR/cli-server/"
cp "$SERVER_DIR/index.js" "$OUTPUT_DIR/cli-server/"
cd "$OUTPUT_DIR/cli-server"
npm install --silent --production

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  Build complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "\nOutput:"
echo -e "  - ${YELLOW}$OUTPUT_DIR/dashboard.jar${NC}"
echo -e "  - ${YELLOW}$OUTPUT_DIR/cli-server/${NC}"
echo -e "\nTo run: ${YELLOW}./run.sh${NC}"
echo ""
