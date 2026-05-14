import type { CodeRef } from '../types';
import { postMessage } from '../vscodeApi';

interface Props {
  ref_: CodeRef;
  onRemove?: () => void;
}

/** Returns the human-readable location label for a ref badge. */
function refLabel(ref: CodeRef): string {
  if (ref.line < 0) {
    // File-only
    return ref.fsPath;
  }
  if (ref.lineEnd !== undefined && ref.lineEnd > ref.line) {
    // Block
    return `${ref.fsPath}:${ref.line + 1}–${ref.lineEnd + 1}`;
  }
  // Single line
  return `${ref.fsPath}:${ref.line + 1}`;
}

/** Returns the tooltip text for a ref badge. */
function refTitle(ref: CodeRef): string {
  if (ref.line < 0) {
    return ref.fsPath;
  }
  if (ref.lineEnd !== undefined && ref.lineEnd > ref.line) {
    return `Lines ${ref.line + 1}–${ref.lineEnd + 1}\n${ref.lineText}`;
  }
  return ref.lineText || ref.fsPath;
}

export function CodeRefBadge({ ref_, onRemove }: Props) {
  function navigate() {
    postMessage({ type: 'NAVIGATE_TO_REF', ref: ref_ });
  }

  return (
    <span className="code-ref-badge">
      <button className="code-ref-link" onClick={navigate} title={refTitle(ref_)}>
        📎 {refLabel(ref_)}
      </button>
      {onRemove && (
        <button className="code-ref-remove" onClick={onRemove} title="Remove">
          ×
        </button>
      )}
    </span>
  );
}
