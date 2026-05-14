import * as vscode from 'vscode';
import type { CodeRef } from './types';

export class CodeRefPicker {

  // ── Called from the QuickPick command (no active editor context) ────────────
  static async pick(): Promise<CodeRef | undefined> {
    const workspaceFiles = await vscode.workspace.findFiles(
      '**/*.{ts,tsx,js,jsx,mjs,cjs,py,go,rs,java,cs,cpp,c,h,rb,php,swift,kt,md,json,yaml,yml}',
      '**/node_modules/**',
      500
    );

    if (workspaceFiles.length === 0) {
      vscode.window.showInformationMessage('No files found in workspace.');
      return undefined;
    }

    // Step 1 — pick file
    const fileItems = workspaceFiles.map(uri => ({
      label: vscode.workspace.asRelativePath(uri),
      description: uri.fsPath,
      uri,
    }));

    const pickedFile = await vscode.window.showQuickPick(fileItems, {
      placeHolder: 'Select a file to reference',
      matchOnDescription: true,
    });
    if (!pickedFile) { return undefined; }

    const doc = await vscode.workspace.openTextDocument(pickedFile.uri);
    const fsPath = vscode.workspace.asRelativePath(pickedFile.uri);

    // Step 2 — pick granularity: entire file OR a specific line/range
    const ENTIRE_FILE_LABEL = '$(file) Entire file';
    const lineItems: vscode.QuickPickItem[] = [
      {
        label: ENTIRE_FILE_LABEL,
        description: 'Reference the whole file without a line number',
        alwaysShow: true,
      },
      ...Array.from({ length: doc.lineCount }, (_, i) => ({
        label: `$(debug-stackframe-dot) Line ${i + 1}`,
        description: doc.lineAt(i).text.trim().slice(0, 80),
        // stash the index so we can retrieve it
        detail: String(i),
      })),
    ];

    const pickedLine = await vscode.window.showQuickPick(lineItems, {
      placeHolder: `${pickedFile.label} — pick a line or choose "Entire file"`,
      matchOnDescription: true,
    });
    if (!pickedLine) { return undefined; }

    // Entire-file ref
    if (pickedLine.label === ENTIRE_FILE_LABEL) {
      return {
        uri: pickedFile.uri.toString(),
        fsPath,
        line: -1,
        lineText: '',
      };
    }

    // Single-line ref
    const lineIdx = Number(pickedLine.detail);
    return {
      uri: pickedFile.uri.toString(),
      fsPath,
      line: lineIdx,
      lineText: doc.lineAt(lineIdx).text.slice(0, 80),
    };
  }

  // ── Called from the editor right-click context menu ─────────────────────────
  static async pickFromActiveEditor(): Promise<CodeRef | undefined> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return CodeRefPicker.pick();
    }

    const sel = editor.selection;
    const uri = editor.document.uri;
    const fsPath = vscode.workspace.asRelativePath(uri);

    // Multi-line selection → block ref
    if (!sel.isEmpty && sel.end.line > sel.start.line) {
      const startLine = sel.start.line;
      const endLine = sel.end.line;
      const blockText = editor.document
        .getText(new vscode.Range(startLine, 0, Math.min(endLine, startLine + 4), 0))
        .split('\n')
        .map(l => l.trimEnd())
        .join(' ↵ ')
        .slice(0, 120);

      return {
        uri: uri.toString(),
        fsPath,
        line: startLine,
        lineEnd: endLine,
        lineText: blockText,
      };
    }

    // Single line (cursor or inline selection)
    const line = sel.active.line;
    return {
      uri: uri.toString(),
      fsPath,
      line,
      lineText: editor.document.lineAt(line).text.slice(0, 80),
    };
  }

  // ── Navigate to a ref when the badge is clicked ─────────────────────────────
  static async navigate(ref: CodeRef): Promise<void> {
    const uri = vscode.Uri.parse(ref.uri);
    const doc = await vscode.workspace.openTextDocument(uri);

    // File-only ref → just open the file
    if (ref.line < 0) {
      await vscode.window.showTextDocument(doc, { preserveFocus: false });
      return;
    }

    // Block ref → open with the whole block highlighted
    if (ref.lineEnd !== undefined && ref.lineEnd >= ref.line) {
      const range = new vscode.Range(
        new vscode.Position(ref.line, 0),
        new vscode.Position(ref.lineEnd, doc.lineAt(ref.lineEnd).text.length),
      );
      await vscode.window.showTextDocument(doc, {
        selection: range,
        preserveFocus: false,
      });
      return;
    }

    // Single-line ref
    const pos = new vscode.Position(ref.line, 0);
    await vscode.window.showTextDocument(doc, {
      selection: new vscode.Range(pos, pos),
      preserveFocus: false,
    });
  }
}
