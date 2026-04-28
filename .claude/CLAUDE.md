# Claude Code Memory

## Project: Observability Forge Dashboard

### Post-Fix Workflow

After making any fix or change to the codebase, always follow this workflow:

1. **Rebuild local-artifacts**
   ```bash
   cd /Applications/repos/dashboard/local-artifacts && ./build.sh
   ```

2. **Commit the changes**
   ```bash
   git add .
   git commit -m "fix: <description of the fix>"
   ```

3. **Push to main**
   ```bash
   git push origin main
   ```

### Project Structure

- **Frontend**: `/Applications/repos/dashboard/frontend` (React)
- **Backend**: `/Applications/repos/dashboard/backend` (Spring Boot)
- **Local Artifacts**: `/Applications/repos/dashboard/local-artifacts` (bundled distribution)
  - `build.sh` - Builds frontend, backend, and bundles CLI proxy server
  - `run.sh` - Starts both Dashboard (port 8080) and CLI Proxy (port 3001)
  - `cli-server/` - Node.js CLI proxy server for executing CLI tests

### Key Components

- **CLI Panel**: `/frontend/src/components/CLI/` - CLI testing dashboard
- **Workflow Storage**: `/frontend/src/utils/workflowStorage.js` - Test suite persistence
- **Workflow Formatter**: `/frontend/src/utils/workflowFormatter.js` - Formats workflows for server execution
- **CLI Proxy Server**: `/frontend/server/index.js` - Executes CLI commands with SSE streaming

### Common Issues & Fixes

- **Port conflicts**: Kill processes on 3001/8080 before starting: `lsof -ti:3001,8080 | xargs kill -9`
- **Args/stdinInputs format**: Server expects strings, not arrays. Don't split in formatter.
- **Variable interpolation**: Use `{{varName}}` syntax. Server handles substitution.
