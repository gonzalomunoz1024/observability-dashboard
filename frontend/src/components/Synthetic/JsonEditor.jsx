import { forwardRef, useImperativeHandle, useRef } from 'react';
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

export const JsonEditor = forwardRef(function JsonEditor(
  { value, onChange, readOnly = false, height = 180, language = 'json', invalid = false, ariaLabel },
  ref,
) {
  const { theme } = useTheme();
  const editorRef = useRef(null);

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
    if (language === 'json') {
      monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
        validate: true,
        allowComments: false,
        schemaValidation: 'warning',
      });
    }
  };

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
