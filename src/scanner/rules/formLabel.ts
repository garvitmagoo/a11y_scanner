import * as ts from 'typescript';
import type { A11yIssue } from '../../types';

/**
 * Rule: form-label
 * Form inputs (<input>, <select>, <textarea>, <TextField>) should have associated labels.
 * Checks for: aria-label, aria-labelledby, id with matching htmlFor, or label prop.
 */
export function checkFormLabel(node: ts.Node, sourceFile: ts.SourceFile): A11yIssue[] {
  const issues: A11yIssue[] = [];
  const inputTags = new Set(['input', 'select', 'textarea']);

  if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
    const tagName = node.tagName.getText(sourceFile);
    const isHtmlInput = inputTags.has(tagName.toLowerCase());
    const isMuiInput = tagName === 'TextField' || tagName === 'Select';

    if (isHtmlInput || isMuiInput) {
      const attrs = node.attributes.properties;

      const hasDirectLabel = attrs.some(attr => {
        if (!ts.isJsxAttribute(attr)) return false;
        const name = attr.name.getText(sourceFile);
        return name === 'aria-label' ||
               name === 'aria-labelledby' ||
               name === 'label';
      });

      const hasIdOnly = !hasDirectLabel && attrs.some(attr =>
        ts.isJsxAttribute(attr) && attr.name.getText(sourceFile) === 'id'
      );

      // For hidden inputs, skip the check
      const isHidden = attrs.some(attr =>
        ts.isJsxAttribute(attr) &&
        attr.name.getText(sourceFile) === 'type' &&
        attr.initializer &&
        ts.isStringLiteral(attr.initializer) &&
        attr.initializer.text === 'hidden'
      );

      if (!hasDirectLabel && !hasIdOnly && !isHidden) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        issues.push({
          message: `Form control <${tagName}> should have a label. Add \`aria-label\`, \`aria-labelledby\`, or a \`label\` prop.`,
          rule: 'form-label',
          severity: 'warning',
          line,
          column: character,
          snippet: node.getText(sourceFile),
        });
      } else if (hasIdOnly && !isHidden) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        issues.push({
          message: `Form control <${tagName}> has an \`id\` but no explicit label. Ensure a \`<label htmlFor="...">\` exists, or add \`aria-label\`.`,
          rule: 'form-label',
          severity: 'hint',
          line,
          column: character,
          snippet: node.getText(sourceFile),
        });
      }
    }
  }

  return issues;
}
