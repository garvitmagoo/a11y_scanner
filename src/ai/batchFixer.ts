import * as vscode from 'vscode';
import type { A11yIssue } from '../types';
import { getAiFix } from './provider';
import { scanForA11yIssues } from '../scanner/astScanner';
import { loadConfig, applyConfig, isExcluded } from '../config';

/**
 * Represents a file with accessibility issues and their proposed fixes.
 */
export interface FileFixPreview {
  uri: vscode.Uri;
  path: string;
  originalCode: string;
  fixedCode: string;
  issues: IssueFix[];
  appliedCount: number;
  failedCount: number;
}

/**
 * Represents a single issue and its fix.
 */
export interface IssueFix {
  issue: A11yIssue;
  status: 'pending' | 'applied' | 'failed';
  fixedCode?: string;
  explanation?: string;
  error?: string;
}

/**
 * Batch fix result for a single file.
 */
export interface BatchFixResult {
  filePath: string;
  totalIssues: number;
  appliedFixes: number;
  failedFixes: number;
  content: string;
}

/**
 * Applies AI fixes to multiple issues in a file.
 * Returns a preview without modifying the file.
 */
export async function getFileBatchFixPreview(
  document: vscode.TextDocument,
): Promise<FileFixPreview> {
  const originalCode = document.getText();
  const fileName = document.fileName;

  // Scan for all issues
  let issues = scanForA11yIssues(originalCode, fileName);
  const config = await loadConfig();
  issues = applyConfig(config, issues);

  // Prepare fixes for each issue
  const issueFixes: IssueFix[] = issues.map(issue => ({
    issue,
    status: 'pending',
  }));

  // Get AI fixes for each issue
  for (const issueFix of issueFixes) {
    const surroundingContext = getContextSnippet(originalCode, issueFix.issue);
    const codeSnippet = issueFix.issue.snippet;

    const aiFix = await getAiFix(codeSnippet, issueFix.issue, surroundingContext);
    if (aiFix) {
      issueFix.status = 'applied';
      issueFix.fixedCode = aiFix.fixedCode;
      issueFix.explanation = aiFix.explanation;
    } else {
      issueFix.status = 'failed';
      issueFix.error = 'Failed to get AI fix';
    }
  }

  // Apply fixes to generate fixed code
  let fixedCode = originalCode;
  let appliedCount = 0;
  let failedCount = 0;

  // Sort issues by line number in reverse to avoid offset issues
  const sortedFixes = [...issueFixes].sort(
    (a, b) => (b.issue.line - a.issue.line) || (b.issue.column - a.issue.column),
  );

  for (const issueFix of sortedFixes) {
    if (issueFix.status === 'applied' && issueFix.fixedCode) {
      try {
        fixedCode = applyFixToCode(fixedCode, issueFix.issue, issueFix.fixedCode);
        appliedCount++;
      } catch (e) {
        issueFix.status = 'failed';
        issueFix.error = `Failed to apply fix: ${e instanceof Error ? e.message : 'Unknown error'}`;
        failedCount++;
      }
    } else {
      failedCount++;
    }
  }

  return {
    uri: document.uri,
    path: vscode.workspace.asRelativePath(document.uri),
    originalCode,
    fixedCode,
    issues: issueFixes,
    appliedCount,
    failedCount,
  };
}

/**
 * Get batch fix previews for all files in the workspace.
 */
export async function getWorkspaceBatchFixPreview(): Promise<FileFixPreview[]> {
  const files = await vscode.workspace.findFiles('**/*.{tsx,jsx}', '**/node_modules/**');
  const config = await loadConfig();

  const previews: FileFixPreview[] = [];

  for (const fileUri of files) {
    if (isExcluded(config, fileUri.fsPath)) {
      continue;
    }

    const document = await vscode.workspace.openTextDocument(fileUri);
    try {
      const preview = await getFileBatchFixPreview(document);
      if (preview.appliedCount > 0 || preview.failedCount > 0) {
        previews.push(preview);
      }
    } catch (e) {
      console.error(`Error processing file ${fileUri.fsPath}:`, e);
    }
  }

  return previews;
}

/**
 * Apply all approved fixes from the preview to the actual file.
 */
export async function applyBatchFixPreview(preview: FileFixPreview): Promise<void> {
  const document = await vscode.workspace.openTextDocument(preview.uri);
  const editor = await vscode.window.showTextDocument(document);

  // Replace entire content with fixed code
  const fullRange = new vscode.Range(
    document.lineAt(0).range.start,
    document.lineAt(document.lineCount - 1).range.end,
  );

  await editor.edit(editBuilder => {
    editBuilder.replace(fullRange, preview.fixedCode);
  });

  // Save the document
  await document.save();
}

/**
 * Apply all approved fixes from multiple file previews.
 */
export async function applyBatchFixPreviews(previews: FileFixPreview[]): Promise<void> {
  for (const preview of previews) {
    await applyBatchFixPreview(preview);
  }
}

/**
 * Extract surrounding context around an issue for AI understanding.
 */
function getContextSnippet(code: string, issue: A11yIssue, contextLines: number = 2): string {
  const lines = code.split('\n');
  const startLine = Math.max(0, issue.line - contextLines);
  const endLine = Math.min(lines.length, (issue.endLine ?? issue.line) + contextLines + 1);
  return lines.slice(startLine, endLine).join('\n');
}

/**
 * Apply a single fix to the code by replacing the issue snippet with fixed code.
 */
function applyFixToCode(code: string, issue: A11yIssue, fixedCode: string): string {
  const lines = code.split('\n');

  if (issue.line >= lines.length) {
    throw new Error(`Line ${issue.line} is out of range`);
  }

  const line = lines[issue.line];
  const before = line.substring(0, issue.column);
  const after = line.substring(issue.endColumn ?? line.length);

  lines[issue.line] = before + fixedCode + after;
  return lines.join('\n');
}

/**
 * Generate a summary of batch fix results.
 */
export function generateFixSummary(previews: FileFixPreview[]): {
  totalFiles: number;
  totalIssues: number;
  appliedFixes: number;
  failedFixes: number;
} {
  let totalIssues = 0;
  let appliedFixes = 0;
  let failedFixes = 0;

  for (const preview of previews) {
    totalIssues += preview.issues.length;
    appliedFixes += preview.appliedCount;
    failedFixes += preview.failedCount;
  }

  return {
    totalFiles: previews.length,
    totalIssues,
    appliedFixes,
    failedFixes,
  };
}
