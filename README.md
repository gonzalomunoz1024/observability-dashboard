# Observability Forge Dashboard - Local Bundle

Run the complete dashboard application from a single command.

## Requirements

- **Java 17+** - Required to run the dashboard
- **Node.js 18+** - Required for CLI test execution
- **npm** - Required for building and CLI server

## Quick Start

### macOS / Linux

```bash
# Build (first time only)
./build.sh

# Run
./run.sh
```

### Windows

```batch
# Build (first time only)
build.bat

# Run
run.bat
```

## Access the Application

Once running, open your browser to: **http://localhost:8080**

Two services will be started:
- **Dashboard** (port 8080) - The main web application
- **CLI Proxy** (port 3001) - Handles CLI test execution with live output streaming

## What Gets Built

The build process creates:
1. `dashboard.jar` - Spring Boot application with bundled React frontend
2. `cli-server/` - Node.js server for CLI test execution

## Distribution

To share with others, give them the entire `local-artifacts` folder containing:
- `dashboard.jar`
- `cli-server/` directory
- `run.sh` / `run.bat`

Requirements for recipients:
- **Java 17+** - [Download from Adoptium](https://adoptium.net/)
- **Node.js 18+** - [Download from nodejs.org](https://nodejs.org/)

## Configuration

You can pass additional Java options:

```bash
# Change dashboard port
./run.sh --server.port=9090

# Enable Kafka (if available)
./run.sh -Dspring.kafka.bootstrap-servers=localhost:9092

# Enable health monitoring
./run.sh -Dhealth-monitor.scheduler.enabled=true
```

## Troubleshooting

**Port already in use:**
```bash
./run.sh --server.port=9090
```

**CLI tests not working:**
Make sure Node.js is installed and the `cli-server` directory exists.

**Kafka connection errors:**
These are disabled by default and can be ignored.
