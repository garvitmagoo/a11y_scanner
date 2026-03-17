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
  accepted?: boolean; // Track if user accepted this fix
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
    accepted: true, // Accept all by default, user can uncheck
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

  // Validate issues have valid line/column positions before attempting fixes
  const codeLines = originalCode.split('\n');
  for (const issueFix of issueFixes) {
    const issue = issueFix.issue;
    const line = codeLines[issue.line];
    
    // Check if line is within bounds
    if (!line || issue.line >= codeLines.length) {
      issueFix.status = 'failed';
      issueFix.error = `Invalid position: line ${issue.line} out of bounds`;
      failedCount++;
      continue;
    }
    
    // Check if column is within bounds
    if (issue.column > line.length) {
      issueFix.status = 'failed';
      issueFix.error = `Invalid position: column ${issue.column} exceeds line length ${line.length}`;
      failedCount++;
      continue;
    }
  }

  // Sort issues by line number in reverse to avoid offset issues
  const sortedFixes = [...issueFixes]
    .filter(fix => fix.status === 'applied') // Only try to apply valid fixes
    .sort(
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
    }
  }
  
  // Count already-failed fixes
  failedCount += issueFixes.filter(fix => fix.status === 'failed').length;

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
 * Only applies fixes that have been explicitly accepted by the user.
 */
export async function applyBatchFixPreview(preview: FileFixPreview): Promise<void> {
  const document = await vscode.workspace.openTextDocument(preview.uri);
  const editor = await vscode.window.showTextDocument(document);

  let modifiedCode = document.getText();

  // Filter to only accepted fixes
  const acceptedFixes = preview.issues.filter(fix => fix.accepted && fix.status === 'applied' && fix.fixedCode);

  if (acceptedFixes.length === 0) {
    return;
  }

  // Sort fixes by line number in reverse to avoid offset issues
  const sortedFixes = [...acceptedFixes].sort(
    (a, b) => (b.issue.line - a.issue.line) || (b.issue.column - a.issue.column),
  );

  // Apply each accepted fix
  for (const issueFix of sortedFixes) {
    try {
      modifiedCode = applyFixToCode(modifiedCode, issueFix.issue, issueFix.fixedCode!);
    } catch (e) {
      console.error(`Failed to apply fix: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  // Replace entire content with modified code
  const fullRange = new vscode.Range(
    document.lineAt(0).range.start,
    document.lineAt(document.lineCount - 1).range.end,
  );

  await editor.edit(editBuilder => {
    editBuilder.replace(fullRange, modifiedCode);
  });

  // Save the document
  await document.save();
}

/**
 * Apply all approved fixes from multiple file previews with automatic retry.
 * Will retry up to 2 times to achieve a perfect score (100%).
 */
export async function applyBatchFixPreviews(previews: FileFixPreview[], maxRetries: number = 2): Promise<void> {
  let currentRetry = 0;

  while (currentRetry <= maxRetries) {
    // Apply the current set of fixes
    for (const preview of previews) {
      await applyBatchFixPreview(preview);
    }

    // Check the score after applying fixes
    const scoresPerFile: Map<string, number> = new Map();
    let allPerfect = true;

    for (const preview of previews) {
      const document = await vscode.workspace.openTextDocument(preview.uri);
      const score = await getDocumentScore(document);
      scoresPerFile.set(preview.uri.fsPath, score);

      if (score < 100) {
        allPerfect = false;
      }
    }

    // If all files have perfect score or we've exhausted retries, stop
    if (allPerfect || currentRetry >= maxRetries) {
      const summary = Array.from(scoresPerFile.entries())
        .map(([path, score]) => `${vscode.workspace.asRelativePath(path)}: ${score}%`)
        .join('\n');

      vscode.window.showInformationMessage(
        `A11y Scanner: Fixes applied${currentRetry > 0 ? ` (${currentRetry} ${currentRetry === 1 ? 'retry' : 'retries'})` : ''}.\n\nScores:\n${summary}`,
      );
      return;
    }

    // Retry: re-scan each file to find remaining issues
    currentRetry++;
    vscode.window.showInformationMessage(
      `A11y Scanner: Score not perfect. Retrying (${currentRetry}/${maxRetries})...`,
    );

    for (let i = 0; i < previews.length; i++) {
      const document = await vscode.workspace.openTextDocument(previews[i].uri);
      const newPreview = await getFileBatchFixPreview(document);

      // Update preview with fresh issues and fixes
      previews[i] = newPreview;
    }
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
 * Handles both single-line and multi-line replacements.
 */
function applyFixToCode(code: string, issue: A11yIssue, fixedCode: string): string {
  const lines = code.split('\n');

  // Validate line boundaries
  if (issue.line >= lines.length) {
    throw new Error(`Line ${issue.line} is out of range (file has ${lines.length} lines)`);
  }

  // Handle single-line replacements
  if ((issue.endLine ?? issue.line) === issue.line) {
    const line = lines[issue.line];
    const before = line.substring(0, issue.column);
    const after = line.substring(issue.endColumn ?? line.length);
    
    // Validate columns are within bounds
    if (issue.column > line.length) {
      console.warn(`Column ${issue.column} exceeds line length ${line.length}. Using full line.`);
      return code; // Skip this fix, don't corrupt the file
    }
    
    lines[issue.line] = before + fixedCode + after;
    return lines.join('\n');
  }

  // Handle multi-line replacements
  const startLine = issue.line;
  const endLine = issue.endLine ?? issue.line;
  
  if (endLine >= lines.length) {
    throw new Error(`End line ${endLine} is out of range (file has ${lines.length} lines)`);
  }

  const before = lines[startLine].substring(0, issue.column);
  const after = lines[endLine].substring(issue.endColumn ?? lines[endLine].length);
  
  // Remove the affected lines and insert the fix
  const replacement = before + fixedCode + after;
  lines.splice(startLine, endLine - startLine + 1, replacement);
  
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

/**
 * Calculate accessibility score for a file based on issues.
 * Score = 100 - (errors * 10 + warnings * 5 + info * 2 + hints * 1)
 */
export function calculateAccessibilityScore(issues: A11yIssue[]): number {
  let penalty = 0;

  for (const issue of issues) {
    switch (issue.severity) {
      case 'error':
        penalty += 10;
        break;
      case 'warning':
        penalty += 5;
        break;
      case 'info':
        penalty += 2;
        break;
      case 'hint':
        penalty += 1;
        break;
    }
  }

  return Math.max(0, 100 - penalty);
}

/**
 * Get the current accessibility score for a document.
 */
export async function getDocumentScore(document: vscode.TextDocument): Promise<number> {
  const fileName = document.fileName;
  let issues = scanForA11yIssues(document.getText(), fileName);
  const config = await loadConfig();
  issues = applyConfig(config, issues);
  return calculateAccessibilityScore(issues);
}
