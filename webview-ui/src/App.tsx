import { useReducer, useEffect, useState, useRef } from 'react';
import type { Note, AIStatus, HostToWebviewMsg, CodeRef } from './types';
import { postMessage, onMessage, getState, setState } from './vscodeApi';
import { OfficeCanvas } from './components/OfficeCanvas';
import { NoteList } from './components/NoteList';
import { NoteEditor } from './components/NoteEditor';

interface AppState {
  notes: Note[];
  aiStatus: AIStatus;
  openNoteId: string | null;
  pendingRef?: CodeRef;
}

type Action =
  | { type: 'INIT'; notes: Note[] }
  | { type: 'SET_NOTES'; notes: Note[] }
  | { type: 'OPEN_NOTE'; id: string }
  | { type: 'CLOSE_NOTE' }
  | { type: 'NEW_NOTE'; note: Note }
  | { type: 'CODE_REF_PICKED'; ref: CodeRef }
  | { type: 'SAVE_NOTE'; note: Note };

const TEMPLATES: Record<string, { title: string; body: string; tags: string[] }> = {
  bug: { title: 'Bug Report', body: '## Bug\n\n## Steps to Reproduce\n1. \n\n## Expected\n\n## Actual\n', tags: ['bug'] },
  task: { title: 'Task List', body: '## Tasks\n- [ ] \n- [ ] \n- [ ] \n', tags: ['tasks'] },
  meeting: { title: 'Meeting Notes', body: '## Attendees\n\n## Agenda\n\n## Notes\n\n## Action Items\n', tags: ['meeting'] },
  research: { title: 'Research', body: '## Topic\n\n## Findings\n\n## Links\n', tags: ['research'] },
};

function makeNewNote(templateKey?: string): Note {
  const now = Date.now();
  const tpl = templateKey ? TEMPLATES[templateKey] : undefined;
  return {
    id: crypto.randomUUID(),
    title: tpl ? tpl.title : 'New Note',
    body: tpl ? tpl.body : '',
    codeRefs: [],
    tags: tpl ? tpl.tags : [],
    createdAt: now,
    updatedAt: now,
  };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'INIT':
      return { ...state, notes: action.notes };
    case 'SET_NOTES':
      return { ...state, notes: action.notes };
    case 'OPEN_NOTE':
      return { ...state, openNoteId: action.id, pendingRef: undefined };
    case 'CLOSE_NOTE':
      return { ...state, openNoteId: null, pendingRef: undefined };
    case 'NEW_NOTE':
      return { ...state, notes: [action.note, ...state.notes], openNoteId: action.note.id, pendingRef: undefined };
    case 'CODE_REF_PICKED':
      return { ...state, pendingRef: action.ref };
    case 'SAVE_NOTE':
      return { ...state, notes: state.notes.map(n => n.id === action.note.id ? action.note : n) };
    default:
      return state;
  }
}

const INITIAL: AppState = { notes: [], aiStatus: 'idle', openNoteId: null };

export function App() {
  const saved = getState<AppState>();
  const [state, dispatch] = useReducer(reducer, saved ?? INITIAL);
  const [savedAt, setSavedAt] = useState(0);
  const [milestoneCount, setMilestoneCount] = useState(0);
  const prevNoteCountRef = useRef(0);

  useEffect(() => { setState(state); }, [state]);

  useEffect(() => {
    const off = onMessage((msg: HostToWebviewMsg) => {
      switch (msg.type) {
        case 'INIT':      dispatch({ type: 'INIT', notes: msg.notes }); break;
        case 'NOTES_UPDATED': dispatch({ type: 'SET_NOTES', notes: msg.notes }); break;
        case 'CODE_REF_PICKED': dispatch({ type: 'CODE_REF_PICKED', ref: msg.ref }); break;
      }
    });
    postMessage({ type: 'READY' });
    return off;
  }, []);

  const openNote = state.openNoteId
    ? state.notes.find(n => n.id === state.openNoteId)
    : null;

  function newNote(templateKey?: string) {
    const note = makeNewNote(templateKey);
    postMessage({ type: 'SAVE_NOTE', note });
    dispatch({ type: 'NEW_NOTE', note });
  }

  return (
    <div className="app">
      <div className="canvas-wrapper">
        <OfficeCanvas
          isEditing={!!openNote}
          savedAt={savedAt}
          noteTitle={openNote?.title}
          milestoneCount={milestoneCount}
        />
      </div>
      <div className="overlay">
        {openNote ? (
          <NoteEditor
            note={openNote}
            notes={state.notes}
            pendingRef={state.pendingRef}
            onClose={() => dispatch({ type: 'CLOSE_NOTE' })}
            onSave={(note) => {
              dispatch({ type: 'SAVE_NOTE', note });
              setSavedAt(Date.now());
              // Milestone detection
              const count = state.notes.length;
              const prev = prevNoteCountRef.current;
              if ([10, 25, 50, 100].includes(count) && count !== prev) {
                setMilestoneCount(c => c + 1);
              }
              prevNoteCountRef.current = count;
            }}
            onOpenNote={(id) => dispatch({ type: 'OPEN_NOTE', id })}
          />
        ) : (
          <NoteList
            notes={state.notes}
            onOpen={(n) => dispatch({ type: 'OPEN_NOTE', id: n.id })}
            onNew={newNote}
            templates={TEMPLATES}
          />
        )}
      </div>
    </div>
  );
}
