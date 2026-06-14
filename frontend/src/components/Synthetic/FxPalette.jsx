import { useEffect, useRef } from 'react';
import './FxPalette.css';

const VARIABLES = [
  { token: '{{uuid}}', label: 'UUID', hint: 'random v4 UUID' },
  { token: '{{now}}', label: 'now', hint: 'ISO-8601 timestamp' },
  { token: '{{timestamp}}', label: 'timestamp', hint: 'epoch milliseconds' },
  { token: '{{randomInt(1,100)}}', label: 'randomInt', hint: 'inclusive int in range' },
  { token: '{{randomString(8)}}', label: 'randomString', hint: 'alphanumeric of length n' },
  { token: '{{randomEmail}}', label: 'randomEmail', hint: 'name@example.com' },
];

export function FxPalette({ open, anchorRef, onInsert, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target) &&
          anchorRef?.current && !anchorRef.current.contains(e.target)) {
        onClose();
      }
    };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  return (
    <div className="fx-palette" ref={ref} role="menu" aria-label="Insert dynamic value">
      <div className="fx-palette-eyebrow">Insert dynamic value</div>
      <div className="fx-palette-list">
        {VARIABLES.map((v) => (
          <button
            key={v.token}
            type="button"
            className="fx-palette-item"
            onClick={() => { onInsert(v.token); onClose(); }}
          >
            <code className="fx-palette-token">{v.token}</code>
            <span className="fx-palette-hint">{v.hint}</span>
          </button>
        ))}
      </div>
      <div className="fx-palette-footer">
        Resolves on each run · syntax matches JMeter-style placeholders
      </div>
    </div>
  );
}
