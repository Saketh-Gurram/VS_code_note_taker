import type { CodeRef } from '../types';
import { postMessage } from '../vscodeApi';

interface Props {
  ref_: CodeRef;
  onRemove?: () => void;
}

export function CodeRefBadge({ ref_, onRemove }: Props) {
  function navigate() {
    postMessage({ type: 'NAVIGATE_TO_REF', ref: ref_ });
  }

  return (
    <span className="code-ref-badge">
      <button className="code-ref-link" onClick={navigate} title={ref_.lineText}>
        📎 {ref_.fsPath}:{ref_.line + 1}
      </button>
      {onRemove && (
        <button className="code-ref-remove" onClick={onRemove} title="Remove">
          ×
        </button>
      )}
    </span>
  );
}
