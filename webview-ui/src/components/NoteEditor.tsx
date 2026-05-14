import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Note, CodeRef } from '../types';
import { postMessage } from '../vscodeApi';
import { CodeRefBadge } from './CodeRefBadge';

interface Props {
  note: Note;
  notes: Note[];
  onClose: () => void;
  onSave: (note: Note) => void;
  onOpenNote: (id: string) => void;
  onTypingSpeed: (wpm: number) => void;
  pendingRef?: CodeRef;
}

export function NoteEditor({ note, notes, onClose, onSave, onOpenNote, onTypingSpeed, pendingRef }: Props) {
  const [title, setTitle]         = useState(note.title);
  const [body, setBody]           = useState(note.body);
  const [codeRefs, setCodeRefs]   = useState<CodeRef[]>(note.codeRefs);
  const [tagInput, setTagInput]   = useState('');
  const [tags, setTags]           = useState<string[]>(note.tags);
  const [pinned, setPinned]       = useState(!!note.pinned);
  const [savedFlash, setSavedFlash] = useState(false);
  const [autoSaved, setAutoSaved] = useState(false);
  const [wpm, setWpm]             = useState(0);

  const userEditedRef  = useRef(false);
  const latestRef      = useRef({ title, body, codeRefs, tags, pinned, note });
  const keystampRef    = useRef<number[]>([]);  // timestamps of recent keypresses
  const wpmTimerRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { latestRef.current = { title, body, codeRefs, tags, pinned, note }; });

  // Re-sync when note switches
  useEffect(() => {
    userEditedRef.current = false;
    setTitle(note.title);
    setBody(note.body);
    setCodeRefs(note.codeRefs);
    setTags(note.tags);
    setPinned(!!note.pinned);
  }, [note.id]);

  // Typing speed — rolling 5s window
  useEffect(() => {
    wpmTimerRef.current = setInterval(() => {
      const now = Date.now();
      keystampRef.current = keystampRef.current.filter(t => now - t < 5000);
      const count = keystampRef.current.length;
      const rawWpm = Math.round((count / 5) * 60 / 5); // chars/5s → words/min
      setWpm(rawWpm);
      onTypingSpeed(rawWpm);
    }, 1000);
    return () => { if (wpmTimerRef.current) clearInterval(wpmTimerRef.current); };
  }, [onTypingSpeed]);

  // Attach incoming code ref
  useEffect(() => {
    if (!pendingRef) return;
    setCodeRefs(prev => {
      const dup = prev.some(r => r.uri === pendingRef.uri && r.line === pendingRef.line);
      return dup ? prev : [...prev, pendingRef];
    });
  }, [pendingRef]);

  // Auto-save 1.5s debounce
  useEffect(() => {
    if (!userEditedRef.current) return;
    const timer = setTimeout(() => {
      const { title: t, body: b, codeRefs: cr, tags: tg, pinned: pn, note: n } = latestRef.current;
      const updated: Note = { ...n, title: t.trim() || 'Untitled', body: b, codeRefs: cr, tags: tg, pinned: pn, updatedAt: Date.now() };
      onSave(updated);
      postMessage({ type: 'SAVE_NOTE', note: updated });
      setAutoSaved(true);
      setTimeout(() => setAutoSaved(false), 2000);
    }, 1500);
    return () => clearTimeout(timer);
  }, [title, body, codeRefs, tags, pinned]); // eslint-disable-line react-hooks/exhaustive-deps

  const buildNote = useCallback((): Note => ({
    ...note,
    title: title.trim() || 'Untitled',
    body,
    codeRefs,
    tags,
    pinned,
    updatedAt: Date.now(),
  }), [note, title, body, codeRefs, tags, pinned]);

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

  function summarize() {
    const updated = buildNote();
    postMessage({ type: 'SUMMARIZE_NOTE', note: updated });
  }

  function exportNote() {
    postMessage({ type: 'EXPORT_NOTE', note: buildNote() });
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

  function togglePin() {
    userEditedRef.current = true;
    setPinned(p => !p);
  }

  function recordKeystroke() {
    keystampRef.current.push(Date.now());
    userEditedRef.current = true;
  }

  // Resolve [[Note Title]] links
  const linkedNotes = useMemo(() => {
    const matches = [...body.matchAll(/\[\[([^\]]+)\]\]/g)];
    const titles = [...new Set(matches.map(m => m[1].trim().toLowerCase()))];
    return titles
      .map(t => notes.find(n => n.id !== note.id && n.title.trim().toLowerCase() === t))
      .filter((n): n is Note => n !== undefined);
  }, [body, notes, note.id]);

  // Parse checkboxes from body
  const checkboxLines = useMemo(() => {
    return body.split('\n').map((line, idx) => {
      const match = line.match(/^- \[([ x])\] (.*)$/);
      if (!match) return null;
      return { idx, checked: match[1] === 'x', text: match[2] };
    }).filter((x): x is { idx: number; checked: boolean; text: string } => x !== null);
  }, [body]);

  function toggleCheckbox(lineIdx: number, checked: boolean) {
    const lines = body.split('\n');
    lines[lineIdx] = lines[lineIdx].replace(/^- \[[ x]\]/, `- [${checked ? 'x' : ' '}]`);
    userEditedRef.current = true;
    setBody(lines.join('\n'));
  }

  return (
    <div className="note-editor">
      <div className="note-editor-header">
        <button className="btn-ghost" onClick={() => { save(); onClose(); }}>← Back</button>
        <div className="header-actions">
          <button
            className={`btn-pin ${pinned ? 'active' : ''}`}
            onClick={togglePin}
            title={pinned ? 'Unpin note' : 'Pin to top'}
          >
            📌
          </button>
          <button className="btn-ghost btn-sm" onClick={exportNote} title="Export as .md file">
            ↓ Export
          </button>
          <button className="btn-danger" onClick={deleteNote}>Delete</button>
        </div>
      </div>

      <input
        className="note-title-input"
        value={title}
        onChange={e => { recordKeystroke(); setTitle(e.target.value); }}
        placeholder="Note title…"
      />

      <textarea
        className="note-body"
        value={body}
        onChange={e => { recordKeystroke(); setBody(e.target.value); }}
        placeholder="Write your note… (markdown) — use [[Note Title]] to link notes, - [ ] for checkboxes"
      />

      {/* Checkbox task list */}
      {checkboxLines.length > 0 && (
        <div className="checkbox-section">
          <div className="section-label">Tasks</div>
          <div className="checkbox-list">
            {checkboxLines.map(cb => (
              <label key={cb.idx} className={`checkbox-item ${cb.checked ? 'done' : ''}`}>
                <input
                  type="checkbox"
                  checked={cb.checked}
                  onChange={e => toggleCheckbox(cb.idx, e.target.checked)}
                />
                <span>{cb.text}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Linked notes */}
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
        <button className="btn-ai" onClick={summarize} title="Summarize with AI">
          Summarize ✦
        </button>
        <button className="btn-ai" onClick={sendToAI}>Send to AI ✦</button>
      </div>

      <div className="editor-status">
        {autoSaved && !savedFlash && <span className="autosave-indicator">auto-saved</span>}
        {wpm > 20 && <span className="wpm-indicator">⌨ {wpm} wpm</span>}
      </div>
    </div>
  );
}
