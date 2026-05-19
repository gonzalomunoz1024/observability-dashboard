/**
 * reportExport.js
 *
 * Turns CLI test-suite runs into downloadable evidence artifacts:
 *   - exportRunAsJson      raw machine-readable run (re-import / audit)
 *   - exportRunAsMarkdown  engineer / pull-request friendly summary
 *   - exportRunReport      polished, self-contained, print-to-PDF HTML report
 *   - exportRunsReport     combined release-evidence report for many runs
 *
 * Every reader is defensive so the same code works for a normalized history
 * record and for a live streaming result coming straight out of RunModal.
 */

/* ------------------------------------------------------------------ */
/* helpers                                                            */
/* ------------------------------------------------------------------ */

function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugify(str) {
  return String(str || 'run')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60) || 'run';
}

function fmtDate(ts) {
  const d = ts ? new Date(ts) : new Date();
  if (Number.isNaN(d.getTime())) return String(ts);
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function downloadBlob(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Normalize an arbitrary run object into one predictable shape.
 * Accepts history records and live RunModal results alike.
 */
export function normalizeRun(run = {}) {
  const rawSteps = run.results || run.steps || [];
  const steps = rawSteps.map((s, i) => {
    const isHttp = s.type === 'http' || !!s.http;
    const validations = s.validation?.validations || s.validations || [];
    const passed = s.passed ?? s.validation?.passed ?? validations.every(v => v.passed);
    return {
      index: i + 1,
      name: s.name || s.id || `Step ${i + 1}`,
      type: isHttp ? 'http' : (s.kind || 'command'),
      isHttp,
      command: Array.isArray(s.args) ? s.args.join(' ') : s.args,
      stdin: s.stdinInputs || s.stdin || '',
      http: s.http || (s.url ? { method: s.method, url: s.url } : null),
      exitCode: s.exitCode ?? s.exit_code ?? s.code,
      statusCode: s.statusCode,
      duration: s.duration ?? s.pollDuration,
      stdout: s.stdout || s.output || s.standardOutput || '',
      stderr: s.stderr || s.standardError || '',
      responseBody: s.responseBody,
      validations,
      captures: s.captures || s.capturedVars || {},
      passed: !!passed,
    };
  });

  const total = run.summary?.total ?? steps.length;
  const passedCount = run.summary?.passed ?? steps.filter(s => s.passed).length;
  const failedCount = run.summary?.failed ?? (total - passedCount);
  const totalDuration = steps.reduce((acc, s) => acc + (Number(s.duration) || 0), 0);

  return {
    workflowName: run.workflowName || run.name || 'Test Suite',
    timestamp: run.timestamp || run.completedAt || run.startedAt || new Date().toISOString(),
    passed: run.passed ?? failedCount === 0,
    serviceId: run.serviceId || null,
    executable: run.executable || run.executablePath || run.executableName || null,
    configName: run.configName || run.config?.name || null,
    variables: run.variables || run.config?.variables || null,
    summary: {
      total,
      passed: passedCount,
      failed: failedCount,
      passRate: total > 0 ? `${Math.round((passedCount / total) * 100)}%` : 'n/a',
      durationMs: totalDuration,
    },
    steps,
  };
}

/* ------------------------------------------------------------------ */
/* JSON                                                               */
/* ------------------------------------------------------------------ */

export function exportRunAsJson(run) {
  const n = normalizeRun(run);
  const payload = {
    artifact: 'observability-forge-test-run',
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    run: n,
    raw: run,
  };
  const date = new Date(n.timestamp).toISOString().split('T')[0];
  downloadBlob(
    `${slugify(n.workflowName)}-${date}.json`,
    JSON.stringify(payload, null, 2),
    'application/json',
  );
}

export function exportRunsAsJson(runs) {
  const payload = {
    artifact: 'observability-forge-test-run-bundle',
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    runCount: runs.length,
    runs: runs.map(normalizeRun),
    raw: runs,
  };
  const date = new Date().toISOString().split('T')[0];
  downloadBlob(
    `test-evidence-bundle-${date}.json`,
    JSON.stringify(payload, null, 2),
    'application/json',
  );
}

/* ------------------------------------------------------------------ */
/* Markdown                                                           */
/* ------------------------------------------------------------------ */

function runToMarkdown(run) {
  const n = normalizeRun(run);
  const L = [];
  L.push(`# Test Execution Report — ${n.workflowName}`);
  L.push('');
  L.push(`**Result:** ${n.passed ? '✅ PASSED' : '❌ FAILED'}  `);
  L.push(`**Generated:** ${fmtDate(new Date())}  `);
  L.push(`**Executed:** ${fmtDate(n.timestamp)}  `);
  if (n.configName) L.push(`**Configuration:** ${n.configName}  `);
  if (n.serviceId) L.push(`**Service:** ${n.serviceId}  `);
  if (n.executable) L.push(`**Executable:** \`${n.executable}\`  `);
  L.push('');
  L.push('## Summary');
  L.push('');
  L.push('| Total | Passed | Failed | Pass rate | Duration |');
  L.push('| ----- | ------ | ------ | --------- | -------- |');
  L.push(`| ${n.summary.total} | ${n.summary.passed} | ${n.summary.failed} | ${n.summary.passRate} | ${n.summary.durationMs}ms |`);
  L.push('');

  if (n.variables && Object.keys(n.variables).length) {
    L.push('## Inputs — Configuration Variables');
    L.push('');
    L.push('| Variable | Value |');
    L.push('| -------- | ----- |');
    Object.entries(n.variables).forEach(([k, v]) => L.push(`| ${k} | ${v} |`));
    L.push('');
  }

  L.push('## Steps');
  L.push('');
  n.steps.forEach((s) => {
    L.push(`### ${s.index}. ${s.name} — ${s.passed ? '✅ passed' : '❌ failed'}`);
    L.push('');
    L.push('**Inputs**');
    L.push('');
    if (s.isHttp && s.http) {
      L.push(`- Request: \`${s.http.method || 'GET'} ${s.http.url || ''}\``);
    } else if (s.command) {
      L.push('```');
      L.push(s.command);
      L.push('```');
    }
    if (s.stdin) {
      L.push('- stdin:');
      L.push('```');
      L.push(s.stdin);
      L.push('```');
    }
    L.push('');
    L.push('**Outputs**');
    L.push('');
    if (s.isHttp) L.push(`- Status code: ${s.statusCode ?? 'n/a'}`);
    else L.push(`- Exit code: ${s.exitCode ?? 'n/a'}`);
    L.push(`- Duration: ${s.duration ?? 0}ms`);
    if (s.stdout) {
      L.push('- stdout:');
      L.push('```');
      L.push(s.stdout.trim());
      L.push('```');
    }
    if (s.stderr) {
      L.push('- stderr:');
      L.push('```');
      L.push(s.stderr.trim());
      L.push('```');
    }
    if (s.validations.length) {
      L.push('- Validations:');
      s.validations.forEach(v =>
        L.push(`  - ${v.passed ? '✅' : '❌'} ${v.type}` +
          (v.expected !== undefined ? ` — expected ${JSON.stringify(v.expected)}` : '') +
          (v.actual !== undefined && !v.passed ? `, got ${JSON.stringify(v.actual)}` : '')));
    }
    if (Object.keys(s.captures).length) {
      L.push('- Captured variables:');
      Object.entries(s.captures).forEach(([k, v]) => L.push(`  - \`${k}\` = \`${v}\``));
    }
    L.push('');
  });

  L.push('---');
  L.push('_Generated by Observability Forge Dashboard — test execution evidence._');
  return L.join('\n');
}

export function exportRunAsMarkdown(run) {
  const n = normalizeRun(run);
  const date = new Date(n.timestamp).toISOString().split('T')[0];
  downloadBlob(`${slugify(n.workflowName)}-${date}.md`, runToMarkdown(run), 'text/markdown');
}

/* ------------------------------------------------------------------ */
/* HTML report (self-contained, print → PDF)                          */
/* ------------------------------------------------------------------ */

const REPORT_CSS = `
:root{--ok:#34c759;--bad:#ff3b30;--ink:#1d1d1f;--sub:#6e6e73;--line:rgba(0,0,0,.1);--bg:#f5f5f7}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
 font:15px/1.55 -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,Helvetica,Arial,sans-serif;
 -webkit-font-smoothing:antialiased}
.wrap{max-width:880px;margin:0 auto;padding:40px 28px 72px}
.toolbar{max-width:880px;margin:0 auto;padding:16px 28px 0;text-align:right}
.toolbar button{font:inherit;font-size:13px;font-weight:600;color:#fff;background:#007aff;
 border:0;border-radius:980px;padding:9px 18px;cursor:pointer}
header{background:#fff;border-radius:18px;padding:32px;margin-bottom:20px;
 box-shadow:0 1px 3px rgba(0,0,0,.06)}
h1{font-size:24px;letter-spacing:-.4px;margin:0 0 4px}
.eyebrow{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:var(--sub);margin:0 0 14px}
.pill{display:inline-block;font-size:13px;font-weight:700;letter-spacing:.3px;
 padding:6px 16px;border-radius:980px;color:#fff}
.pill.ok{background:var(--ok)}.pill.bad{background:var(--bad)}
.meta{display:flex;flex-wrap:wrap;gap:6px 28px;margin-top:18px;font-size:13px;color:var(--sub)}
.meta b{color:var(--ink);font-weight:600}
.cards{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:20px 0}
.card{background:#fff;border-radius:14px;padding:16px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.06)}
.card .n{font-size:22px;font-weight:700;letter-spacing:-.5px}
.card .l{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--sub);margin-top:4px}
.card.ok .n{color:var(--ok)}.card.bad .n{color:var(--bad)}
section.block{background:#fff;border-radius:18px;padding:8px 0;margin-bottom:20px;
 box-shadow:0 1px 3px rgba(0,0,0,.06);overflow:hidden}
.section-title{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;
 color:var(--sub);padding:18px 28px 6px}
table.kv{width:100%;border-collapse:collapse;font-size:13px}
table.kv td{padding:8px 28px;border-top:1px solid var(--line);vertical-align:top}
table.kv td:first-child{color:var(--sub);width:34%;font-weight:600}
table.kv td code{font-family:"SF Mono",ui-monospace,Menlo,monospace}
.step{border-top:1px solid var(--line);padding:18px 28px}
.step:first-of-type{border-top:0}
.step-head{display:flex;align-items:center;gap:10px}
.step-idx{font-size:12px;font-weight:700;color:var(--sub);min-width:22px}
.step-name{font-size:15px;font-weight:600;flex:1}
.dot{font-size:12px;font-weight:700;padding:3px 11px;border-radius:980px;color:#fff}
.dot.ok{background:var(--ok)}.dot.bad{background:var(--bad)}
.dur{font-size:12px;color:var(--sub);font-variant-numeric:tabular-nums}
.io{margin-top:12px}
.io h4{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--sub);margin:14px 0 6px}
pre{background:#1d1d1f;color:#e6e6eb;border-radius:10px;padding:12px 14px;margin:0;
 font:12px/1.5 "SF Mono",ui-monospace,Menlo,monospace;white-space:pre-wrap;word-break:break-word;
 max-height:340px;overflow:auto}
pre.cmd{background:#f5f5f7;color:#1d1d1f}
.kbd{display:inline-block;background:#f5f5f7;border-radius:6px;padding:2px 8px;
 font:12px "SF Mono",ui-monospace,Menlo,monospace}
.val{display:flex;gap:8px;align-items:baseline;font-size:13px;padding:4px 0}
.val .vi{font-weight:700}.val.pass .vi{color:var(--ok)}.val.fail .vi{color:var(--bad)}
.val .vt{font-weight:600}.val .vx{color:var(--sub)}
.cap{font-size:13px;padding:3px 0;font-family:"SF Mono",ui-monospace,Menlo,monospace}
.cap b{color:#007aff}
footer{text-align:center;color:var(--sub);font-size:12px;margin-top:28px;line-height:1.7}
@media print{
 body{background:#fff}.toolbar{display:none}
 header,section.block,.card{box-shadow:none;border:1px solid var(--line)}
 .wrap{padding:0}pre{max-height:none}
 section.block,.step{break-inside:avoid}
}
`;

function stepHTML(s) {
  const parts = [];
  parts.push(`<div class="step">
    <div class="step-head">
      <span class="step-idx">${s.index}</span>
      <span class="step-name">${esc(s.name)}</span>
      <span class="dot ${s.passed ? 'ok' : 'bad'}">${s.passed ? 'PASS' : 'FAIL'}</span>
      <span class="dur">${s.duration ?? 0}ms</span>
    </div>
    <div class="io">`);

  // Inputs
  parts.push('<h4>Inputs</h4>');
  if (s.isHttp && s.http) {
    parts.push(`<pre class="cmd">${esc((s.http.method || 'GET') + ' ' + (s.http.url || ''))}</pre>`);
  } else if (s.command) {
    parts.push(`<pre class="cmd">${esc(s.command)}</pre>`);
  } else {
    parts.push('<div class="vx">—</div>');
  }
  if (s.stdin) {
    parts.push('<h4>stdin</h4>');
    parts.push(`<pre>${esc(s.stdin)}</pre>`);
  }

  // Outputs
  parts.push('<h4>Outputs</h4>');
  parts.push(`<div class="val"><span class="vt">${s.isHttp ? 'Status code' : 'Exit code'}</span>` +
    `<span class="vx">${esc(s.isHttp ? (s.statusCode ?? 'n/a') : (s.exitCode ?? 'n/a'))}</span></div>`);
  if (s.stdout) {
    parts.push('<h4>stdout</h4>');
    parts.push(`<pre>${esc(s.stdout.trim())}</pre>`);
  }
  if (s.stderr) {
    parts.push('<h4>stderr</h4>');
    parts.push(`<pre>${esc(s.stderr.trim())}</pre>`);
  }
  if (s.responseBody) {
    parts.push('<h4>Response body</h4>');
    parts.push(`<pre>${esc(String(s.responseBody).trim())}</pre>`);
  }
  if (s.validations.length) {
    parts.push('<h4>Validations</h4>');
    s.validations.forEach(v => {
      parts.push(`<div class="val ${v.passed ? 'pass' : 'fail'}">
        <span class="vi">${v.passed ? '✓' : '✕'}</span>
        <span class="vt">${esc(v.type)}</span>
        ${v.expected !== undefined ? `<span class="vx">expected ${esc(JSON.stringify(v.expected))}</span>` : ''}
        ${v.actual !== undefined && !v.passed ? `<span class="vx">· got ${esc(JSON.stringify(v.actual))}</span>` : ''}
      </div>`);
    });
  }
  const capKeys = Object.keys(s.captures || {});
  if (capKeys.length) {
    parts.push('<h4>Captured variables</h4>');
    capKeys.forEach(k => parts.push(`<div class="cap"><b>${esc(k)}</b> = ${esc(s.captures[k])}</div>`));
  }

  parts.push('</div></div>');
  return parts.join('');
}

function runSectionHTML(run) {
  const n = normalizeRun(run);
  const metaRows = [
    ['Test suite', esc(n.workflowName)],
    ['Configuration', n.configName ? esc(n.configName) : null],
    ['Service', n.serviceId ? esc(n.serviceId) : null],
    ['Executable', n.executable ? `<code>${esc(n.executable)}</code>` : null],
    ['Executed at', esc(fmtDate(n.timestamp))],
  ].filter(r => r[1]);

  const varsBlock = (n.variables && Object.keys(n.variables).length)
    ? `<section class="block">
        <div class="section-title">Inputs — Configuration Variables</div>
        <table class="kv">
          ${Object.entries(n.variables).map(([k, v]) =>
            `<tr><td>${esc(k)}</td><td><code>${esc(v)}</code></td></tr>`).join('')}
        </table>
      </section>`
    : '';

  return `
  <header>
    <p class="eyebrow">Test Execution Report</p>
    <h1>${esc(n.workflowName)}</h1>
    <span class="pill ${n.passed ? 'ok' : 'bad'}">${n.passed ? 'PASSED' : 'FAILED'}</span>
    <div class="meta">
      ${metaRows.map(([k, v]) => `<div>${k}: <b>${v}</b></div>`).join('')}
    </div>
  </header>

  <div class="cards">
    <div class="card"><div class="n">${n.summary.total}</div><div class="l">Steps</div></div>
    <div class="card ok"><div class="n">${n.summary.passed}</div><div class="l">Passed</div></div>
    <div class="card ${n.summary.failed ? 'bad' : ''}"><div class="n">${n.summary.failed}</div><div class="l">Failed</div></div>
    <div class="card"><div class="n">${esc(n.summary.passRate)}</div><div class="l">Pass rate</div></div>
    <div class="card"><div class="n">${n.summary.durationMs}<span style="font-size:13px">ms</span></div><div class="l">Duration</div></div>
  </div>

  ${varsBlock}

  <section class="block">
    <div class="section-title">Steps — Inputs &amp; Outputs</div>
    ${n.steps.map(stepHTML).join('')}
  </section>`;
}

function htmlDocument(title, bodyInner) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>${REPORT_CSS}</style></head>
<body>
<div class="toolbar"><button onclick="window.print()">Save as PDF / Print</button></div>
<div class="wrap">
${bodyInner}
<footer>
  Generated by Observability Forge Dashboard · ${esc(fmtDate(new Date()))}<br>
  This document is an automated record of test execution intended as release evidence.
</footer>
</div></body></html>`;
}

export function buildRunReportHTML(run) {
  const n = normalizeRun(run);
  return htmlDocument(`Test Report — ${n.workflowName}`, runSectionHTML(run));
}

export function exportRunReport(run) {
  const n = normalizeRun(run);
  const date = new Date(n.timestamp).toISOString().split('T')[0];
  downloadBlob(`${slugify(n.workflowName)}-report-${date}.html`, buildRunReportHTML(run), 'text/html');
}

export function exportRunsReport(runs, meta = {}) {
  const total = runs.length;
  const passed = runs.filter(r => normalizeRun(r).passed).length;
  const overview = `
  <header>
    <p class="eyebrow">Release Test Evidence</p>
    <h1>${esc(meta.title || 'Test Execution Evidence Report')}</h1>
    <span class="pill ${passed === total ? 'ok' : 'bad'}">
      ${passed} / ${total} runs passed
    </span>
    <div class="meta">
      ${meta.serviceId ? `<div>Service: <b>${esc(meta.serviceId)}</b></div>` : ''}
      <div>Runs: <b>${total}</b></div>
      <div>Generated: <b>${esc(fmtDate(new Date()))}</b></div>
    </div>
  </header>`;
  const body = overview + runs.map(r =>
    `<div style="margin-top:28px">${runSectionHTML(r)}</div>`).join('');
  const date = new Date().toISOString().split('T')[0];
  downloadBlob(
    `test-evidence-report-${date}.html`,
    htmlDocument(meta.title || 'Test Execution Evidence Report', body),
    'text/html',
  );
}
