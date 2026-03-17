import * as vscode from 'vscode';
import { scanForA11yIssues } from '../scanner/astScanner';
import type { A11yIssue } from '../types';

/**
 * Generates an HTML report of accessibility issues across the workspace.
 */
export class A11yReportPanel {
  public static currentPanel: A11yReportPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel) {
    this.panel = panel;
    this.panel.webview.html = this.getLoadingHtml();
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  private getLoadingHtml(): string {
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';"><style>body{font-family:var(--vscode-font-family);color:var(--vscode-foreground);background:var(--vscode-editor-background);display:flex;align-items:center;justify-content:center;height:90vh;opacity:.6;}</style>
</head><body><p>Scanning workspace…</p></body></html>`;
  }

  public static async createOrShow(_context: vscode.ExtensionContext): Promise<void> {
    const column = vscode.ViewColumn.Beside;

    if (A11yReportPanel.currentPanel) {
      A11yReportPanel.currentPanel.panel.reveal(column);
      await A11yReportPanel.currentPanel.update();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'a11yReport',
      'A11y Accessibility Report',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );

    A11yReportPanel.currentPanel = new A11yReportPanel(panel);
    await A11yReportPanel.currentPanel.update();
  }

  private async update(): Promise<void> {
    const files = await vscode.workspace.findFiles('**/*.{tsx,jsx}', '**/node_modules/**');

    const issuesByFile: { file: string; issues: { message: string; rule: string; severity: string; line: number }[] }[] = [];
    let totalIssues = 0;
    const ruleCount: Record<string, number> = {};

    for (const fileUri of files) {
      const document = await vscode.workspace.openTextDocument(fileUri);
      const issues = scanForA11yIssues(document.getText(), document.fileName);

      if (issues.length > 0) {
        const relativePath = vscode.workspace.asRelativePath(fileUri);
        issuesByFile.push({
          file: relativePath,
          issues: issues.map((i: A11yIssue) => ({ message: i.message, rule: i.rule, severity: i.severity, line: i.line + 1 })),
        });
        totalIssues += issues.length;
        issues.forEach((i: A11yIssue) => {
          ruleCount[i.rule] = (ruleCount[i.rule] || 0) + 1;
        });
      }
    }

    this.panel.webview.html = this.getHtml(issuesByFile, totalIssues, ruleCount, files.length);
  }

  private getHtml(
    issuesByFile: { file: string; issues: { message: string; rule: string; severity: string; line: number }[] }[],
    totalIssues: number,
    ruleCount: Record<string, number>,
    totalFiles: number,
  ): string {
    const sortedRules = Object.entries(ruleCount).sort((a, b) => b[1] - a[1]);

    const fileRows = issuesByFile
      .sort((a, b) => b.issues.length - a.issues.length)
      .map(f => {
        const issueRows = f.issues.map(i => `
          <tr class="issue-row">
            <td class="severity ${i.severity}">${i.severity.toUpperCase()}</td>
            <td>Line ${i.line}</td>
            <td>${escapeHtml(i.message)}</td>
            <td><code>${i.rule}</code></td>
          </tr>
        `).join('');

        return `
          <div class="file-section">
            <div class="file-header" data-toggle="collapse">
              <span class="chevron">&#9660;</span>
              <strong>${escapeHtml(f.file)}</strong>
              <span class="badge">${f.issues.length}</span>
            </div>
            <table class="issues-table">
              <tbody>${issueRows}</tbody>
            </table>
          </div>
        `;
      }).join('');

    const ruleRows = sortedRules.map(([rule, count]) => `
      <tr><td><code>${rule}</code></td><td>${count}</td></tr>
    `).join('');

    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>A11y Report</title>
  <style>
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); padding: 16px; }
    h1 { font-size: 1.4em; margin-bottom: 8px; }
    .summary { display: flex; gap: 24px; margin-bottom: 24px; padding: 12px; background: var(--vscode-editor-inactiveSelectionBackground); border-radius: 6px; }
    .summary-item { text-align: center; }
    .summary-item .number { font-size: 2em; font-weight: bold; color: var(--vscode-charts-orange); }
    .summary-item .label { font-size: 0.85em; opacity: 0.8; }
    .file-section { margin-bottom: 8px; border: 1px solid var(--vscode-panel-border); border-radius: 4px; }
    .file-section.collapsed .issues-table { display: none; }
    .file-section.collapsed .chevron { transform: rotate(-90deg); }
    .file-header { padding: 8px 12px; cursor: pointer; display: flex; align-items: center; gap: 8px; background: var(--vscode-editor-inactiveSelectionBackground); }
    .file-header:hover { background: var(--vscode-list-hoverBackground); }
    .chevron { display: inline-block; transition: transform 0.2s; font-size: 0.7em; }
    .badge { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); padding: 2px 8px; border-radius: 10px; font-size: 0.8em; }
    .issues-table { width: 100%; border-collapse: collapse; }
    .issue-row td { padding: 6px 12px; border-top: 1px solid var(--vscode-panel-border); font-size: 0.9em; }
    .severity { font-weight: bold; font-size: 0.75em; width: 70px; }
    .severity.error { color: var(--vscode-errorForeground); }
    .severity.warning { color: var(--vscode-charts-orange); }
    .severity.info { color: var(--vscode-charts-blue); }
    .rule-table { width: 100%; max-width: 400px; border-collapse: collapse; margin-bottom: 24px; }
    .rule-table td { padding: 4px 12px; border-bottom: 1px solid var(--vscode-panel-border); }
    code { background: var(--vscode-textCodeBlock-background); padding: 1px 4px; border-radius: 3px; }
  </style>
</head>
<body>
  <h1>Accessibility Report</h1>

  <div class="summary">
    <div class="summary-item">
      <div class="number">${totalIssues}</div>
      <div class="label">Total Issues</div>
    </div>
    <div class="summary-item">
      <div class="number">${issuesByFile.length}</div>
      <div class="label">Files with Issues</div>
    </div>
    <div class="summary-item">
      <div class="number">${totalFiles}</div>
      <div class="label">Files Scanned</div>
    </div>
    <div class="summary-item">
      <div class="number">${sortedRules.length}</div>
      <div class="label">Rule Types</div>
    </div>
  </div>

  <h2>Issues by Rule</h2>
  <table class="rule-table">
    <tbody>${ruleRows}</tbody>
  </table>

  <h2>Issues by File</h2>
  ${fileRows || '<p>No accessibility issues found.</p>'}
  <script nonce="${nonce}">
    document.querySelectorAll('[data-toggle="collapse"]').forEach(function(el) {
      el.addEventListener('click', function() {
        this.parentElement.classList.toggle('collapsed');
      });
    });
  </script>
</body>
</html>`;
  }

  private dispose(): void {
    A11yReportPanel.currentPanel = undefined;
    this.panel.dispose();
    this.disposables.forEach(d => d.dispose());
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}
