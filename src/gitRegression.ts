import * as vscode from 'vscode';
import { scanForA11yIssues } from './scanner/astScanner';
import type { A11yIssue } from './types';
import * as cp from 'child_process';

/**
 * Compares accessibility scan results between the current working tree
 * and the previous git commit (HEAD). Shows new, fixed, and unchanged issues.
 */

interface RegressionResult {
  newIssues: FileIssues[];
  fixedIssues: FileIssues[];
  unchangedCount: number;
  currentTotal: number;
  previousTotal: number;
  filesScanned: number;
}

interface FileIssues {
  file: string;
  issues: A11yIssue[];
}

/**
 * Run the git regression comparison command.
 */
export async function compareWithLastCommit(): Promise<void> {
  try {
    await compareWithLastCommitUnsafe();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    vscode.window.showErrorMessage(`A11y Scanner: Git comparison failed — ${msg}`);
  }
}

async function compareWithLastCommitUnsafe(): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showWarningMessage('A11y Scanner: No workspace folder open.');
    return;
  }

  const cwd = workspaceFolder.uri.fsPath;

  // Verify git is available and this is a git repo
  if (!(await isGitRepo(cwd))) {
    vscode.window.showWarningMessage('A11y Scanner: This workspace is not a git repository.');
    return;
  }

  const result = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'A11y Scanner: Comparing with last commit...',
      cancellable: false,
    },
    async () => {
      return await runComparison(cwd);
    },
  );

  if (!result) {
    return;
  }

  await showRegressionReport(result);
}

async function isGitRepo(cwd: string): Promise<boolean> {
  return new Promise(resolve => {
    cp.exec('git rev-parse --is-inside-work-tree', { cwd }, (err) => {
      resolve(!err);
    });
  });
}

/**
 * Get file contents at HEAD for a given path, or null if the file didn't exist.
 */
async function getFileAtHead(cwd: string, relativePath: string): Promise<string | null> {
  const safePath = relativePath.replace(/\\/g, '/');
  return new Promise(resolve => {
    cp.execFile('git', ['show', `HEAD:${safePath}`], {
      cwd,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    }, (err, stdout) => {
      resolve(err ? null : stdout);
    });
  });
}

async function runComparison(cwd: string): Promise<RegressionResult | null> {
  // Find all TSX/JSX files in the workspace
  const files = await vscode.workspace.findFiles('**/*.{tsx,jsx}', '**/node_modules/**');

  const newIssues: FileIssues[] = [];
  const fixedIssues: FileIssues[] = [];
  let unchangedCount = 0;
  let currentTotal = 0;
  let previousTotal = 0;

  for (const fileUri of files) {
    const document = await vscode.workspace.openTextDocument(fileUri);
    const currentSource = document.getText();
    const relativePath = vscode.workspace.asRelativePath(fileUri);

    // Scan current version
    const currentIssues = scanForA11yIssues(currentSource, document.fileName);
    currentTotal += currentIssues.length;

    // Scan previous version from HEAD
    const previousSource = await getFileAtHead(cwd, relativePath);
    const previousIssues = previousSource
      ? scanForA11yIssues(previousSource, document.fileName)
      : [];
    previousTotal += previousIssues.length;

    // Diff: key each issue by rule+line+message for comparison
    const prevKeys = new Set(previousIssues.map(issueKey));
    const currKeys = new Set(currentIssues.map(issueKey));

    const introduced = currentIssues.filter(i => !prevKeys.has(issueKey(i)));
    const resolved = previousIssues.filter(i => !currKeys.has(issueKey(i)));
    const unchanged = currentIssues.filter(i => prevKeys.has(issueKey(i)));
    unchangedCount += unchanged.length;

    if (introduced.length > 0) {
      newIssues.push({ file: relativePath, issues: introduced });
    }
    if (resolved.length > 0) {
      fixedIssues.push({ file: relativePath, issues: resolved });
    }
  }

  return {
    newIssues,
    fixedIssues,
    unchangedCount,
    currentTotal,
    previousTotal,
    filesScanned: files.length,
  };
}

/**
 * Create a stable key for an issue. Uses rule + message (not line number,
 * since refactoring can shift lines without changing the issue).
 */
function issueKey(issue: A11yIssue): string {
  return `${issue.rule}::${issue.message}`;
}

/* ── Webview report ─────────────────────────────────────────────────────── */

async function showRegressionReport(result: RegressionResult): Promise<void> {
  const panel = vscode.window.createWebviewPanel(
    'a11yRegression',
    'A11y Regression Report',
    vscode.ViewColumn.Beside,
    { enableScripts: true },
  );

  panel.webview.html = buildRegressionHtml(result, panel.webview);
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildRegressionHtml(r: RegressionResult, webview: vscode.Webview): string {
  const nonce = getNonce();
  const cspSource = webview.cspSource;

  const delta = r.currentTotal - r.previousTotal;
  const deltaStr = delta > 0 ? `+${delta}` : `${delta}`;
  const deltaClass = delta > 0 ? 'worse' : delta < 0 ? 'better' : 'same';

  const newCount = r.newIssues.reduce((n, f) => n + f.issues.length, 0);
  const fixedCount = r.fixedIssues.reduce((n, f) => n + f.issues.length, 0);

  const newRows = r.newIssues.flatMap(f =>
    f.issues.map(i => `
      <tr class="new">
        <td class="badge-cell"><span class="badge new-badge">NEW</span></td>
        <td>${esc(f.file)}</td>
        <td>${esc(i.message)}</td>
        <td><code>${esc(i.rule)}</code></td>
      </tr>`),
  ).join('');

  const fixedRows = r.fixedIssues.flatMap(f =>
    f.issues.map(i => `
      <tr class="fixed">
        <td class="badge-cell"><span class="badge fixed-badge">FIXED</span></td>
        <td>${esc(f.file)}</td>
        <td>${esc(i.message)}</td>
        <td><code>${esc(i.rule)}</code></td>
      </tr>`),
  ).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'nonce-${nonce}';">
  <title>A11y Regression Report</title>
  <style nonce="${nonce}">
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); padding: 16px; margin: 0; }
    h1 { font-size: 1.3em; margin: 0 0 4px; }
    .subtitle { opacity: .7; font-size: .85em; margin-bottom: 16px; }
    .summary { display: flex; gap: 20px; margin-bottom: 24px; padding: 12px 16px; background: var(--vscode-editor-inactiveSelectionBackground); border-radius: 6px; flex-wrap: wrap; }
    .summary-item { text-align: center; min-width: 80px; }
    .summary-item .number { font-size: 1.8em; font-weight: bold; }
    .summary-item .label { font-size: .8em; opacity: .7; }
    .worse .number { color: var(--vscode-errorForeground, #f44); }
    .better .number { color: var(--vscode-charts-green, #89d185); }
    .same .number { color: var(--vscode-foreground); }
    .new-count .number { color: var(--vscode-errorForeground, #f44); }
    .fixed-count .number { color: var(--vscode-charts-green, #89d185); }
    h2 { font-size: 1.1em; margin: 24px 0 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    td { padding: 6px 10px; border-bottom: 1px solid var(--vscode-panel-border); font-size: .9em; vertical-align: top; }
    tr.new { background: rgba(255, 80, 80, 0.06); }
    tr.fixed { background: rgba(80, 200, 80, 0.06); }
    .badge { padding: 2px 8px; border-radius: 8px; font-size: .75em; font-weight: bold; }
    .new-badge { background: var(--vscode-errorForeground, #f44); color: #fff; }
    .fixed-badge { background: var(--vscode-charts-green, #89d185); color: #000; }
    .badge-cell { width: 60px; }
    code { background: var(--vscode-textCodeBlock-background); padding: 1px 4px; border-radius: 3px; font-size: .85em; }
    .empty { opacity: .5; padding: 12px 0; }
  </style>
</head>
<body>
  <h1>Accessibility Regression Report</h1>
  <div class="subtitle">Comparing working tree vs. last commit (HEAD)</div>

  <div class="summary">
    <div class="summary-item ${deltaClass}">
      <div class="number">${deltaStr}</div>
      <div class="label">Net Change</div>
    </div>
    <div class="summary-item new-count">
      <div class="number">${newCount}</div>
      <div class="label">New Issues</div>
    </div>
    <div class="summary-item fixed-count">
      <div class="number">${fixedCount}</div>
      <div class="label">Fixed</div>
    </div>
    <div class="summary-item">
      <div class="number">${r.unchangedCount}</div>
      <div class="label">Unchanged</div>
    </div>
    <div class="summary-item">
      <div class="number">${r.previousTotal} → ${r.currentTotal}</div>
      <div class="label">Total Issues</div>
    </div>
    <div class="summary-item">
      <div class="number">${r.filesScanned}</div>
      <div class="label">Files Scanned</div>
    </div>
  </div>

  <h2>New Issues Introduced (${newCount})</h2>
  ${newCount > 0
    ? `<table><tbody>${newRows}</tbody></table>`
    : '<p class="empty">No new accessibility issues introduced.</p>'}

  <h2>Issues Fixed (${fixedCount})</h2>
  ${fixedCount > 0
    ? `<table><tbody>${fixedRows}</tbody></table>`
    : '<p class="empty">No issues fixed since last commit.</p>'}
</body>
</html>`;
}
