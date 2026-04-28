const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Create uploads directory
const uploadsDir = path.join(os.tmpdir(), 'cli-test-uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// Store active SSE connections
const activeStreams = new Map();

// Upload executable endpoint
app.post('/api/cli/executable/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const filePath = req.file.path;

  // Make executable on Unix systems
  try {
    fs.chmodSync(filePath, '755');
  } catch (e) {
    console.warn('Could not set executable permissions:', e.message);
  }

  res.json({
    path: filePath,
    name: req.file.originalname,
    size: req.file.size
  });
});

// Helper to interpolate variables in a string
function interpolateVariables(str, variables) {
  if (!str || typeof str !== 'string') return str;
  return str.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    return variables[varName] !== undefined ? variables[varName] : match;
  });
}

// Run a single command step
async function runCommandStep(step, executablePath, workDir, variables, onOutput) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';

    // Interpolate variables in args
    const args = interpolateVariables(step.args || '', variables);
    const argsArray = args.split(/\s+/).filter(a => a);

    onOutput({ type: 'info', message: `Running: ${executablePath} ${args}` });

    const proc = spawn(executablePath, argsArray, {
      cwd: workDir,
      env: { ...process.env, ...parseEnvVars(step.envVars) },
      timeout: step.timeout || 30000
    });

    proc.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      onOutput({ type: 'stdout', data: text });
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      onOutput({ type: 'stderr', data: text });
    });

    // Handle stdin inputs if configured
    if (step.stdinInputs) {
      // Interpolate variables in stdin inputs
      const interpolatedInputs = interpolateVariables(step.stdinInputs, variables);
      const inputs = interpolatedInputs.split('\n').filter(line => line !== '');
      let inputIndex = 0;

      onOutput({ type: 'info', message: `Sending ${inputs.length} stdin input(s)` });

      const sendInput = () => {
        if (inputIndex < inputs.length) {
          setTimeout(() => {
            const input = inputs[inputIndex];
            onOutput({ type: 'stdin', data: `> ${input}` });
            proc.stdin.write(input + '\n');
            inputIndex++;
            sendInput();
          }, step.stdinDelay || 100);
        }
      };
      sendInput();
    }

    proc.on('close', (code) => {
      const duration = Date.now() - startTime;
      const exitCode = code ?? -1;

      // Run validations
      const validations = [];
      const expectations = step.expectations || {};

      // Exit code validation
      const expectedExitCode = expectations.exitCode ?? 0;
      validations.push({
        type: 'exitCode',
        expected: expectedExitCode,
        actual: exitCode,
        passed: exitCode === expectedExitCode
      });

      // Stderr empty validation
      if (expectations.stderrEmpty) {
        validations.push({
          type: 'stderrEmpty',
          expected: true,
          actual: stderr.length === 0,
          passed: stderr.length === 0
        });
      }

      // Assertions
      if (expectations.assertions) {
        expectations.assertions.forEach(assertion => {
          const source = assertion.source === 'stderr' ? stderr : stdout;
          let passed = false;

          if (assertion.type === 'contains') {
            passed = source.includes(assertion.value);
          } else if (assertion.type === 'regex') {
            try {
              passed = new RegExp(assertion.value).test(source);
            } catch (e) {
              passed = false;
            }
          }

          validations.push({
            type: `${assertion.source}${assertion.type === 'regex' ? 'Regex' : 'Contains'}`,
            expected: assertion.value,
            passed
          });
        });
      }

      const allPassed = validations.every(v => v.passed);

      resolve({
        id: step.id,
        name: step.name || step.id,
        args,
        exitCode,
        stdout,
        stderr,
        duration,
        passed: allPassed,
        validations
      });
    });

    proc.on('error', (err) => {
      onOutput({ type: 'error', message: err.message });
      resolve({
        id: step.id,
        name: step.name || step.id,
        args: step.args,
        exitCode: -1,
        stdout,
        stderr,
        error: err.message,
        duration: Date.now() - startTime,
        passed: false,
        validations: []
      });
    });
  });
}

// Parse environment variables string
function parseEnvVars(envVarsString) {
  if (!envVarsString) return {};
  const env = {};
  envVarsString.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      env[key.trim()] = valueParts.join('=').trim();
    }
  });
  return env;
}

// SSE endpoint for streaming workflow execution
app.post('/api/cli/workflow/stream', async (req, res) => {
  const workflow = req.body;
  const streamId = uuidv4();

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Stream-Id', streamId);
  res.flushHeaders();

  activeStreams.set(streamId, res);

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const executablePath = workflow.executable;
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-workflow-'));
    const variables = { workDir, ...(workflow.variables || {}) };
    const steps = workflow.steps || [];
    const results = [];

    sendEvent('start', { workDir, totalSteps: steps.length });

    // Run setup commands
    if (workflow.setupCommands?.length > 0) {
      sendEvent('setup', { message: 'Running setup commands...' });
      for (const cmd of workflow.setupCommands) {
        const setupResult = await runCommandStep(
          { id: 'setup', name: cmd.name || 'Setup', args: cmd.command, timeout: cmd.timeout || 60000 },
          '/bin/sh',
          workDir,
          variables,
          (output) => sendEvent('output', { stepId: 'setup', ...output })
        );
        if (!setupResult.passed && !cmd.continueOnError) {
          throw new Error(`Setup command failed: ${cmd.command}`);
        }
      }
    }

    // Run workflow steps
    for (const step of steps) {
      sendEvent('stepStart', { stepId: step.id, name: step.name || step.id });

      const result = await runCommandStep(
        step,
        executablePath,
        workDir,
        variables,
        (output) => sendEvent('output', { stepId: step.id, ...output })
      );

      results.push(result);

      // Capture variables from output
      if (step.capture) {
        step.capture.forEach(cap => {
          if (cap.varName && cap.regex) {
            try {
              const match = result.stdout.match(new RegExp(cap.regex));
              if (match && match[1]) {
                variables[cap.varName] = match[1];
                sendEvent('capture', { varName: cap.varName, value: match[1] });
              }
            } catch (e) {
              console.warn('Capture regex error:', e.message);
            }
          }
        });
      }

      sendEvent('stepComplete', { stepId: step.id, result });

      // Stop on failure unless configured otherwise
      if (!result.passed && !step.continueOnError) {
        break;
      }
    }

    const allPassed = results.every(r => r.passed);

    sendEvent('complete', {
      passed: allPassed,
      results,
      summary: {
        total: results.length,
        passed: results.filter(r => r.passed).length,
        failed: results.filter(r => !r.passed).length
      }
    });

    // Cleanup
    try {
      fs.rmSync(workDir, { recursive: true, force: true });
    } catch (e) {
      console.warn('Cleanup error:', e.message);
    }

  } catch (err) {
    sendEvent('error', { message: err.message });
  } finally {
    activeStreams.delete(streamId);
    res.end();
  }
});

// Regular workflow endpoint (non-streaming, for backward compatibility)
app.post('/api/cli/workflow', async (req, res) => {
  const workflow = req.body;

  try {
    const executablePath = workflow.executable;
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-workflow-'));
    const variables = { workDir, ...(workflow.variables || {}) };
    const steps = workflow.steps || [];
    const results = [];

    // Run setup commands
    if (workflow.setupCommands?.length > 0) {
      for (const cmd of workflow.setupCommands) {
        const setupResult = await runCommandStep(
          { id: 'setup', name: cmd.name || 'Setup', args: cmd.command, timeout: cmd.timeout || 60000 },
          '/bin/sh',
          workDir,
          variables,
          () => {} // No streaming for regular endpoint
        );
        if (!setupResult.passed && !cmd.continueOnError) {
          throw new Error(`Setup command failed: ${cmd.command}`);
        }
      }
    }

    // Run workflow steps
    for (const step of steps) {
      const result = await runCommandStep(
        step,
        executablePath,
        workDir,
        variables,
        () => {} // No streaming
      );

      results.push(result);

      // Capture variables
      if (step.capture) {
        step.capture.forEach(cap => {
          if (cap.varName && cap.regex) {
            try {
              const match = result.stdout.match(new RegExp(cap.regex));
              if (match && match[1]) {
                variables[cap.varName] = match[1];
              }
            } catch (e) {
              console.warn('Capture regex error:', e.message);
            }
          }
        });
      }

      if (!result.passed && !step.continueOnError) {
        break;
      }
    }

    // Cleanup
    try {
      fs.rmSync(workDir, { recursive: true, force: true });
    } catch (e) {
      console.warn('Cleanup error:', e.message);
    }

    const allPassed = results.every(r => r.passed);

    res.json({
      passed: allPassed,
      steps: results,
      summary: {
        total: results.length,
        passed: results.filter(r => r.passed).length,
        failed: results.filter(r => !r.passed).length
      }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`CLI Proxy Server running on http://localhost:${PORT}`);
  console.log(`Uploads directory: ${uploadsDir}`);
});
