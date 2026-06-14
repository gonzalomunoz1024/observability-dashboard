import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { useTheme } from '../../context/ThemeContext';
import './JsonEditor.css';

const BASE_OPTIONS = {
  minimap: { enabled: false },
  fontSize: 13,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  fontLigatures: true,
  lineNumbers: 'on',
  lineNumbersMinChars: 3,
  roundedSelection: true,
  scrollBeyondLastLine: false,
  wordWrap: 'on',
  padding: { top: 10, bottom: 10 },
  automaticLayout: true,
  tabSize: 2,
  insertSpaces: true,
  renderLineHighlight: 'line',
  cursorBlinking: 'smooth',
  cursorSmoothCaretAnimation: 'on',
  smoothScrolling: true,
  bracketPairColorization: { enabled: true },
  fixedOverflowWidgets: true,
  scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
};

const GENERATOR_LABEL = {
  uuid: 'UUID',
  randomInt: 'Random int',
  randomString: 'Random string',
  timestampIso: 'Timestamp (ISO)',
  timestampMs: 'Timestamp (ms)',
  email: 'Email',
};

/**
 * Hand-rolled JSON walker that records the start/end offset of each value
 * we care about. Skips whole values we don't need (no AST in memory).
 *
 * Returns Map<dotPath, { start, end }>.
 */
function findFieldPositions(text, paths) {
  const result = new Map();
  if (!text || !paths || paths.size === 0) return result;
  const pathStack = [];
  let i = 0;
  const n = text.length;

  const isWs = (c) => c === ' ' || c === '\t' || c === '\n' || c === '\r';
  const skipWs = () => { while (i < n && isWs(text[i])) i++; };

  const readString = () => {
    if (text[i] !== '"') return null;
    const start = i;
    i++;
    let value = '';
    while (i < n) {
      const c = text[i];
      if (c === '\\') {
        const next = text[i + 1];
        if (next === '"') value += '"';
        else if (next === '\\') value += '\\';
        else if (next === 'n') value += '\n';
        else if (next === 't') value += '\t';
        else if (next === 'r') value += '\r';
        else value += next ?? '';
        i += 2;
        continue;
      }
      if (c === '"') { i++; return { start, end: i, value }; }
      value += c;
      i++;
    }
    return { start, end: i, value };
  };

  const readValue = () => {
    skipWs();
    if (i >= n) return { start: i, end: i };
    const start = i;
    const c = text[i];

    if (c === '{') {
      i++;
      while (i < n) {
        skipWs();
        if (text[i] === '}') { i++; break; }
        const key = readString();
        if (!key) break;
        skipWs();
        if (text[i] !== ':') break;
        i++;
        skipWs();

        pathStack.push(key.value);
        const path = pathStack.join('.');
        const valStart = i;
        const val = readValue();
        if (paths.has(path)) result.set(path, { start: valStart, end: val.end });
        pathStack.pop();

        skipWs();
        if (text[i] === ',') i++;
      }
      return { start, end: i };
    }

    if (c === '[') {
      i++;
      let idx = 0;
      while (i < n) {
        skipWs();
        if (text[i] === ']') { i++; break; }
        pathStack.push(String(idx));
        const path = pathStack.join('.');
        const valStart = i;
        const val = readValue();
        if (paths.has(path)) result.set(path, { start: valStart, end: val.end });
        pathStack.pop();
        idx++;
        skipWs();
        if (text[i] === ',') i++;
      }
      return { start, end: i };
    }

    if (c === '"') {
      const s = readString();
      return s ?? { start, end: i };
    }

    while (i < n && !isWs(text[i]) && text[i] !== ',' && text[i] !== '}' && text[i] !== ']') i++;
    return { start, end: i };
  };

  readValue();
  return result;
}

export const JsonEditor = forwardRef(function JsonEditor(
  { value, onChange, readOnly = false, height = 180, language = 'json', invalid = false, ariaLabel, dynamicFields },
  ref,
) {
  const { theme } = useTheme();
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const decorationsRef = useRef([]);

  useImperativeHandle(ref, () => ({
    insertAtCursor(text) {
      const editor = editorRef.current;
      if (!editor) return;
      const selection = editor.getSelection();
      editor.executeEdits('fx-insert', [
        { range: selection, text, forceMoveMarkers: true },
      ]);
      editor.focus();
    },
    focus() {
      editorRef.current?.focus();
    },
    getValue() {
      return editorRef.current?.getValue() ?? '';
    },
  }));

  const handleMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    if (language === 'json') {
      monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
        validate: true,
        allowComments: false,
        schemaValidation: 'warning',
      });
    }
  };

  // Paint dynamic-value decorations whenever the body or the field list changes.
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    if (!dynamicFields || dynamicFields.length === 0) {
      if (decorationsRef.current.length > 0) {
        decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
      }
      return;
    }

    const model = editor.getModel();
    if (!model) return;

    const text = model.getValue();
    const paths = new Set(dynamicFields.map((f) => f.path));
    const positions = findFieldPositions(text, paths);

    const decorations = [];
    positions.forEach(({ start, end }, path) => {
      const field = dynamicFields.find((f) => f.path === path);
      if (!field) return;
      const label = GENERATOR_LABEL[field.generator] || field.generator;
      const argsLabel = field.args?.length ? ` (${field.args.join(',')})` : '';

      const startPos = model.getPositionAt(start);
      const endPos = model.getPositionAt(end);

      decorations.push({
        range: new monaco.Range(
          startPos.lineNumber, startPos.column,
          endPos.lineNumber, endPos.column,
        ),
        options: {
          inlineClassName: 'json-editor-dynamic',
          hoverMessage: { value: `**Dynamic:** ${label}${argsLabel}\n\nReplaced on every run with a fresh value.` },
          after: {
            content: `  ↳ ${label}${argsLabel}`,
            inlineClassName: 'json-editor-dynamic-suffix',
          },
        },
      });
    });

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, decorations);
  }, [value, dynamicFields]);

  return (
    <div className={`json-editor-wrap ${invalid ? 'json-editor-invalid' : ''}`}>
      <Editor
        height={typeof height === 'number' ? `${height}px` : height}
        language={language}
        theme={theme === 'dark' ? 'vs-dark' : 'vs'}
        value={value ?? ''}
        onChange={(v) => onChange?.(v ?? '')}
        onMount={handleMount}
        options={{ ...BASE_OPTIONS, readOnly, ariaLabel }}
      />
    </div>
  );
});
