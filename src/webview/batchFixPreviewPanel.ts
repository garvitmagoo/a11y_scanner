import * as vscode from 'vscode';
import type { FileFixPreview } from '../ai/batchFixer';
import { applyBatchFixPreviews, generateFixSummary } from '../ai/batchFixer';

/**
 * Webview panel for displaying batch AI fix previews with before/after comparison.
 */
export class BatchFixPreviewPanel {
  public static currentPanel: BatchFixPreviewPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];
  private previews: FileFixPreview[] = [];
  private selectedIndexes: Set<number> = new Set();

  private constructor(panel: vscode.WebviewPanel) {
    this.panel = panel;
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // Handle messages from the webview
    this.panel.webview.onDidReceiveMessage(
      (message: any) => {
        this.handleWebviewMessage(message);
      },
      null,
      this.disposables,
    );
  }

  /**
   * Create or show the batch fix preview panel.
   */
  public static async createOrShow(previews: FileFixPreview[]): Promise<void> {
    const column = vscode.ViewColumn.Beside;

    if (BatchFixPreviewPanel.currentPanel) {
      BatchFixPreviewPanel.currentPanel.panel.reveal(column);
      BatchFixPreviewPanel.currentPanel.updatePreviews(previews);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'a11yBatchFixPreview',
      'A11y Batch Fix Preview',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );

    BatchFixPreviewPanel.currentPanel = new BatchFixPreviewPanel(panel);
    BatchFixPreviewPanel.currentPanel.updatePreviews(previews);
  }

  /**
   * Update the previews displayed in the panel.
   */
  public updatePreviews(previews: FileFixPreview[]): void {
    this.previews = previews;
    this.selectedIndexes.clear();

    // Select all by default
    for (let i = 0; i < previews.length; i++) {
      this.selectedIndexes.add(i);
    }

    this.panel.webview.html = this.getHtml();
  }

  /**
   * Handle messages from the webview.
   */
  private async handleWebviewMessage(message: any): Promise<void> {
    switch (message.command) {
      case 'toggleFile':
        if (this.selectedIndexes.has(message.index)) {
          this.selectedIndexes.delete(message.index);
        } else {
          this.selectedIndexes.add(message.index);
        }
        this.panel.webview.html = this.getHtml();
        break;

      case 'selectAll':
        this.selectedIndexes.clear();
        for (let i = 0; i < this.previews.length; i++) {
          this.selectedIndexes.add(i);
        }
        this.panel.webview.html = this.getHtml();
        break;

      case 'deselectAll':
        this.selectedIndexes.clear();
        this.panel.webview.html = this.getHtml();
        break;

      case 'applyAll':
        await this.applySelectedFixes();
        break;

      case 'viewDiff':
        await this.viewFileDiff(message.index);
        break;
    }
  }

  /**
   * Apply selected fixes to files.
   */
  private async applySelectedFixes(): Promise<void> {
    const selectedPreviews = Array.from(this.selectedIndexes).map(i => this.previews[i]);

    if (selectedPreviews.length === 0) {
      vscode.window.showWarningMessage('A11y Scanner: No files selected for fixing.');
      return;
    }

    const confirmApply = await vscode.window.showWarningMessage(
      `A11y Scanner: Apply fixes to ${selectedPreviews.length} file(s)?`,
      { modal: true },
      'Apply',
      'Cancel',
    );

    if (confirmApply !== 'Apply') {
      return;
    }

    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'A11y Scanner: Applying batch fixes...',
          cancellable: false,
        },
        async () => {
          await applyBatchFixPreviews(selectedPreviews);
        },
      );

      const summary = generateFixSummary(selectedPreviews);
      vscode.window.showInformationMessage(
        `A11y Scanner: Applied ${summary.appliedFixes} fixes across ${summary.totalFiles} file(s).`,
      );

      this.dispose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      vscode.window.showErrorMessage(`A11y Scanner: Failed to apply fixes - ${msg}`);
    }
  }

  /**
   * Show detailed diff for a file by opening a side-by-side comparison.
   */
  private async viewFileDiff(index: number): Promise<void> {
    const preview = this.previews[index];

    try {
      // Open the original file in the editor
      await vscode.window.showTextDocument(preview.uri, { preview: true });

      // Show information message about the fixes
      const fixedIssuesCount = preview.appliedCount;
      const failedIssuesCount = preview.failedCount;

      const message = `Found ${fixedIssuesCount} fixable issue(s) and ${failedIssuesCount} failed fix(es) in ${preview.path}.

You can see the proposed fixes in the batch fix preview panel. Click "Apply Selected Fixes" to apply them.`;

      vscode.window.showInformationMessage(message);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      vscode.window.showErrorMessage(`A11y Scanner: Failed to open file - ${msg}`);
    }
  }

  /**
   * Generate HTML for the webview.
   */
  private getHtml(): string {
    const summary = generateFixSummary(this.previews);
    const filesHtml = this.previews
      .map((preview, idx) => this.getFilePreviewHtml(preview, idx))
      .join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
  <title>A11y Batch Fix Preview</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 20px;
      line-height: 1.6;
    }
    .header {
      margin-bottom: 20px;
      border-bottom: 1px solid var(--vscode-border);
      padding-bottom: 15px;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 20px;
    }
    .stat {
      padding: 12px;
      background: var(--vscode-textBlockQuote-background);
      border-left: 3px solid var(--vscode-textLink-foreground);
      border-radius: 4px;
    }
    .stat-label {
      font-size: 12px;
      opacity: 0.7;
      text-transform: uppercase;
    }
    .stat-value {
      font-size: 24px;
      font-weight: bold;
      margin-top: 4px;
    }
    .controls {
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    button {
      padding: 8px 16px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      transition: background 0.2s;
    }
    button:hover {
      background: var(--vscode-button-hoverBackground);
    }
    button.danger {
      background: #d32f2f;
    }
    button.primary {
      background: #0e7c0e;
    }
    .file-preview {
      margin-bottom: 16px;
      border: 1px solid var(--vscode-border);
      border-radius: 4px;
      overflow: hidden;
    }
    .file-header {
      background: var(--vscode-sideBar-background);
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      user-select: none;
    }
    .file-header:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .checkbox {
      cursor: pointer;
    }
    .file-path {
      flex: 1;
      font-family: monospace;
      font-size: 12px;
    }
    .file-stats {
      display: flex;
      gap: 12px;
      font-size: 12px;
    }
    .stat-badge {
      padding: 2px 8px;
      border-radius: 3px;
      font-weight: 500;
    }
    .stat-badge.applied {
      background: #2d7d2d;
      color: #4ec94e;
    }
    .stat-badge.failed {
      background: #802020;
      color: #f48771;
    }
    .file-content {
      display: none;
      padding: 16px;
      background: var(--vscode-editor-background);
    }
    .file-content.active {
      display: block;
    }
    .diff-section {
      margin-bottom: 16px;
    }
    .diff-header {
      display: flex;
      gap: 12px;
      margin-bottom: 8px;
      font-size: 12px;
      font-weight: 600;
    }
    .code-block {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
      border-radius: 4px;
      overflow: hidden;
    }
    .code-original, .code-fixed {
      flex: 1;
      background: var(--vscode-textCodeBlock-background);
      border: 1px solid var(--vscode-border);
      border-radius: 4px;
      padding: 12px;
      font-family: monospace;
      font-size: 11px;
      white-space: pre-wrap;
      word-break: break-word;
      max-height: 200px;
      overflow: auto;
    }
    .code-original {
      border-left: 3px solid #d32f2f;
    }
    .code-fixed {
      border-left: 3px solid #2d7d2d;
    }
    .issue-label {
      font-size: 12px;
      color: var(--vscode-textLink-foreground);
      margin-bottom: 4px;
    }
    .view-diff-btn {
      padding: 4px 12px;
      font-size: 11px;
      background: var(--vscode-inputOption-activeBorder);
      color: var(--vscode-foreground);
      border: 1px solid var(--vscode-inputOption-activeBorder);
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Batch A11y Fix Preview</h1>
    <p>Review and apply AI-powered accessibility fixes across ${summary.totalFiles} file(s)</p>
  </div>

  <div class="summary">
    <div class="stat">
      <div class="stat-label">Files</div>
      <div class="stat-value">${summary.totalFiles}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Total Issues</div>
      <div class="stat-value">${summary.totalIssues}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Applied Fixes</div>
      <div class="stat-value" style="color: #4ec94e;">${summary.appliedFixes}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Failed Fixes</div>
      <div class="stat-value" style="color: #f48771;">${summary.failedFixes}</div>
    </div>
  </div>

  <div class="controls">
    <button class="primary" onclick="applyAll()">Apply Selected Fixes</button>
    <button onclick="selectAll()">Select All</button>
    <button onclick="deselectAll()">Deselect All</button>
  </div>

  <div id="files">
    ${filesHtml}
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function toggleFile(index) {
      vscode.postMessage({ command: 'toggleFile', index });
    }

    function selectAll() {
      vscode.postMessage({ command: 'selectAll' });
    }

    function deselectAll() {
      vscode.postMessage({ command: 'deselectAll' });
    }

    function applyAll() {
      vscode.postMessage({ command: 'applyAll' });
    }

    function viewDiff(index) {
      vscode.postMessage({ command: 'viewDiff', index });
    }

    function toggleContent(index) {
      const content = document.getElementById('content-' + index);
      content?.classList.toggle('active');
    }
  </script>
</body>
</html>`;
  }

  /**
   * Generate HTML for a single file preview.
   */
  private getFilePreviewHtml(preview: FileFixPreview, index: number): string {
    const isSelected = this.selectedIndexes.has(index);
    const issuesList = preview.issues
      .map((issueFix) => {
        const { issue, fixedCode, explanation, error } = issueFix;

        return `
          <div class="diff-section">
            <div class="issue-label">${issue.rule} (Line ${issue.line + 1}): ${issue.message}</div>
            ${explanation ? `<div style="font-size: 11px; color: var(--vscode-textLink-foreground); margin-bottom: 8px;">💡 ${explanation}</div>` : ''}
            ${error ? `<div style="font-size: 11px; color: #f48771; margin-bottom: 8px;">⚠ ${error}</div>` : ''}
            <div class="code-block">
              <div>
                <div style="font-size: 11px; color: #f48771; margin-bottom: 4px;">Original</div>
                <pre class="code-original">${this.escapeHtml(issue.snippet)}</pre>
              </div>
              <div>
                <div style="font-size: 11px; color: #4ec94e; margin-bottom: 4px;">Fixed</div>
                <pre class="code-fixed">${fixedCode ? this.escapeHtml(fixedCode) : 'N/A'}</pre>
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    return `
      <div class="file-preview">
        <div class="file-header" onclick="toggleContent(${index})">
          <input type="checkbox" class="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleFile(${index})">
          <div class="file-path">${preview.path}</div>
          <div class="file-stats">
            <span class="stat-badge applied">${preview.appliedCount} applied</span>
            ${preview.failedCount > 0 ? `<span class="stat-badge failed">${preview.failedCount} failed</span>` : ''}
          </div>
          <button class="view-diff-btn" onclick="viewDiff(${index}); event.stopPropagation();">Open File</button>
        </div>
        <div id="content-${index}" class="file-content">
          ${issuesList}
        </div>
      </div>
    `;
  }

  /**
   * Escape HTML special characters.
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  /**
   * Dispose of the panel.
   */
  public dispose(): void {
    BatchFixPreviewPanel.currentPanel = undefined;
    this.panel.dispose();
    this.disposables.forEach(d => d.dispose());
  }
}
