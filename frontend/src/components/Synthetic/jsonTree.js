// Shared helpers for building / evaluating JSONPath strings against a parsed
// JSON object — used by both IdPathPicker and TerminalPathPicker.

const SAFE_KEY = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

export function buildPath(segments) {
  let out = '$';
  for (const seg of segments) {
    if (typeof seg === 'number') {
      out += `[${seg}]`;
    } else if (SAFE_KEY.test(seg)) {
      out += `.${seg}`;
    } else {
      out += `['${String(seg).replace(/'/g, "\\'")}']`;
    }
  }
  return out;
}

export function evaluatePath(value, path) {
  if (!path || !path.startsWith('$')) return { error: 'Path must start with $' };
  const tokens = [];
  let i = 1;
  while (i < path.length) {
    const c = path[i];
    if (c === '.') {
      let end = i + 1;
      while (end < path.length && !'.[]'.includes(path[end])) end++;
      const key = path.slice(i + 1, end);
      if (!key) return { error: `Empty key at position ${i}` };
      tokens.push(key);
      i = end;
    } else if (c === '[') {
      const close = path.indexOf(']', i);
      if (close === -1) return { error: 'Missing closing ]' };
      const inner = path.slice(i + 1, close).trim();
      if (inner.startsWith("'") && inner.endsWith("'")) tokens.push(inner.slice(1, -1));
      else if (inner.startsWith('"') && inner.endsWith('"')) tokens.push(inner.slice(1, -1));
      else if (/^-?\d+$/.test(inner)) tokens.push(parseInt(inner, 10));
      else return { error: `Invalid index: ${inner}` };
      i = close + 1;
    } else {
      return { error: `Unexpected character '${c}' at ${i}` };
    }
  }

  let cur = value;
  for (const t of tokens) {
    if (cur == null) return { error: 'Path went past null' };
    if (typeof t === 'number') {
      if (!Array.isArray(cur)) return { error: `Expected array at [${t}]` };
      cur = cur[t];
    } else {
      if (typeof cur !== 'object' || Array.isArray(cur)) {
        return { error: `Expected object at .${t}` };
      }
      cur = cur[t];
    }
  }
  return { value: cur };
}

export function valuePreview(value) {
  if (value === null) return 'null';
  if (value === undefined) return '—';
  if (typeof value === 'string') return `"${value}"`;
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (typeof value === 'object') return `{ ${Object.keys(value).length} keys }`;
  return String(value);
}

/** Quote a value for use as a "raw" terminal value input (drops the quotes). */
export function valueAsTerminal(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return String(value);
}
