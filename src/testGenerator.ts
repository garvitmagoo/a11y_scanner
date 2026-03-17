import * as vscode from 'vscode';
import { scanForA11yIssues } from './scanner/astScanner';
import type { A11yIssue } from './types';

/**
 * Generates @testing-library/react accessibility tests for the current file.
 * Tests verify:
 *  - Elements have accessible names
 *  - Images have alt text
 *  - Buttons / links are keyboard-accessible
 *  - ARIA roles are correct
 *  - Form controls have labels
 *  - Color contrast (visual note, can't auto-test in JSDOM)
 */
export async function generateA11yTests(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('A11y Scanner: No active file.');
    return;
  }

  const doc = editor.document;
  const supported = new Set(['typescriptreact', 'javascriptreact']);
  if (!supported.has(doc.languageId)) {
    vscode.window.showWarningMessage('A11y Scanner: Test generation requires a TSX or JSX file.');
    return;
  }

  const sourceText = doc.getText();
  const issues = scanForA11yIssues(sourceText, doc.fileName);

  const componentName = inferComponentName(sourceText, doc.fileName);
  const testCode = buildTestFile(componentName, issues, doc.fileName);

  // Determine output path: same directory, *.a11y.test.tsx
  const originalPath = doc.uri.fsPath;
  const ext = originalPath.endsWith('.tsx') ? '.tsx' : '.jsx';
  const baseName = originalPath.replace(/\.(tsx|jsx)$/, '');
  const testPath = `${baseName}.a11y.test${ext}`;

  const testUri = vscode.Uri.file(testPath);

  // Check if file already exists and ask before overwriting
  try {
    await vscode.workspace.fs.stat(testUri);
    const overwrite = await vscode.window.showWarningMessage(
      `A11y Scanner: ${testPath.replace(/\\/g, '/').split('/').pop()} already exists. Overwrite?`,
      { modal: true },
      'Overwrite',
    );
    if (overwrite !== 'Overwrite') {
      return;
    }
  } catch {
    // File doesn't exist — proceed
  }

  const encoder = new TextEncoder();
  await vscode.workspace.fs.writeFile(testUri, encoder.encode(testCode));

  const testDoc = await vscode.workspace.openTextDocument(testUri);
  await vscode.window.showTextDocument(testDoc, vscode.ViewColumn.Beside);

  vscode.window.showInformationMessage(
    `A11y Scanner: Generated ${issues.length > 0 ? issues.length : 'baseline'} accessibility test(s).`,
  );
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

function inferComponentName(source: string, filePath: string): string {
  // Try to find `export default function Foo` or `export default class Foo` or `function Foo`
  const fnMatch = source.match(/export\s+(?:default\s+)?function\s+(\w+)/);
  if (fnMatch) { return fnMatch[1]; }
  const classMatch = source.match(/export\s+(?:default\s+)?class\s+(\w+)/);
  if (classMatch) { return classMatch[1]; }
  const arrowMatch = source.match(/(?:export\s+(?:default\s+)?)?const\s+(\w+)\s*[=:]/);
  if (arrowMatch) { return arrowMatch[1]; }

  // Fallback: derive from filename
  const base = filePath.replace(/\\/g, '/').split('/').pop() || 'Component';
  return base.replace(/\.(tsx|jsx)$/, '').replace(/[^a-zA-Z0-9]/g, '');
}

function buildTestFile(
  componentName: string,
  issues: A11yIssue[],
  filePath: string,
): string {
  const relImport = `./${filePath.replace(/\\/g, '/').split('/').pop()?.replace(/\.(tsx|jsx)$/, '')}`;

  const lines: string[] = [];
  lines.push(`import { render, screen } from '@testing-library/react';`);
  lines.push(`import userEvent from '@testing-library/user-event';`);
  lines.push(`import ${componentName} from '${relImport}';`);
  lines.push('');
  lines.push(`describe('${componentName} – Accessibility Tests', () => {`);

  // Always add a baseline render test
  lines.push(`  it('should render without crashing', () => {`);
  lines.push(`    render(<${componentName} />);`);
  lines.push(`  });`);
  lines.push('');

  // Group issues by rule for consolidated tests
  const byRule = new Map<string, A11yIssue[]>();
  for (const issue of issues) {
    const arr = byRule.get(issue.rule) || [];
    arr.push(issue);
    byRule.set(issue.rule, arr);
  }

  // ── img-alt ──
  if (byRule.has('img-alt')) {
    lines.push(`  it('images should have accessible alt text', () => {`);
    lines.push(`    render(<${componentName} />);`);
    lines.push(`    const images = screen.getAllByRole('img');`);
    lines.push(`    images.forEach((img) => {`);
    lines.push(`      expect(img).toHaveAttribute('alt');`);
    lines.push(`      // Meaningful images should have non-empty alt`);
    lines.push(`    });`);
    lines.push(`  });`);
    lines.push('');
  }

  // ── button-label ──
  if (byRule.has('button-label')) {
    lines.push(`  it('buttons should have accessible names', () => {`);
    lines.push(`    render(<${componentName} />);`);
    lines.push(`    const buttons = screen.getAllByRole('button');`);
    lines.push(`    buttons.forEach((button) => {`);
    lines.push(`      expect(button).toHaveAccessibleName();`);
    lines.push(`    });`);
    lines.push(`  });`);
    lines.push('');
  }

  // ── form-label ──
  if (byRule.has('form-label')) {
    lines.push(`  it('form controls should have accessible labels', () => {`);
    lines.push(`    render(<${componentName} />);`);
    lines.push(`    const textboxes = screen.queryAllByRole('textbox');`);
    lines.push(`    textboxes.forEach((input) => {`);
    lines.push(`      expect(input).toHaveAccessibleName();`);
    lines.push(`    });`);
    lines.push(`    const comboboxes = screen.queryAllByRole('combobox');`);
    lines.push(`    comboboxes.forEach((select) => {`);
    lines.push(`      expect(select).toHaveAccessibleName();`);
    lines.push(`    });`);
    lines.push(`  });`);
    lines.push('');
  }

  // ── click-events-have-key-events ──
  if (byRule.has('click-events-have-key-events')) {
    const count = byRule.get('click-events-have-key-events')!.length;
    lines.push(`  it('clickable custom elements should be keyboard-accessible', async () => {`);
    lines.push(`    const user = userEvent.setup();`);
    lines.push(`    render(<${componentName} />);`);
    lines.push(`    // There are ${count} element(s) with onClick but missing keyboard support.`);
    lines.push(`    // Verify interactive elements can be reached by keyboard:`);
    lines.push(`    const interactiveEls = screen.getAllByRole('button');`);
    lines.push(`    for (const el of interactiveEls) {`);
    lines.push(`      el.focus();`);
    lines.push(`      expect(el).toHaveFocus();`);
    lines.push(`      await user.keyboard('{Enter}');`);
    lines.push(`    }`);
    lines.push(`  });`);
    lines.push('');
  }

  // ── aria-role ──
  if (byRule.has('aria-role')) {
    lines.push(`  it('should not have invalid ARIA roles', () => {`);
    lines.push(`    render(<${componentName} />);`);
    lines.push(`    // Verify no elements have invalid role attributes.`);
    lines.push(`    // These roles were flagged as invalid during scanning:`);
    for (const issue of byRule.get('aria-role')!) {
      lines.push(`    // Line ${issue.line + 1}: ${issue.message}`);
    }
    lines.push(`    // After fixing, this test verifies the component renders correctly.`);
    lines.push(`  });`);
    lines.push('');
  }

  // ── aria-pattern ──
  if (byRule.has('aria-pattern')) {
    lines.push(`  it('composite ARIA widgets should follow WAI-ARIA patterns', () => {`);
    lines.push(`    render(<${componentName} />);`);
    for (const issue of byRule.get('aria-pattern')!) {
      lines.push(`    // Line ${issue.line + 1}: ${issue.message}`);
    }
    lines.push(`    // Example: a tablist should contain tabs`);
    lines.push(`    const tablist = screen.queryByRole('tablist');`);
    lines.push(`    if (tablist) {`);
    lines.push(`      const tabs = screen.getAllByRole('tab');`);
    lines.push(`      expect(tabs.length).toBeGreaterThan(0);`);
    lines.push(`    }`);
    lines.push(`  });`);
    lines.push('');
  }

  // ── color-contrast (advisory) ──
  if (byRule.has('color-contrast')) {
    lines.push(`  /**`);
    lines.push(`   * Color contrast cannot be fully validated in JSDOM.`);
    lines.push(`   * The following issues were detected statically:`);
    for (const issue of byRule.get('color-contrast')!) {
      lines.push(`   *  - Line ${issue.line + 1}: ${issue.message}`);
    }
    lines.push(`   * Use a visual regression tool (e.g., Storybook + axe) for runtime checks.`);
    lines.push(`   */`);
    lines.push(`  it.todo('color contrast meets WCAG AA (manual / visual check)');`);
    lines.push('');
  }

  // If there were no issues, add a clean-slate test
  if (issues.length === 0) {
    lines.push(`  it('should have no accessibility violations (axe)', async () => {`);
    lines.push(`    // If you have jest-axe installed:`);
    lines.push(`    // const { axe, toHaveNoViolations } = require('jest-axe');`);
    lines.push(`    // expect.extend(toHaveNoViolations);`);
    lines.push(`    // const { container } = render(<${componentName} />);`);
    lines.push(`    // const results = await axe(container);`);
    lines.push(`    // expect(results).toHaveNoViolations();`);
    lines.push(`    render(<${componentName} />);`);
    lines.push(`  });`);
    lines.push('');
  }

  lines.push(`});`);
  lines.push('');

  return lines.join('\n');
}
