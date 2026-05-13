import * as vscode from 'vscode';
import type { Note } from './types';

// Known Copilot / VS Code chat command IDs in priority order.
// We try each silently and stop at the first that doesn't throw.
const CHAT_OPEN_CMDS = [
  // VS Code 1.85 + built-in chat (works with Copilot, Claude, etc.)
  'workbench.action.chat.open',
  // GitHub Copilot Chat extension (older)
  'github.copilot.chat.focus',
  // Older panel ID
  'workbench.panel.chat.view.copilot.focus',
  // VS Code 1.100 edit-session variant
  'workbench.action.chat.newEditSession',
];

async function tryOpenChat(query: string): Promise<boolean> {
  for (const cmd of CHAT_OPEN_CMDS) {
    try {
      // workbench.action.chat.open accepts { query } to pre-fill the input
      // workbench.action.chat.newEditSession accepts { initialPrompt }
      // Other focus commands take no arguments — passing extras is harmless
      await vscode.commands.executeCommand(cmd, { query, initialPrompt: query });
      return true;
    } catch {
      // command not registered — try next
    }
  }
  return false;
}

export class SendToAI {
  static async send(note: Note): Promise<void> {
    const formatted = SendToAI.format(note);

    // Always put the note on the clipboard so the user has it regardless
    await vscode.env.clipboard.writeText(formatted);

    const opened = await tryOpenChat(formatted);

    if (opened) {
      // Chat panel opened — show a brief, non-intrusive hint
      vscode.window.showInformationMessage(
        'Note sent to AI chat ✦  (also copied to clipboard)',
        { modal: false }
      );
    } else {
      // No chat extension found — surface a modal so the user notices
      const choice = await vscode.window.showInformationMessage(
        'Note copied to clipboard — paste it into your AI chat panel.',
        { modal: false },
        'Open Chat Panel'
      );
      if (choice === 'Open Chat Panel') {
        // Last-ditch attempt: open the generic chat side-bar
        try {
          await vscode.commands.executeCommand('workbench.view.extension.chat');
        } catch {
          try {
            await vscode.commands.executeCommand('workbench.action.togglePanel');
          } catch { /* nothing left to try */ }
        }
      }
    }
  }

  static format(note: Note): string {
    const lines: string[] = [
      `## Note: ${note.title || 'Untitled'}`,
      '',
      note.body,
    ];

    if (note.codeRefs.length > 0) {
      lines.push('', '### Code References');
      for (const ref of note.codeRefs) {
        lines.push(`- ${ref.fsPath}:${ref.line + 1} — \`${ref.lineText}\``);
      }
    }

    if (note.tags.length > 0) {
      lines.push('', `*Tags: ${note.tags.join(', ')}*`);
    }

    return lines.join('\n').trim();
  }
}
