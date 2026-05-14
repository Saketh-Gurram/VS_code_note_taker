export interface CodeRef {
  uri: string;
  fsPath: string;
  /** 0-indexed start line. -1 means file-only (no specific line). */
  line: number;
  /** 0-indexed end line. Present only for block references. */
  lineEnd?: number;
  /** Preview text. */
  lineText: string;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  codeRefs: CodeRef[];
  tags: string[];
  pinned?: boolean;
  createdAt: number;
  updatedAt: number;
}

export type HostToWebviewMsg =
  | { type: 'INIT'; notes: Note[]; activeRoom: 'note' | 'agent'; streak: number }
  | { type: 'NOTES_UPDATED'; notes: Note[] }
  | { type: 'AI_STATUS'; status: 'idle' | 'processing' }
  | { type: 'CODE_REF_PICKED'; ref: CodeRef };

export type WebviewToHostMsg =
  | { type: 'READY' }
  | { type: 'SAVE_NOTE'; note: Note }
  | { type: 'DELETE_NOTE'; id: string }
  | { type: 'PICK_CODE_REF'; noteId: string }
  | { type: 'NAVIGATE_TO_REF'; ref: CodeRef }
  | { type: 'SEND_TO_AI'; note: Note }
  | { type: 'SUMMARIZE_NOTE'; note: Note }
  | { type: 'EXPORT_NOTE'; note: Note }
  | { type: 'SWITCH_ROOM'; room: 'note' | 'agent' };

export type RoomId = 'note' | 'break';
export type AIStatus = 'idle' | 'processing';
