import * as vscode from 'vscode';
import * as crypto from 'crypto';
import type { NoteStorage } from './NoteStorage';
import type { HostToWebviewMsg, WebviewToHostMsg, Note } from './types';
import { CodeRefPicker } from './CodeRefPicker';
import { SendToAI } from './SendToAI';

export class PixelNotesProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private activeRoom: 'note' | 'agent' = 'note';
  private pendingPickNoteId?: string;

  constructor(
    private readonly ctx: vscode.ExtensionContext,
    private readonly storage: NoteStorage
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.ctx.extensionUri, 'dist', 'webview'),
        vscode.Uri.joinPath(this.ctx.extensionUri, 'assets'),
      ],
    };

    webviewView.webview.html = this.buildHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((raw: WebviewToHostMsg) => {
      this.handleMessage(raw, webviewView);
    });
  }

  private async handleMessage(msg: WebviewToHostMsg, view: vscode.WebviewView): Promise<void> {
    switch (msg.type) {
      case 'READY':
        this.send(view, {
          type: 'INIT',
          notes: this.storage.getAll(),
          activeRoom: this.activeRoom,
        });
        break;

      case 'SAVE_NOTE':
        this.storage.upsert(msg.note);
        this.broadcastNotes(view);
        break;

      case 'DELETE_NOTE':
        this.storage.delete(msg.id);
        this.broadcastNotes(view);
        break;

      case 'PICK_CODE_REF': {
        this.pendingPickNoteId = msg.noteId;
        const ref = await CodeRefPicker.pickFromActiveEditor();
        if (ref) {
          this.send(view, { type: 'CODE_REF_PICKED', ref });
        }
        break;
      }

      case 'NAVIGATE_TO_REF':
        await CodeRefPicker.navigate(msg.ref);
        break;

      case 'SEND_TO_AI':
        this.send(view, { type: 'AI_STATUS', status: 'processing' });
        await SendToAI.send(msg.note);
        // Return to idle after 3 seconds
        setTimeout(() => {
          if (this.view) {
            this.send(this.view, { type: 'AI_STATUS', status: 'idle' });
          }
        }, 3000);
        break;

      case 'SWITCH_ROOM':
        this.activeRoom = msg.room;
        break;
    }
  }

  private broadcastNotes(view: vscode.WebviewView): void {
    this.send(view, { type: 'NOTES_UPDATED', notes: this.storage.getAll() });
  }

  send(view: vscode.WebviewView, msg: HostToWebviewMsg): void {
    view.webview.postMessage(msg);
  }

  sendMessage(msg: HostToWebviewMsg): void {
    if (this.view) {
      this.send(this.view, msg);
    }
  }

  private buildHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.ctx.extensionUri, 'dist', 'webview', 'webview.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.ctx.extensionUri, 'dist', 'webview', 'webview.css')
    );
    const nonce = crypto.randomBytes(16).toString('hex');
    const charBaseUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.ctx.extensionUri, 'assets', 'characters')
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
             img-src ${webview.cspSource} data: blob:;
             font-src ${webview.cspSource};
             style-src ${webview.cspSource} 'unsafe-inline';
             script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${styleUri}">
  <title>PixelNotes</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}">window.__CHAR_BASE__="${charBaseUri}";</script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  getAssetUri(webview: vscode.Webview, ...pathSegments: string[]): string {
    return webview.asWebviewUri(
      vscode.Uri.joinPath(this.ctx.extensionUri, 'assets', ...pathSegments)
    ).toString();
  }
}

export function makeNote(title = ''): Note {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title,
    body: '',
    codeRefs: [],
    tags: [],
    createdAt: now,
    updatedAt: now,
  };
}
