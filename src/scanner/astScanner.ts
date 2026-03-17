import * as ts from 'typescript';
import type { A11yIssue } from '../types';
import { checkImgAlt } from './rules/imgAlt';
import { checkButtonLabel } from './rules/buttonLabel';
import { checkAriaRole } from './rules/ariaRole';
import { checkFormLabel } from './rules/formLabel';
import { checkClickKeyEvents } from './rules/clickKeyEvents';
import { checkAriaPattern } from './rules/ariaPattern';
import { checkColorContrast } from './rules/colorContrast';
import { createHeadingOrderChecker } from './rules/headingOrder';

type RuleChecker = (node: ts.Node, sourceFile: ts.SourceFile) => A11yIssue[];

const PER_NODE_RULES: RuleChecker[] = [
  checkImgAlt,
  checkButtonLabel,
  checkAriaRole,
  checkFormLabel,
  checkClickKeyEvents,
  checkAriaPattern,
  checkColorContrast,
];

/**
 * Scan a source file's text for accessibility issues using the TypeScript AST.
 */
export function scanForA11yIssues(sourceCode: string, fileName: string): A11yIssue[] {
  try {
    return scanForA11yIssuesUnsafe(sourceCode, fileName);
  } catch (e) {
    console.error(`[A11y Scanner] Error scanning ${fileName}:`, e);
    return [];
  }
}

function scanForA11yIssuesUnsafe(sourceCode: string, fileName: string): A11yIssue[] {
  const isTsx = fileName.endsWith('.tsx') || fileName.endsWith('.jsx');
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceCode,
    ts.ScriptTarget.Latest,
    true,
    isTsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  const issues: A11yIssue[] = [];

  // File-level rules that need state across nodes
  const checkHeadingOrder = createHeadingOrderChecker();

  function visit(node: ts.Node) {
    for (const rule of PER_NODE_RULES) {
      const ruleIssues = rule(node, sourceFile);
      issues.push(...ruleIssues);
    }
    // Heading order collects headings per-node (no-op for non-heading nodes)
    checkHeadingOrder(node, sourceFile);

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  // Run heading checker on the SourceFile node to emit collected results
  const finalHeadingIssues = checkHeadingOrder(sourceFile, sourceFile);
  issues.push(...finalHeadingIssues);

  return issues;
}

/**
 * Scan multiple files and return a map of file path to issues.
 */
export function scanFiles(files: Map<string, string>): Map<string, A11yIssue[]> {
  const results = new Map<string, A11yIssue[]>();
  for (const [filePath, content] of files) {
    const issues = scanForA11yIssues(content, filePath);
    if (issues.length > 0) {
      results.set(filePath, issues);
    }
  }
  return results;
}
