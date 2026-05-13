import * as vscode from 'vscode';
import { PixelNotesProvider, makeNote } from './PixelNotesProvider';
import { NoteStorage } from './NoteStorage';
import { CodeRefPicker } from './CodeRefPicker';

export function activate(ctx: vscode.ExtensionContext): void {
  const storage = new NoteStorage(ctx);
  const provider = new PixelNotesProvider(ctx, storage);

  ctx.subscriptions.push(
    vscode.window.registerWebviewViewProvider('pixelNotes.mainView', provider, {
      webviewOptions: { retainContextWhenHidden: false },
    })
  );

  ctx.subscriptions.push(
    vscode.commands.registerCommand('pixelNotes.newNote', () => {
      const note = makeNote('New Note');
      storage.upsert(note);
      provider.sendMessage({ type: 'NOTES_UPDATED', notes: storage.getAll() });
    })
  );

  ctx.subscriptions.push(
    vscode.commands.registerCommand('pixelNotes.pickCodeRef', async () => {
      const ref = await CodeRefPicker.pickFromActiveEditor();
      if (ref) {
        provider.sendMessage({ type: 'CODE_REF_PICKED', ref });
      }
    })
  );

  ctx.subscriptions.push(
    vscode.commands.registerCommand('pixelNotes.sendToAI', () => {
      // Handled via webview message when user clicks the button in-UI
      vscode.window.showInformationMessage(
        'Open PixelNotes and use the "Send to AI" button on a note.'
      );
    })
  );
}

export function deactivate(): void {}
