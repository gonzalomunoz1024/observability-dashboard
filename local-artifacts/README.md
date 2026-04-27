# Dashboard Local Bundle

Run the complete dashboard application (frontend + backend) from a single JAR file.

## Requirements

- **Java 17+** - Required to run the application
- **Node.js 18+** - Required only for building
- **npm** - Required only for building

## Quick Start

### macOS / Linux

```bash
# Build and run (first time)
./build.sh
./run.sh

# Or just run (will build if JAR doesn't exist)
./run.sh
```

### Windows

```batch
# Build and run (first time)
build.bat
run.bat

# Or just run (will build if JAR doesn't exist)
run.bat
```

## Access the Application

Once running, open your browser to: **http://localhost:3001**

## What Gets Built

The build process:
1. Builds the React frontend into optimized static files
2. Bundles the static files into the Spring Boot JAR
3. Produces a single `dashboard.jar` that serves both frontend and API

## Configuration

You can pass additional Java options or Spring properties:

```bash
# Change port
./run.sh --server.port=8080

# Enable Kafka (if you have it running)
./run.sh -Dspring.kafka.bootstrap-servers=localhost:9092

# Enable health monitoring
./run.sh -Dhealth-monitor.scheduler.enabled=true
```

## Distribution

To share with others, they only need:
- `dashboard.jar` - The bundled application
- **Java 17+** installed

They can run it with:
```bash
java -jar dashboard.jar
```

## Troubleshooting

**Port already in use:**
```bash
./run.sh --server.port=8080
```

**Kafka connection errors:**
These are disabled by default in run.sh. If you see warnings, they can be ignored.

**Frontend not loading:**
Make sure the build completed successfully. Check that `src/main/resources/static/index.html` exists in the backend after building.
