# mycli

A CLI tool for generating test suite configurations with `catalog.yaml` and `spec.yaml` files.

## Installation

### Option 1: Standalone Executable (No Node.js Required)

Download the appropriate executable for your platform from the `dist/` folder:

| Platform | File |
|----------|------|
| Windows | `mycli-win.exe` |
| macOS | `mycli-macos` |
| Linux | `mycli-linux` |

Make the file executable (macOS/Linux):
```bash
chmod +x mycli-macos  # or mycli-linux
```

### Option 2: From Source (Requires Node.js)

```bash
cd test
npm install
npm link  # Makes 'mycli' available globally
```

## Commands

### `mycli init <name>`

Initializes a new test suite directory with configuration files.

```bash
mycli init test_suite_001
```

**Interactive Prompts:**

| Prompt | Description |
|--------|-------------|
| App ID | Application identifier |
| Image Name | Container image name |
| Selection (1-6) | Configuration level selection |
| Playbook URL | URL to the playbook repository |
| Branch | Git branch name (default: main) |
| File Name | Entry point file name |

**Output:**
```
test_suite_001/
├── catalog.yaml
└── spec.yaml
```

### `mycli build <directory>`

Reads and prints the contents of a test suite directory.

```bash
mycli build test_suite_001
```

**Output:**
```
=== Building: test_suite_001 ===

--- catalog.yaml ---
apiVersion: v1
kind: Catalog
...

--- spec.yaml ---
apiVersion: v1
kind: Spec
...

=== Build complete ===
```

## Generated Files

### catalog.yaml

```yaml
apiVersion: v1
kind: Catalog
metadata:
  name: test_suite_001
  appId: my-app
spec:
  image: my-image:latest
  selection: 3
  playbook:
    url: https://github.com/org/repo
    branch: main
    fileName: playbook.yaml
```

### spec.yaml

```yaml
apiVersion: v1
kind: Spec
metadata:
  name: test_suite_001
  createdAt: '2024-01-15T10:30:00.000Z'
configuration:
  appId: my-app
  image: my-image:latest
  level: 3
source:
  repository: https://github.com/org/repo
  branch: main
  entrypoint: playbook.yaml
```

## Building Executables

To build standalone executables for distribution:

```bash
# All platforms
npm run build:all

# Single platform
npm run build:win     # Windows
npm run build:mac     # macOS
npm run build:linux   # Linux
```

Executables are output to the `dist/` folder.

## Project Structure

```
test/
├── bin/
│   └── mycli.js        # CLI entry point
├── commands/
│   ├── init.js         # Init command implementation
│   └── build.js        # Build command implementation
├── dist/               # Compiled executables
├── package.json
└── README.md
```

## Requirements

- Node.js 18+ (for development only)
- No dependencies required for standalone executables

## License

ISC
