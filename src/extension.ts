import * as vscode from 'vscode';
import { initDiagnostics, updateDiagnostics, scanWorkspace } from './diagnostics';
import { A11yCodeActionProvider, applyAiFixCommand } from './codeActions';
import { A11yReportPanel } from './webview/reportPanel';
import { ScreenReaderPanel } from './webview/screenReaderPanel';
import { BatchFixPreviewPanel } from './webview/batchFixPreviewPanel';
import { createStatusBarItem, updateStatusBarScore } from './statusBar';
import { generateA11yTests } from './testGenerator';
import { compareWithLastCommit } from './gitRegression';
import { exportSarif, exportJson, exportJsonWithAiFixes } from './exportReport';
import { initAiProvider, setAiApiKey } from './ai/provider';
import { getFileBatchFixPreview, getWorkspaceBatchFixPreview } from './ai/batchFixer';
import { invalidateConfigCache } from './config';

export function activate(context: vscode.ExtensionContext): void {
  console.log('A11y Scanner extension activated');

  // Initialize diagnostics collection
  initDiagnostics(context);

  // Initialize AI provider with SecretStorage
  initAiProvider(context.secrets);

  const config = vscode.workspace.getConfiguration('a11y');

  // Scan on file open
  if (config.get<boolean>('scanOnOpen', true)) {
    context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
          updateDiagnostics(editor.document);
        }
      }),
    );
  }

  // Scan on file save
  if (config.get<boolean>('scanOnSave', true)) {
    context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument(document => {
        updateDiagnostics(document);
      }),
    );
  }

  // Also scan when a document is first opened
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(document => {
      updateDiagnostics(document);
    }),
  );

  // Debounced real-time scanning on text change
  const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(event => {
      const key = event.document.uri.toString();
      const existing = debounceTimers.get(key);
      if (existing) { clearTimeout(existing); }
      debounceTimers.set(key, setTimeout(() => {
        debounceTimers.delete(key);
        updateDiagnostics(event.document);
      }, 500));
    }),
  );

  // Scan the currently active file on activation
  if (vscode.window.activeTextEditor) {
    updateDiagnostics(vscode.window.activeTextEditor.document);
  }

  // Watch for .a11yrc.json changes
  const configWatcher = vscode.workspace.createFileSystemWatcher('**/.a11yrc.json');
  configWatcher.onDidChange(() => invalidateConfigCache());
  configWatcher.onDidCreate(() => invalidateConfigCache());
  configWatcher.onDidDelete(() => invalidateConfigCache());
  context.subscriptions.push(configWatcher);

  // ── Status Bar: live accessibility score ──
  createStatusBarItem(context);

  // Update score whenever diagnostics change or the active editor changes
  context.subscriptions.push(
    vscode.languages.onDidChangeDiagnostics(() => updateStatusBarScore()),
  );
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => updateStatusBarScore()),
  );

  // Register code action provider (Quick Fixes) for JSX/TSX files
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      [
        { language: 'typescriptreact' },
        { language: 'javascriptreact' },
      ],
      new A11yCodeActionProvider(),
      {
        providedCodeActionKinds: A11yCodeActionProvider.providedCodeActionKinds,
      },
    ),
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('a11y.scanCurrentFile', async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        await updateDiagnostics(editor.document);
        vscode.window.showInformationMessage('A11y Scanner: File scanned.');
      } else {
        vscode.window.showWarningMessage('A11y Scanner: No active file to scan.');
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('a11y.scanWorkspace', async () => {
      try {
        const totalIssues = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'A11y Scanner: Scanning workspace...',
            cancellable: false,
          },
          async () => {
            return await scanWorkspace();
          },
        );
        vscode.window.showInformationMessage(
          `A11y Scanner: Found ${totalIssues} accessibility issue(s) across the workspace.`,
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        vscode.window.showErrorMessage(`A11y Scanner: Workspace scan failed \u2014 ${msg}`);
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('a11y.showReport', async () => {
      await A11yReportPanel.createOrShow(context);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('a11y.applyAiFix', async (uri: vscode.Uri, diagnostic: vscode.Diagnostic) => {
      await applyAiFixCommand(uri, diagnostic);
    }),
  );

  // ── Screen Reader Preview panel ──
  context.subscriptions.push(
    vscode.commands.registerCommand('a11y.screenReaderPreview', () => {
      ScreenReaderPanel.createOrShow();
    }),
  );

  // ── Set AI API Key securely ──
  context.subscriptions.push(
    vscode.commands.registerCommand('a11y.setApiKey', async () => {
      await setAiApiKey();
    }),
  );

  // ── Generate Accessibility Tests ──
  context.subscriptions.push(
    vscode.commands.registerCommand('a11y.generateTests', async () => {
      await generateA11yTests();
    }),
  );

  // ── Git Regression Tracking ──
  context.subscriptions.push(
    vscode.commands.registerCommand('a11y.compareWithLastCommit', async () => {
      await compareWithLastCommit();
    }),
  );

  // ── CI/CD Export ──
  context.subscriptions.push(
    vscode.commands.registerCommand('a11y.exportSarif', async () => {
      await exportSarif();
    }),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('a11y.exportJson', async () => {
      await exportJson();
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('a11y.exportJsonWithAiFixes', async () => {
      await exportJsonWithAiFixes();
    }),
  );

  // ── Batch AI Fix for Current File ──
  context.subscriptions.push(
    vscode.commands.registerCommand('a11y.batchFixCurrentFile', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('A11y Scanner: No active file to fix.');
        return;
      }

      try {
        const preview = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'A11y Scanner: Analyzing file for fixes...',
            cancellable: false,
          },
          async () => {
            return await getFileBatchFixPreview(editor.document);
          },
        );

        if (preview.appliedCount === 0 && preview.failedCount === 0) {
          vscode.window.showInformationMessage('A11y Scanner: No issues found in this file.');
          return;
        }

        await BatchFixPreviewPanel.createOrShow([preview]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        vscode.window.showErrorMessage(`A11y Scanner: Batch fix failed - ${msg}`);
      }
    }),
  );

  // ── Batch AI Fix for Entire Workspace ──
  context.subscriptions.push(
    vscode.commands.registerCommand('a11y.batchFixWorkspace', async () => {
      try {
        const previews = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'A11y Scanner: Analyzing workspace for fixes...',
            cancellable: false,
          },
          async () => {
            return await getWorkspaceBatchFixPreview();
          },
        );

        if (previews.length === 0) {
          vscode.window.showInformationMessage('A11y Scanner: No accessibility issues found in the workspace.');
          return;
        }

        await BatchFixPreviewPanel.createOrShow(previews);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        vscode.window.showErrorMessage(`A11y Scanner: Workspace batch fix failed - ${msg}`);
      }
    }),
  );
}

export function deactivate(): void {
  console.log('A11y Scanner extension deactivated');
}
