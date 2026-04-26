// Shared workflow formatting utilities

/**
 * Substitute {{varName}} placeholders with actual values
 * @param {string} text - Text containing {{varName}} placeholders
 * @param {Object} variables - Map of variable names to values
 * @returns {string} - Text with placeholders replaced
 */
export function substituteVariables(text, variables = {}) {
  if (!text || typeof text !== 'string') return text;
  return text.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    return variables.hasOwnProperty(varName) ? variables[varName] : match;
  });
}

/**
 * Recursively substitute variables in an object
 * @param {any} obj - Object, array, or string to process
 * @param {Object} variables - Map of variable names to values
 * @returns {any} - Object with all string values having placeholders replaced
 */
function substituteInObject(obj, variables) {
  if (!obj) return obj;
  if (typeof obj === 'string') {
    return substituteVariables(obj, variables);
  }
  if (Array.isArray(obj)) {
    return obj.map(item => substituteInObject(item, variables));
  }
  if (typeof obj === 'object') {
    const result = {};
    for (const key of Object.keys(obj)) {
      result[key] = substituteInObject(obj[key], variables);
    }
    return result;
  }
  return obj;
}

export function formatWorkflowForExecution(workflow, executable, runtimeVariables = {}) {
  // Build variables map: workflow defaults merged with runtime overrides
  const variables = {};

  // Start with workflow-defined variable defaults
  if (Array.isArray(workflow.variables)) {
    workflow.variables.forEach(v => {
      if (v.name) {
        variables[v.name] = v.defaultValue || '';
      }
    });
  }

  // Override with runtime variables
  Object.assign(variables, runtimeVariables);

  const env = workflow.envVars
    ? Object.fromEntries(
        workflow.envVars.split('\n').filter(Boolean).map((line) => {
          const [key, ...vals] = line.split('=');
          return [key.trim(), vals.join('=').trim()];
        })
      )
    : undefined;

  // Format setup commands (vendor CLI logins, etc.)
  const setupCommands = workflow.setupCommands?.length > 0
    ? workflow.setupCommands.map((cmd, i) => ({
        id: `setup-${i + 1}`,
        name: `${cmd.executable} ${cmd.args || ''}`.trim(),
        executable: cmd.executable,
        args: cmd.args ? cmd.args.split(' ').filter(Boolean) : [],
        stdinInputs: cmd.stdinInputs ? cmd.stdinInputs.split('\\n').filter(Boolean) : undefined,
        timeout: cmd.timeout || 60000,
      }))
    : undefined;

  // Build a map of variable -> step that captures it
  const variableToStep = {};
  workflow.steps.forEach((step) => {
    if (Array.isArray(step.capture)) {
      step.capture.forEach(c => {
        if (c.varName) variableToStep[c.varName] = step.id;
      });
    }
    if (Array.isArray(step.artifacts)) {
      step.artifacts.forEach(a => {
        if (a.varName) variableToStep[a.varName] = step.id;
      });
    }
    if (Array.isArray(step.http?.capture)) {
      step.http.capture.forEach(c => {
        if (c.varName) variableToStep[c.varName] = step.id;
      });
    }
  });

  // Find all {{variable}} references in a step's fields
  const findVariableUsage = (step) => {
    const text = JSON.stringify(step);
    const matches = text.match(/\{\{(\w+)\}\}/g) || [];
    return [...new Set(matches.map(m => m.slice(2, -2)))];
  };

  // Auto-detect dependencies based on variable usage
  const getAutoDependencies = (step) => {
    const usedVars = findVariableUsage(step);
    const deps = new Set();

    if (step.dependsOn) {
      step.dependsOn.split(',').map(s => s.trim()).filter(Boolean).forEach(d => deps.add(d));
    }

    usedVars.forEach(varName => {
      const sourceStep = variableToStep[varName];
      if (sourceStep && sourceStep !== step.id) {
        deps.add(sourceStep);
      }
    });

    return deps.size > 0 ? [...deps] : undefined;
  };

  const result = {
    name: workflow.name,
    env,
    steps: workflow.steps.map((step) => {
      const autoDeps = getAutoDependencies(step);

      // HTTP steps
      if (step.type === 'http') {
        return {
          id: step.id,
          name: step.name || step.id,
          type: 'http',
          timeout: step.timeout,
          dependsOn: autoDeps,
          http: {
            method: step.http?.method || 'GET',
            url: step.http?.url || '',
            headers: step.http?.headers ? parseHeaders(step.http.headers) : undefined,
            body: step.http?.body || undefined,
            polling: step.http?.polling?.enabled ? {
              enabled: true,
              intervalSeconds: step.http.polling.intervalSeconds || 30,
              maxDurationMinutes: step.http.polling.maxDurationMinutes || 60,
            } : undefined,
            expect: {
              statusCode: step.http?.expect?.statusCode || 200,
              bodyContains: step.http?.expect?.bodyContains || undefined,
              jsonPath: step.http?.expect?.jsonPath || undefined,
            },
            capture: parseHttpCapture(step.http?.capture),
          },
        };
      }

      // Command steps
      return {
        id: step.id,
        name: step.name || step.id,
        executable,
        args: step.args ? step.args.split(' ').filter(Boolean) : [],
        timeout: step.timeout,
        dependsOn: autoDeps,
        stdinInputs: step.stdinInputs ? step.stdinInputs.split('\n').filter(Boolean) : undefined,
        stdinDelay: step.stdinDelay,
        expectations: buildExpectations(step.expectations),
        capture: step.capture ? parseCapture(step.capture) : undefined,
        artifacts: step.artifacts ? parseArtifacts(step.artifacts) : undefined,
      };
    }),
  };

  if (setupCommands && setupCommands.length > 0) {
    result.setupCommands = setupCommands;
  }

  // Apply variable substitution to all string fields
  return substituteInObject(result, variables);
}

function parseHeaders(headersStr) {
  if (!headersStr) return undefined;
  try {
    const result = {};
    headersStr.split('\n').filter(Boolean).forEach(line => {
      const [key, ...vals] = line.split(':');
      if (key) result[key.trim()] = vals.join(':').trim();
    });
    return Object.keys(result).length > 0 ? result : undefined;
  } catch {
    return undefined;
  }
}

function parseHttpCapture(captureArr) {
  if (!Array.isArray(captureArr) || captureArr.length === 0) return undefined;
  try {
    const result = {};
    captureArr.forEach((item) => {
      if (item.varName && item.jsonPath) {
        result[item.varName] = { source: 'body', jsonPath: item.jsonPath };
      }
    });
    return Object.keys(result).length > 0 ? result : undefined;
  } catch {
    return undefined;
  }
}

function buildExpectations(expectations) {
  if (!expectations) return undefined;

  const result = {
    exitCode: expectations.exitCode !== '' && expectations.exitCode !== undefined
      ? parseInt(expectations.exitCode, 10)
      : undefined,
    stderrEmpty: expectations.stderrEmpty || undefined,
  };

  const assertions = Array.isArray(expectations.assertions) ? expectations.assertions : [];

  const stdoutContainsValues = assertions
    .filter(a => a.source === 'stdout' && a.type === 'contains' && a.value?.trim())
    .map(a => a.value.trim());
  if (stdoutContainsValues.length > 0) {
    result.stdoutContains = stdoutContainsValues;
  }

  const stdoutRegex = assertions.find(a => a.source === 'stdout' && a.type === 'regex' && a.value);
  if (stdoutRegex) {
    result.stdoutMatches = stdoutRegex.value;
  }

  const stderrContainsValues = assertions
    .filter(a => a.source === 'stderr' && a.type === 'contains' && a.value?.trim())
    .map(a => a.value.trim());
  if (stderrContainsValues.length > 0) {
    result.stderrContains = stderrContainsValues;
  }

  // Legacy format support
  if (expectations.stdoutContains && !result.stdoutContains) {
    result.stdoutContains = expectations.stdoutContains.split(',').map(s => s.trim()).filter(Boolean);
  }
  if (expectations.stdoutMatches && !result.stdoutMatches) {
    result.stdoutMatches = expectations.stdoutMatches;
  }
  if (expectations.stderrContains && !result.stderrContains) {
    result.stderrContains = expectations.stderrContains.split(',').map(s => s.trim()).filter(Boolean);
  }

  Object.keys(result).forEach(key => {
    if (result[key] === undefined || (Array.isArray(result[key]) && result[key].length === 0)) {
      delete result[key];
    }
  });

  return Object.keys(result).length > 0 ? result : undefined;
}

function parseCapture(captureArr) {
  if (!Array.isArray(captureArr) || captureArr.length === 0) return undefined;
  try {
    const result = {};
    captureArr.forEach((item) => {
      if (item.varName && item.regex) {
        result[item.varName] = { source: item.source || 'stdout', regex: item.regex };
      }
    });
    return Object.keys(result).length > 0 ? result : undefined;
  } catch {
    return undefined;
  }
}

function parseArtifacts(artifactsArr) {
  if (!Array.isArray(artifactsArr) || artifactsArr.length === 0) return undefined;
  try {
    return artifactsArr.filter(item => item.path).map((item) => ({
      varName: item.varName || undefined,
      path: item.path,
      exists: true,
      contains: item.contains ? item.contains.split(',').map((s) => s.trim()) : undefined,
      yamlValid: item.yamlValid || false,
      jsonValid: item.jsonValid || false,
      isDirectory: item.isDirectory || false,
    }));
  } catch {
    return undefined;
  }
}
