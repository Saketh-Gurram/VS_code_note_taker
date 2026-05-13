import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Note, CodeRef } from '../types';
import { postMessage } from '../vscodeApi';
import { CodeRefBadge } from './CodeRefBadge';

interface Props {
  note: Note;
  notes: Note[];           // all notes, for [[link]] resolution
  onClose: () => void;
  onSave: (note: Note) => void;
  onOpenNote: (id: string) => void;
  pendingRef?: CodeRef;
}

export function NoteEditor({ note, notes, onClose, onSave, onOpenNote, pendingRef }: Props) {
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [codeRefs, setCodeRefs] = useState<CodeRef[]>(note.codeRefs);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(note.tags);
  const [savedFlash, setSavedFlash] = useState(false);
  const [autoSaved, setAutoSaved] = useState(false);

  // Track whether the user has made a change since the last note switch
  const userEditedRef = useRef(false);
  // Always-fresh snapshot for the auto-save closure
  const latestRef = useRef({ title, body, codeRefs, tags, note });
  useEffect(() => { latestRef.current = { title, body, codeRefs, tags, note }; });

  // Re-sync local state when a different note is opened
  useEffect(() => {
    userEditedRef.current = false;
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

  // Auto-save: 1.5 s after the user stops typing
  useEffect(() => {
    if (!userEditedRef.current) return;
    const timer = setTimeout(() => {
      const { title: t, body: b, codeRefs: cr, tags: tg, note: n } = latestRef.current;
      const updated: Note = { ...n, title: t.trim() || 'Untitled', body: b, codeRefs: cr, tags: tg, updatedAt: Date.now() };
      onSave(updated);
      postMessage({ type: 'SAVE_NOTE', note: updated });
      setAutoSaved(true);
      setTimeout(() => setAutoSaved(false), 2000);
    }, 1500);
    return () => clearTimeout(timer);
  }, [title, body, codeRefs, tags]); // eslint-disable-line react-hooks/exhaustive-deps

  const buildNote = useCallback((): Note => ({
    ...note,
    title: title.trim() || 'Untitled',
    body,
    codeRefs,
    tags,
    updatedAt: Date.now(),
  }), [note, title, body, codeRefs, tags]);

  function save() {
    userEditedRef.current = false;
    const updated = buildNote();
    onSave(updated);
    postMessage({ type: 'SAVE_NOTE', note: updated });
    setAutoSaved(false);
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
    userEditedRef.current = true;
    setCodeRefs(prev => prev.filter((_, i) => i !== idx));
  }

  function addTag(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && tagInput.trim()) {
      userEditedRef.current = true;
      const t = tagInput.trim().toLowerCase();
      if (!tags.includes(t)) setTags(prev => [...prev, t]);
      setTagInput('');
    }
  }

  // Resolve [[Note Title]] links found in the body
  const linkedNotes = useMemo(() => {
    const matches = [...body.matchAll(/\[\[([^\]]+)\]\]/g)];
    const titles = [...new Set(matches.map(m => m[1].trim().toLowerCase()))];
    return titles
      .map(t => notes.find(n => n.id !== note.id && n.title.trim().toLowerCase() === t))
      .filter((n): n is Note => n !== undefined);
  }, [body, notes, note.id]);

  return (
    <div className="note-editor">
      <div className="note-editor-header">
        <button className="btn-ghost" onClick={() => { save(); onClose(); }}>← Back</button>
        <button className="btn-danger" onClick={deleteNote}>Delete</button>
      </div>

      <input
        className="note-title-input"
        value={title}
        onChange={e => { userEditedRef.current = true; setTitle(e.target.value); }}
        placeholder="Note title…"
      />

      <textarea
        className="note-body"
        value={body}
        onChange={e => { userEditedRef.current = true; setBody(e.target.value); }}
        placeholder="Write your note here… (markdown supported) — use [[Note Title]] to link notes"
      />

      {linkedNotes.length > 0 && (
        <div className="linked-notes-section">
          <div className="section-label">Linked Notes</div>
          <div className="linked-notes-list">
            {linkedNotes.map(n => (
              <button key={n.id} className="linked-note-chip" onClick={() => onOpenNote(n.id)}>
                ↗ {n.title}
              </button>
            ))}
          </div>
        </div>
      )}

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
            <span key={t} className="tag" onClick={() => { userEditedRef.current = true; setTags(prev => prev.filter(x => x !== t)); }}>
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
      {autoSaved && !savedFlash && (
        <div className="autosave-indicator">auto-saved</div>
      )}
    </div>
  );
}
