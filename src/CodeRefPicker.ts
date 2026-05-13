import * as vscode from 'vscode';
import type { CodeRef } from './types';

export class CodeRefPicker {
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

    const fileItems = workspaceFiles.map(uri => ({
      label: vscode.workspace.asRelativePath(uri),
      description: uri.fsPath,
      uri,
    }));

    const pickedFile = await vscode.window.showQuickPick(fileItems, {
      placeHolder: 'Select a file to reference',
      matchOnDescription: true,
    });
    if (!pickedFile) return undefined;

    const doc = await vscode.workspace.openTextDocument(pickedFile.uri);

    const lineItems = Array.from({ length: doc.lineCount }, (_, i) => ({
      label: `${i + 1}`,
      description: doc.lineAt(i).text.trim().slice(0, 80),
      line: i,
    }));

    const pickedLine = await vscode.window.showQuickPick(lineItems, {
      placeHolder: `Select a line in ${pickedFile.label}`,
      matchOnDescription: true,
    });
    if (!pickedLine) return undefined;

    return {
      uri: pickedFile.uri.toString(),
      line: pickedLine.line,
      lineText: doc.lineAt(pickedLine.line).text.slice(0, 80),
      fsPath: vscode.workspace.asRelativePath(pickedFile.uri),
    };
  }

  static async pickFromActiveEditor(): Promise<CodeRef | undefined> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return CodeRefPicker.pick();
    }
    const line = editor.selection.active.line;
    const uri = editor.document.uri;
    return {
      uri: uri.toString(),
      line,
      lineText: editor.document.lineAt(line).text.slice(0, 80),
      fsPath: vscode.workspace.asRelativePath(uri),
    };
  }

  static async navigate(ref: CodeRef): Promise<void> {
    const uri = vscode.Uri.parse(ref.uri);
    const doc = await vscode.workspace.openTextDocument(uri);
    const pos = new vscode.Position(ref.line, 0);
    await vscode.window.showTextDocument(doc, {
      selection: new vscode.Range(pos, pos),
      preserveFocus: false,
    });
  }
}
