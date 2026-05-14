import { useState } from 'react';
import type { Note } from '../types';

interface Props {
  notes: Note[];
  streak: number;
  onOpen: (note: Note) => void;
  onNew: (templateKey?: string) => void;
  onTogglePin: (note: Note) => void;
  templates: Record<string, { title: string; body: string; tags: string[] }>;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function NoteList({ notes, streak, onOpen, onNew, onTogglePin, templates }: Props) {
  const [search, setSearch] = useState('');

  const sorted = [...notes].sort((a, b) => {
    if (!!a.pinned === !!b.pinned) return b.updatedAt - a.updatedAt;
    return a.pinned ? -1 : 1;
  });

  const visible = sorted.filter(n =>
    !search ||
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    n.body.toLowerCase().includes(search.toLowerCase()) ||
    n.tags.some(t => t.includes(search.toLowerCase()))
  );

  return (
    <div className="note-list">
      <div className="note-list-header">
        <span className="section-label">Notes</span>
        <div className="header-right">
          {streak >= 2 && (
            <span className="streak-badge" title={`${streak} day streak — keep writing!`}>
              🔥 {streak}d
            </span>
          )}
          <button className="btn-ghost btn-sm" onClick={() => onNew()}>+ New</button>
        </div>
      </div>

      <input
        className="search-input"
        type="text"
        placeholder="Search notes…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <div className="template-row">
        {Object.entries(templates).map(([key, t]) => (
          <button key={key} className="btn-template" onClick={() => onNew(key)}>{t.title}</button>
        ))}
      </div>

      {notes.length === 0 && (
        <div className="note-empty">
          No notes yet.<br />
          Click <strong>+ New</strong> to start.
        </div>
      )}

      <div className="note-cards">
        {visible.map(note => (
          <div key={note.id} className={`note-card-wrapper ${note.pinned ? 'pinned' : ''}`}>
            <button className="note-card" onClick={() => onOpen(note)}>
              <div className="note-card-title">
                {note.pinned && <span className="pin-icon">📌</span>}
                {note.title || 'Untitled'}
              </div>
              {note.body && (
                <div className="note-card-preview">{note.body.slice(0, 80)}</div>
              )}
              <div className="note-card-meta">
                {note.codeRefs.length > 0 && (
                  <span className="meta-badge">📎 {note.codeRefs.length}</span>
                )}
                {note.tags.map(t => (
                  <span key={t} className="tag tag-sm">{t}</span>
                ))}
                <span className="meta-time">{timeAgo(note.updatedAt)}</span>
              </div>
            </button>
            <button
              className="pin-btn"
              onClick={e => { e.stopPropagation(); onTogglePin(note); }}
              title={note.pinned ? 'Unpin' : 'Pin to top'}
            >
              {note.pinned ? '📌' : '·'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
