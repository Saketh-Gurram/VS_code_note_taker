import * as vscode from 'vscode';
import type { Note } from './types';

const NOTES_KEY   = 'pixelNotes.notes';
const STREAK_KEY  = 'pixelNotes.streak';
const DATE_KEY    = 'pixelNotes.lastActiveDate';

export class NoteStorage {
  constructor(private ctx: vscode.ExtensionContext) {}

  // ── Notes ──────────────────────────────────────────────────────────────────
  getAll(): Note[] {
    return this.ctx.workspaceState.get<Note[]>(NOTES_KEY, []);
  }

  getById(id: string): Note | undefined {
    return this.getAll().find(n => n.id === id);
  }

  upsert(note: Note): void {
    const notes = this.getAll();
    const idx = notes.findIndex(n => n.id === note.id);
    if (idx >= 0) {
      notes[idx] = note;
    } else {
      notes.unshift(note);
    }
    this.ctx.workspaceState.update(NOTES_KEY, notes);
  }

  delete(id: string): void {
    const notes = this.getAll().filter(n => n.id !== id);
    this.ctx.workspaceState.update(NOTES_KEY, notes);
  }

  // ── Streaks (global — persists across workspaces) ─────────────────────────
  getStreak(): number {
    return this.ctx.globalState.get<number>(STREAK_KEY, 0);
  }

  /** Call when a note is saved. Increments streak if this is the first save today. */
  updateStreak(): number {
    const lastDate = this.ctx.globalState.get<string>(DATE_KEY, '');
    const today    = new Date().toDateString();
    if (lastDate === today) {
      return this.getStreak(); // already counted today
    }
    const yesterday = new Date(Date.now() - 86_400_000).toDateString();
    const newStreak = lastDate === yesterday ? this.getStreak() + 1 : 1;
    this.ctx.globalState.update(STREAK_KEY, newStreak);
    this.ctx.globalState.update(DATE_KEY, today);
    return newStreak;
  }
}
