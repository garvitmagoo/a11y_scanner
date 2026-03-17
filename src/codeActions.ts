import * as vscode from 'vscode';
import { getAiFix } from './ai/provider';

/**
 * Provides Quick Fix code actions for accessibility diagnostics.
 * When the user clicks the lightbulb on an a11y issue, this provider
 * offers an AI-powered fix and/or a manual fix suggestion.
 */
export class A11yCodeActionProvider implements vscode.CodeActionProvider {

  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
  ];

  async provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range,
    context: vscode.CodeActionContext,
  ): Promise<vscode.CodeAction[]> {
    const actions: vscode.CodeAction[] = [];

    for (const diagnostic of context.diagnostics) {
      if (diagnostic.source !== 'A11y Scanner') {
        continue;
      }

      // Add a manual/static quick fix based on the rule
      const staticFix = this.getStaticFix(document, diagnostic);
      if (staticFix) {
        actions.push(staticFix);
      }

      // Add an AI-powered fix option
      const config = vscode.workspace.getConfiguration('a11y');
      if (config.get<string>('aiProvider', 'none') !== 'none') {
        const aiFix = new vscode.CodeAction(
          `A11y: AI Fix - ${diagnostic.message}`,
          vscode.CodeActionKind.QuickFix,
        );
        aiFix.diagnostics = [diagnostic];
        aiFix.command = {
          command: 'a11y.applyAiFix',
          title: 'Apply AI Accessibility Fix',
          arguments: [document.uri, diagnostic],
        };
        actions.push(aiFix);
      }
    }

    return actions;
  }

  private getStaticFix(document: vscode.TextDocument, diagnostic: vscode.Diagnostic): vscode.CodeAction | null {
    const rule = diagnostic.code as string;

    switch (rule) {
      case 'img-alt':
        return this.createInsertAttributeFix(
          document,
          diagnostic,
          'alt=""',
          'Add empty alt attribute (decorative image)',
        );

      case 'button-label':
        return this.createInsertAttributeFix(
          document,
          diagnostic,
          'aria-label=""',
          'Add aria-label attribute',
        );

      case 'form-label':
        return this.createInsertAttributeFix(
          document,
          diagnostic,
          'aria-label=""',
          'Add aria-label attribute',
        );

      case 'click-events-have-key-events':
        return this.createInsertAttributesFix(
          document,
          diagnostic,
          ['role="button"', 'tabIndex={0}', 'onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { /* handler */ } }}'],
          'Add keyboard support (role, tabIndex, onKeyDown)',
        );

      case 'aria-pattern': {
        const msg = diagnostic.message;
        if (msg.includes('aria-labelledby') || msg.includes('aria-label')) {
          return this.createInsertAttributeFix(
            document,
            diagnostic,
            'aria-label=""',
            'Add aria-label attribute',
          );
        }
        if (msg.includes('aria-expanded')) {
          return this.createInsertAttributeFix(
            document,
            diagnostic,
            'aria-expanded={false}',
            'Add aria-expanded attribute',
          );
        }
        if (msg.includes('aria-controls') || msg.includes('aria-selected')) {
          return this.createInsertAttributesFix(
            document,
            diagnostic,
            ['aria-controls=""', 'aria-selected={false}'],
            'Add aria-controls and aria-selected',
          );
        }
        return null;
      }

      case 'heading-order': {
        // For heading-order, suggest changing to the correct heading level
        const msg = diagnostic.message;
        const currentTagMatch = msg.match(/<(h[1-6])>/);
        if (currentTagMatch && msg.includes('skipped')) {
          // Extract what the previous heading was to suggest the next level
          const prevMatch = msg.match(/follows `<h(\d)>/);
          if (prevMatch) {
            const suggestedLevel = parseInt(prevMatch[1], 10) + 1;
            if (suggestedLevel <= 6) {
              return this.createReplaceHeadingFix(
                document,
                diagnostic,
                currentTagMatch[1],
                `h${suggestedLevel}`,
              );
            }
          }
        }
        return null;
      }

      default:
        return null;
    }
  }

  private createInsertAttributeFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
    attribute: string,
    title: string,
  ): vscode.CodeAction {
    const fix = new vscode.CodeAction(
      `A11y: ${title}`,
      vscode.CodeActionKind.QuickFix,
    );
    fix.diagnostics = [diagnostic];

    const line = document.lineAt(diagnostic.range.start.line);
    const lineText = line.text;

    // Find the position right before the closing > or />
    const closingIndex = lineText.lastIndexOf('/>');
    const openClosingIndex = lineText.lastIndexOf('>');
    const insertIndex = closingIndex !== -1 ? closingIndex : openClosingIndex;

    if (insertIndex !== -1) {
      const edit = new vscode.WorkspaceEdit();
      const insertPosition = new vscode.Position(diagnostic.range.start.line, insertIndex);
      edit.insert(document.uri, insertPosition, ` ${attribute} `);
      fix.edit = edit;
    }

    fix.isPreferred = true;
    return fix;
  }

  private createInsertAttributesFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
    attributes: string[],
    title: string,
  ): vscode.CodeAction {
    const fix = new vscode.CodeAction(
      `A11y: ${title}`,
      vscode.CodeActionKind.QuickFix,
    );
    fix.diagnostics = [diagnostic];

    const line = document.lineAt(diagnostic.range.start.line);
    const lineText = line.text;

    const closingIndex = lineText.lastIndexOf('/>');
    const openClosingIndex = lineText.lastIndexOf('>');
    const insertIndex = closingIndex !== -1 ? closingIndex : openClosingIndex;

    if (insertIndex !== -1) {
      const edit = new vscode.WorkspaceEdit();
      const insertPosition = new vscode.Position(diagnostic.range.start.line, insertIndex);
      edit.insert(document.uri, insertPosition, ` ${attributes.join(' ')} `);
      fix.edit = edit;
    }

    return fix;
  }

  private createReplaceHeadingFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
    currentTag: string,
    suggestedTag: string,
  ): vscode.CodeAction {
    const fix = new vscode.CodeAction(
      `A11y: Change <${currentTag}> to <${suggestedTag}>`,
      vscode.CodeActionKind.QuickFix,
    );
    fix.diagnostics = [diagnostic];

    const edit = new vscode.WorkspaceEdit();
    const lineNum = diagnostic.range.start.line;
    const lineText = document.lineAt(lineNum).text;

    // Replace the opening tag
    const openIdx = lineText.indexOf(`<${currentTag}`);
    if (openIdx !== -1) {
      const openRange = new vscode.Range(lineNum, openIdx + 1, lineNum, openIdx + 1 + currentTag.length);
      edit.replace(document.uri, openRange, suggestedTag);
    }

    // Replace the closing tag on the same line (if present)
    const closeIdx = lineText.indexOf(`</${currentTag}>`);
    if (closeIdx !== -1) {
      const closeRange = new vscode.Range(lineNum, closeIdx + 2, lineNum, closeIdx + 2 + currentTag.length);
      edit.replace(document.uri, closeRange, suggestedTag);
    }

    fix.edit = edit;
    fix.isPreferred = true;
    return fix;
  }
}

/**
 * Command handler: applies an AI-generated fix for an accessibility issue.
 */
export async function applyAiFixCommand(uri: vscode.Uri, diagnostic: vscode.Diagnostic): Promise<void> {
  const document = await vscode.workspace.openTextDocument(uri);
  const lineText = document.lineAt(diagnostic.range.start.line).text;

  // Get surrounding context (5 lines before and after)
  const startLine = Math.max(0, diagnostic.range.start.line - 5);
  const endLine = Math.min(document.lineCount - 1, diagnostic.range.start.line + 5);
  const contextLines: string[] = [];
  for (let i = startLine; i <= endLine; i++) {
    contextLines.push(document.lineAt(i).text);
  }
  const surroundingContext = contextLines.join('\n');

  const issue = {
    message: diagnostic.message,
    rule: diagnostic.code as string,
    severity: 'warning' as const,
    line: diagnostic.range.start.line,
    column: diagnostic.range.start.character,
    snippet: lineText,
  };

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'A11y Scanner: Generating AI fix...',
      cancellable: false,
    },
    async () => {
      const fix = await getAiFix(lineText, issue, surroundingContext);
      if (!fix) {
        return;
      }

      const edit = new vscode.WorkspaceEdit();
      edit.replace(uri, diagnostic.range, fix.fixedCode);
      await vscode.workspace.applyEdit(edit);

      vscode.window.showInformationMessage(`A11y Fix Applied: ${fix.explanation}`);
    },
  );
}
