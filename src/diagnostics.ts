import * as vscode from 'vscode';
import { scanForA11yIssues } from './scanner/astScanner';
import { toVscodeSeverity } from './types';
import { loadConfig, applyConfig, isExcluded } from './config';

const SUPPORTED_LANGUAGES = new Set([
  'typescriptreact', 'javascriptreact', 'typescript', 'javascript',
]);

let diagnosticCollection: vscode.DiagnosticCollection;

export function initDiagnostics(context: vscode.ExtensionContext): vscode.DiagnosticCollection {
  diagnosticCollection = vscode.languages.createDiagnosticCollection('a11y');
  context.subscriptions.push(diagnosticCollection);
  return diagnosticCollection;
}

export function getDiagnosticCollection(): vscode.DiagnosticCollection {
  return diagnosticCollection;
}

/**
 * Scan a single document and update its diagnostics.
 */
export async function updateDiagnostics(document: vscode.TextDocument): Promise<void> {
  if (!SUPPORTED_LANGUAGES.has(document.languageId)) {
    return;
  }

  const config = await loadConfig();
  if (isExcluded(config, document.fileName)) {
    diagnosticCollection.delete(document.uri);
    return;
  }

  let issues = scanForA11yIssues(document.getText(), document.fileName);
  issues = applyConfig(config, issues);

  const diagnostics = issues.map(issue => {
    const startPos = new vscode.Position(issue.line, issue.column);
    const endPos = issue.endLine !== undefined && issue.endColumn !== undefined
      ? new vscode.Position(issue.endLine, issue.endColumn)
      : document.lineAt(issue.line).range.end;

    const range = new vscode.Range(startPos, endPos);
    const diagnostic = new vscode.Diagnostic(range, issue.message, toVscodeSeverity(issue.severity));
    diagnostic.source = 'A11y Scanner';
    diagnostic.code = issue.rule;
    return diagnostic;
  });

  diagnosticCollection.set(document.uri, diagnostics);
}

/**
 * Clear diagnostics for a document.
 */
export function clearDiagnostics(uri: vscode.Uri): void {
  diagnosticCollection.delete(uri);
}

/**
 * Scan all open documents.
 */
export async function scanAllOpenDocuments(): Promise<void> {
  for (const document of vscode.workspace.textDocuments) {
    await updateDiagnostics(document);
  }
}

/**
 * Scan all matching files in the workspace.
 */
export async function scanWorkspace(): Promise<number> {
  const files = await vscode.workspace.findFiles(
    '**/*.{tsx,jsx}',
    '**/node_modules/**'
  );

  const config = await loadConfig();
  let totalIssues = 0;

  for (const fileUri of files) {
    if (isExcluded(config, fileUri.fsPath)) {
      continue;
    }

    const document = await vscode.workspace.openTextDocument(fileUri);
    let issues = scanForA11yIssues(document.getText(), document.fileName);
    issues = applyConfig(config, issues);

    const diagnostics = issues.map(issue => {
      const startPos = new vscode.Position(issue.line, issue.column);
      const endPos = issue.endLine !== undefined && issue.endColumn !== undefined
        ? new vscode.Position(issue.endLine, issue.endColumn)
        : document.lineAt(issue.line).range.end;
      const range = new vscode.Range(startPos, endPos);
      const diagnostic = new vscode.Diagnostic(range, issue.message, toVscodeSeverity(issue.severity));
      diagnostic.source = 'A11y Scanner';
      diagnostic.code = issue.rule;
      return diagnostic;
    });

    diagnosticCollection.set(fileUri, diagnostics);
    totalIssues += issues.length;
  }

  return totalIssues;
}
