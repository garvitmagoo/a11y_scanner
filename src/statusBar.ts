import * as vscode from 'vscode';

let statusBarItem: vscode.StatusBarItem;
let lastUri: string | undefined;
let lastScore: number | undefined;
let lastCount: number | undefined;

export function createStatusBarItem(context: vscode.ExtensionContext): vscode.StatusBarItem {
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = 'a11y.showReport';
  statusBarItem.tooltip = 'Accessibility score for current file — click to view report';
  context.subscriptions.push(statusBarItem);
  statusBarItem.show();
  updateStatusBarScore();
  return statusBarItem;
}

/**
 * Recalculate and display the a11y score based on diagnostics for the active file.
 */
export function updateStatusBarScore(): void {
  if (!statusBarItem) {
    return;
  }

  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    statusBarItem.text = '$(eye) A11y: —';
    statusBarItem.backgroundColor = undefined;
    statusBarItem.tooltip = 'No active file';
    return;
  }

  const diagnostics = vscode.languages.getDiagnostics(editor.document.uri)
    .filter(d => d.source === 'A11y Scanner');

  const currentUri = editor.document.uri.toString();
  const score = computeScore(diagnostics);
  const count = diagnostics.length;

  // Skip update if nothing changed
  if (currentUri === lastUri && score === lastScore && count === lastCount) {
    return;
  }
  lastUri = currentUri;
  lastScore = score;
  lastCount = count;

  if (diagnostics.length === 0) {
    statusBarItem.text = `$(check) A11y: ${score}/100`;
    statusBarItem.backgroundColor = undefined;
    statusBarItem.tooltip = 'No accessibility issues found!';
  } else if (score >= 80) {
    statusBarItem.text = `$(check) A11y: ${score}/100`;
    statusBarItem.backgroundColor = undefined;
    statusBarItem.tooltip = `${diagnostics.length} issue(s) — good accessibility`;
  } else if (score >= 50) {
    statusBarItem.text = `$(warning) A11y: ${score}/100`;
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    statusBarItem.tooltip = `${diagnostics.length} issue(s) — needs improvement`;
  } else {
    statusBarItem.text = `$(error) A11y: ${score}/100`;
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    statusBarItem.tooltip = `${diagnostics.length} issue(s) — poor accessibility`;
  }
}

function computeScore(diagnostics: vscode.Diagnostic[]): number {
  let penalty = 0;

  for (const d of diagnostics) {
    switch (d.severity) {
      case vscode.DiagnosticSeverity.Error:
        penalty += 10;
        break;
      case vscode.DiagnosticSeverity.Warning:
        penalty += 5;
        break;
      case vscode.DiagnosticSeverity.Information:
        penalty += 2;
        break;
      case vscode.DiagnosticSeverity.Hint:
        penalty += 1;
        break;
    }
  }

  return Math.max(0, 100 - penalty);
}
