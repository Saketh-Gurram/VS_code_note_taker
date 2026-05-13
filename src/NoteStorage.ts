import * as vscode from 'vscode';
import type { Note } from './types';

const STORAGE_KEY = 'pixelNotes.notes';

export class NoteStorage {
  constructor(private ctx: vscode.ExtensionContext) {}

  getAll(): Note[] {
    return this.ctx.workspaceState.get<Note[]>(STORAGE_KEY, []);
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
    this.ctx.workspaceState.update(STORAGE_KEY, notes);
  }

  delete(id: string): void {
    const notes = this.getAll().filter(n => n.id !== id);
    this.ctx.workspaceState.update(STORAGE_KEY, notes);
  }
}
