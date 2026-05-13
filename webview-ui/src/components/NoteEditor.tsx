import { useState, useEffect, useCallback } from 'react';
import type { Note, CodeRef } from '../types';
import { postMessage } from '../vscodeApi';
import { CodeRefBadge } from './CodeRefBadge';

interface Props {
  note: Note;
  onClose: () => void;
  onSave: (note: Note) => void;
  pendingRef?: CodeRef;
}

export function NoteEditor({ note, onClose, onSave, pendingRef }: Props) {
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [codeRefs, setCodeRefs] = useState<CodeRef[]>(note.codeRefs);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(note.tags);
  const [savedFlash, setSavedFlash] = useState(false);

  // Re-sync local state if a different note is opened
  useEffect(() => {
    setTitle(note.title);
    setBody(note.body);
    setCodeRefs(note.codeRefs);
    setTags(note.tags);
  }, [note.id]);

  // Attach incoming code ref
  useEffect(() => {
    if (!pendingRef) return;
    setCodeRefs(prev => {
      const dup = prev.some(r => r.uri === pendingRef.uri && r.line === pendingRef.line);
      return dup ? prev : [...prev, pendingRef];
    });
  }, [pendingRef]);

  const buildNote = useCallback((): Note => ({
    ...note,
    title: title.trim() || 'Untitled',
    body,
    codeRefs,
    tags,
    updatedAt: Date.now(),
  }), [note, title, body, codeRefs, tags]);

  function save() {
    const updated = buildNote();
    onSave(updated);
    postMessage({ type: 'SAVE_NOTE', note: updated });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1400);
  }

  function deleteNote() {
    postMessage({ type: 'DELETE_NOTE', id: note.id });
    onClose();
  }

  function sendToAI() {
    const updated = buildNote();
    onSave(updated);
    postMessage({ type: 'SAVE_NOTE', note: updated });
    postMessage({ type: 'SEND_TO_AI', note: updated });
  }

  function addCodeRef() {
    postMessage({ type: 'PICK_CODE_REF', noteId: note.id });
  }

  function removeRef(idx: number) {
    setCodeRefs(prev => prev.filter((_, i) => i !== idx));
  }

  function addTag(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && tagInput.trim()) {
      const t = tagInput.trim().toLowerCase();
      if (!tags.includes(t)) setTags(prev => [...prev, t]);
      setTagInput('');
    }
  }

  return (
    <div className="note-editor">
      <div className="note-editor-header">
        <button className="btn-ghost" onClick={() => { save(); onClose(); }}>← Back</button>
        <button className="btn-danger" onClick={deleteNote}>Delete</button>
      </div>

      <input
        className="note-title-input"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Note title…"
      />

      <textarea
        className="note-body"
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="Write your note here… (markdown supported)"
      />

      <div className="code-refs-section">
        <div className="section-label">Code Refs</div>
        <div className="code-refs-list">
          {codeRefs.map((ref, i) => (
            <CodeRefBadge key={`${ref.uri}-${ref.line}`} ref_={ref} onRemove={() => removeRef(i)} />
          ))}
        </div>
        <button className="btn-ghost btn-sm" onClick={addCodeRef}>+ Add Code Ref</button>
      </div>

      <div className="tags-section">
        <div className="section-label">Tags</div>
        <div className="tags-list">
          {tags.map(t => (
            <span key={t} className="tag" onClick={() => setTags(prev => prev.filter(x => x !== t))}>
              {t} ×
            </span>
          ))}
          <input
            className="tag-input"
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={addTag}
            placeholder="add tag…"
          />
        </div>
      </div>

      <div className="note-editor-footer">
        <button className={`btn-primary ${savedFlash ? 'btn-saved' : ''}`} onClick={save}>
          {savedFlash ? '✓ Saved' : 'Save'}
        </button>
        <button className="btn-ai" onClick={sendToAI}>Send to AI ✦</button>
      </div>
    </div>
  );
}
