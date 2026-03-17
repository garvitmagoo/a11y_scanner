import * as vscode from 'vscode';
import { simulateScreenReader, ScreenReaderAnnouncement } from '../scanner/screenReaderSimulator';

/**
 * Webview panel that shows what a screen reader would announce
 * for elements in the active file.
 */
export class ScreenReaderPanel {
  public static currentPanel: ScreenReaderPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel) {
    this.panel = panel;
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // Refresh when the active editor changes
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => this.refresh()),
    );

    // Refresh when the active document is edited
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument(e => {
        if (vscode.window.activeTextEditor?.document === e.document) {
          this.refresh();
        }
      }),
    );
  }

  public static createOrShow(): void {
    const column = vscode.ViewColumn.Beside;

    if (ScreenReaderPanel.currentPanel) {
      ScreenReaderPanel.currentPanel.panel.reveal(column);
      ScreenReaderPanel.currentPanel.refresh();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'a11yScreenReader',
      'Screen Reader Preview',
      column,
      {
        enableScripts: false,
        retainContextWhenHidden: true,
      },
    );

    ScreenReaderPanel.currentPanel = new ScreenReaderPanel(panel);
    ScreenReaderPanel.currentPanel.refresh();
  }

  private refresh(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      this.panel.webview.html = buildEmptyHtml(this.panel.webview, 'No active file');
      return;
    }

    const doc = editor.document;
    const supported = ['typescriptreact', 'javascriptreact', 'typescript', 'javascript'];
    if (!supported.includes(doc.languageId)) {
      this.panel.webview.html = buildEmptyHtml(this.panel.webview, 'Not a JSX/TSX file');
      return;
    }

    const announcements = simulateScreenReader(doc.getText(), doc.fileName);
    this.panel.webview.html = buildHtml(announcements, vscode.workspace.asRelativePath(doc.uri), this.panel.webview);
  }

  private dispose(): void {
    ScreenReaderPanel.currentPanel = undefined;
    this.panel.dispose();
    this.disposables.forEach(d => d.dispose());
  }
}

/* ── HTML builders ──────────────────────────────────────── */

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildEmptyHtml(_webview: vscode.Webview, reason: string): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
<style>body{font-family:var(--vscode-font-family);color:var(--vscode-foreground);background:var(--vscode-editor-background);display:flex;align-items:center;justify-content:center;height:90vh;opacity:.6;}</style>
</head><body><p>${esc(reason)}</p></body></html>`;
}

function buildHtml(items: ScreenReaderAnnouncement[], filePath: string, _webview: vscode.Webview): string {
  const issueCount = items.filter(i => i.hasIssue).length;

  const rows = items.map((a, idx) => {
    const cls = a.hasIssue ? 'issue' : '';
    const icon = a.hasIssue ? '&#9888;' : '&#128266;';
    const issueTag = a.hasIssue && a.issueMessage
      ? `<div class="issue-msg">${esc(a.issueMessage)}</div>`
      : '';

    return `
      <tr class="${cls}">
        <td class="idx">${idx + 1}</td>
        <td class="icon">${icon}</td>
        <td>
          <div class="announcement">${esc(a.announcement)}</div>
          <div class="meta">
            <span class="element">${esc(a.element)}</span>
            <span class="role">${esc(a.role)}</span>
            <span class="loc">line ${a.line + 1}</span>
          </div>
          ${issueTag}
        </td>
      </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
  <title>Screen Reader Preview</title>
  <style>
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); padding: 16px; margin: 0; }
    h1 { font-size: 1.3em; margin: 0 0 4px; }
    .subtitle { opacity: .7; font-size: .85em; margin-bottom: 16px; }
    .summary { display: flex; gap: 20px; margin-bottom: 18px; padding: 10px 14px; background: var(--vscode-editor-inactiveSelectionBackground); border-radius: 6px; }
    .summary-item .number { font-size: 1.6em; font-weight: bold; }
    .summary-item .label { font-size: .8em; opacity: .7; }
    .ok .number { color: var(--vscode-charts-green, #89d185); }
    .warn .number { color: var(--vscode-charts-orange, #cca700); }
    table { width: 100%; border-collapse: collapse; }
    tr { border-bottom: 1px solid var(--vscode-panel-border); }
    tr.issue { background: rgba(255, 80, 80, 0.07); }
    td { padding: 8px 6px; vertical-align: top; }
    .idx { width: 28px; opacity: .45; font-size: .85em; text-align: right; padding-right: 10px; }
    .icon { width: 22px; font-size: 1.1em; }
    .announcement { font-weight: 500; margin-bottom: 3px; }
    .meta { display: flex; gap: 10px; font-size: .8em; opacity: .6; }
    .element { font-family: var(--vscode-editor-font-family, monospace); }
    .role { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); padding: 1px 6px; border-radius: 8px; font-size: .85em; }
    .loc { margin-left: auto; }
    .issue-msg { margin-top: 4px; font-size: .82em; color: var(--vscode-errorForeground); }
    .empty { text-align: center; padding: 40px; opacity: .5; }
  </style>
</head>
<body>
  <h1>&#128266; Screen Reader Preview</h1>
  <div class="subtitle">${esc(filePath)}</div>

  <div class="summary">
    <div class="summary-item ${issueCount === 0 ? 'ok' : ''}">
      <div class="number">${items.length}</div>
      <div class="label">Elements</div>
    </div>
    <div class="summary-item ok">
      <div class="number">${items.length - issueCount}</div>
      <div class="label">Accessible</div>
    </div>
    <div class="summary-item ${issueCount > 0 ? 'warn' : 'ok'}">
      <div class="number">${issueCount}</div>
      <div class="label">Missing Names</div>
    </div>
  </div>

  ${items.length === 0
    ? '<p class="empty">No semantic or interactive elements found in this file.</p>'
    : `<table><tbody>${rows}</tbody></table>`}
</body>
</html>`;
}
