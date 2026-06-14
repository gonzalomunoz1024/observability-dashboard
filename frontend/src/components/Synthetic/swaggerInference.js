// Heuristics that infer a synthetic transaction's chain from an OpenAPI spec.

const STATUS_ALIASES = ['status', 'state', 'phase', 'lifecycle'];

const TERMINAL_RE = /^(completed?|complete|success(ful)?|done|finished|finalized|ok|active|ready|delivered|approved)$/i;
const INTERMEDIATE_RE = /^(pending|in[_-]?progress|processing|queued|started|created|new|waiting|running|submitted|received)$/i;

export function pickServerBase(spec) {
  const url = spec?.servers?.[0];
  if (!url) return '';
  return url.replace(/\/+$/, '');
}

export function buildPathUrl(base, path) {
  if (!path) return base;
  return base + (path.startsWith('/') ? path : `/${path}`);
}

/** Replace only the named path parameter with {{id}}, leave the rest literal. */
export function substituteChainParam(path, paramName) {
  if (!paramName) return path;
  return path.replace(`{${paramName}}`, '{{id}}');
}

function fieldMatches(field, candidate) {
  const a = field.path.toLowerCase();
  const b = candidate.toLowerCase();
  return a === b || a.endsWith(`.${b}`);
}

/** Find a field that looks like a status indicator. Enum-bearing fields win. */
export function findStatusField(fields) {
  if (!Array.isArray(fields) || fields.length === 0) return null;
  for (const alias of STATUS_ALIASES) {
    const enumed = fields.find((f) => f.enumValues?.length && fieldMatches(f, alias));
    if (enumed) return enumed;
  }
  for (const alias of STATUS_ALIASES) {
    const plain = fields.find((f) => fieldMatches(f, alias));
    if (plain) return plain;
  }
  return fields.find((f) => f.enumValues?.length) || null;
}

/** Pick a "done" value from a status enum. Prefers obviously-terminal names. */
export function pickTerminalValue(enumValues) {
  if (!Array.isArray(enumValues) || enumValues.length === 0) return '';
  const terminal = enumValues.find((v) => TERMINAL_RE.test(String(v)));
  if (terminal) return String(terminal);
  const nonIntermediate = enumValues.filter((v) => !INTERMEDIATE_RE.test(String(v)));
  if (nonIntermediate.length) return String(nonIntermediate[nonIntermediate.length - 1]);
  return String(enumValues[enumValues.length - 1]);
}

function camelToSnake(s) {
  return s.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}

function snakeToCamel(s) {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/** Generate the candidate names we'd consider equivalent to a path param. */
export function idCandidates(paramName) {
  if (!paramName) return [];
  const out = new Set([paramName, paramName.toLowerCase()]);
  out.add(camelToSnake(paramName));
  out.add(snakeToCamel(paramName));
  // `orderId` → also try `id` and `orderID`
  if (/id$/i.test(paramName)) {
    out.add('id');
    const base = paramName.replace(/id$/i, '');
    if (base) out.add(`${base}Id`);
  }
  return Array.from(out).filter(Boolean);
}

/** Locate the field in the start-op response that satisfies the probe's path param. */
export function findIdField(paramName, startResponseFields) {
  if (!paramName || !Array.isArray(startResponseFields)) return null;
  for (const candidate of idCandidates(paramName)) {
    const match = startResponseFields.find((f) => fieldMatches(f, candidate));
    if (match) return match;
  }
  // Last-ditch: any string field literally called "id"
  return startResponseFields.find((f) => fieldMatches(f, 'id')) || null;
}

function okResponse(op) {
  if (!op?.responses) return null;
  return op.responses['200'] || op.responses['201'] || op.responses['default']
      || Object.values(op.responses)[0] || null;
}

/** Compute the rest-config patch for picking a Start operation. */
export function buildStartPatch(restPrev, op, spec) {
  const base = pickServerBase(spec);
  const startUrl = buildPathUrl(base, op.path);
  const body = op.requestExample
    ? JSON.stringify(op.requestExample, null, 2)
    : restPrev.body || '{}';
  return {
    rest: {
      ...restPrev,
      method: op.method,
      startUrl,
      body,
      requestFields: op.requestFields || [],
      dynamicFields: [],
    },
    inference: { kind: 'start', operationId: op.operationId || `${op.method} ${op.path}` },
  };
}

/**
 * Compute the rest-config patch for picking a Probe operation. When the start
 * op's response shape is available, also infers idJsonPath.
 */
export function buildProbePatch(restPrev, op, spec, startOp) {
  const base = pickServerBase(spec);
  const chainParam = op.pathParams?.[0];
  const probeUrl = buildPathUrl(base, substituteChainParam(op.path, chainParam));

  const inferred = {
    probeUrl: true,
    statusJsonPath: false,
    expectedStatusValue: false,
    idJsonPath: false,
  };

  let statusJsonPath = restPrev.statusJsonPath;
  let expectedStatusValue = restPrev.expectedStatusValue;
  const ok = okResponse(op);
  if (ok?.fields) {
    const statusField = findStatusField(ok.fields);
    if (statusField) {
      statusJsonPath = `$.${statusField.path}`;
      inferred.statusJsonPath = true;
      if (statusField.enumValues?.length) {
        expectedStatusValue = pickTerminalValue(statusField.enumValues);
        inferred.expectedStatusValue = true;
      }
    }
  }

  let idJsonPath = restPrev.idJsonPath;
  if (chainParam && startOp) {
    const startOk = okResponse(startOp);
    const idField = findIdField(chainParam, startOk?.fields);
    if (idField) {
      idJsonPath = `$.${idField.path}`;
      inferred.idJsonPath = true;
    }
  }

  return {
    rest: {
      ...restPrev,
      probeUrl,
      statusJsonPath,
      expectedStatusValue,
      idJsonPath,
    },
    inference: {
      kind: 'probe',
      operationId: op.operationId || `${op.method} ${op.path}`,
      chainParam,
      fields: inferred,
      statusEnum: ok?.fields ? findStatusField(ok.fields)?.enumValues || null : null,
    },
  };
}

/** When the start op changes after a probe was already picked, re-derive idJsonPath. */
export function rebindIdPath(restPrev, probeOp, startOp) {
  const chainParam = probeOp?.pathParams?.[0];
  if (!chainParam) return restPrev;
  const startOk = okResponse(startOp);
  const idField = findIdField(chainParam, startOk?.fields);
  if (!idField) return restPrev;
  return { ...restPrev, idJsonPath: `$.${idField.path}` };
}
