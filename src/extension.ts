import * as vscode from 'vscode';
import { PixelNotesProvider, makeNote } from './PixelNotesProvider';
import { NoteStorage } from './NoteStorage';
import { CodeRefPicker } from './CodeRefPicker';

const CHAT_CMDS = [
  'workbench.action.chat.open',
  'github.copilot.chat.focus',
  'workbench.panel.chat.view.copilot.focus',
  'workbench.action.chat.newEditSession',
];

async function openChat(query: string): Promise<void> {
  for (const cmd of CHAT_CMDS) {
    try { await vscode.commands.executeCommand(cmd, { query, initialPrompt: query }); return; } catch { /* try next */ }
  }
  await vscode.env.clipboard.writeText(query);
  vscode.window.showInformationMessage('Prompt copied to clipboard — paste into AI chat.');
}

export function activate(ctx: vscode.ExtensionContext): void {
  const storage  = new NoteStorage(ctx);
  const provider = new PixelNotesProvider(ctx, storage);

  ctx.subscriptions.push(
    vscode.window.registerWebviewViewProvider('pixelNotes.mainView', provider, {
      webviewOptions: { retainContextWhenHidden: false },
    })
  );

  // ── New note from command palette ────────────────────────────────────────
  ctx.subscriptions.push(
    vscode.commands.registerCommand('pixelNotes.newNote', () => {
      const note = makeNote('New Note');
      storage.upsert(note);
      provider.sendMessage({ type: 'NOTES_UPDATED', notes: storage.getAll() });
    })
  );

  // ── Add code ref from editor right-click ─────────────────────────────────
  ctx.subscriptions.push(
    vscode.commands.registerCommand('pixelNotes.pickCodeRef', async () => {
      const ref = await CodeRefPicker.pickFromActiveEditor();
      if (ref) provider.sendMessage({ type: 'CODE_REF_PICKED', ref });
    })
  );

  // ── Send to AI (triggered by webview button — command is a fallback) ─────
  ctx.subscriptions.push(
    vscode.commands.registerCommand('pixelNotes.sendToAI', () => {
      vscode.window.showInformationMessage(
        'Open PixelNotes and use the "Send to AI" button on a note.'
      );
    })
  );

  // ── Explain selected code with AI & create note ──────────────────────────
  ctx.subscriptions.push(
    vscode.commands.registerCommand('pixelNotes.generateFromSelection', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.selection.isEmpty) {
        vscode.window.showWarningMessage('Select some code first, then try again.');
        return;
      }

      const selection = editor.document.getText(editor.selection);
      const lang      = editor.document.languageId;
      const ref       = await CodeRefPicker.pickFromActiveEditor();

      // Create a new note pre-filled with the code block
      const note = makeNote(`Explain: ${selection.split('\n')[0].trim().slice(0, 40)}`);
      note.body  = `## Selected Code\n\`\`\`${lang}\n${selection}\n\`\`\`\n\n## Explanation\n`;
      if (ref) note.codeRefs = [ref];
      storage.upsert(note);
      provider.sendMessage({ type: 'NOTES_UPDATED', notes: storage.getAll() });

      // Open AI chat with explanation prompt
      const prompt = `Please explain this ${lang} code clearly and concisely:\n\n\`\`\`${lang}\n${selection}\n\`\`\``;
      await openChat(prompt);
      vscode.window.showInformationMessage('Note created ✦ — AI chat opened with your code!');
    })
  );
}

export function deactivate(): void {}
