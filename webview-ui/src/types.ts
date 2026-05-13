export interface CodeRef {
  uri: string;
  line: number;
  lineText: string;
  fsPath: string;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  codeRefs: CodeRef[];
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export type HostToWebviewMsg =
  | { type: 'INIT'; notes: Note[]; activeRoom: 'note' | 'agent' }
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
  | { type: 'SWITCH_ROOM'; room: 'note' | 'agent' };

export type RoomId = 'note' | 'agent';
export type AIStatus = 'idle' | 'processing';
