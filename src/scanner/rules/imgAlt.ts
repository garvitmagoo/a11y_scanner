import * as ts from 'typescript';
import type { A11yIssue } from '../../types';

/**
 * Rule: img-alt
 * Every <img> element must have an alt attribute.
 */
export function checkImgAlt(node: ts.Node, sourceFile: ts.SourceFile): A11yIssue[] {
  const issues: A11yIssue[] = [];

  if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
    const tagName = node.tagName.getText(sourceFile);
    if (tagName === 'img') {
      const hasAlt = node.attributes.properties.some(
        attr => ts.isJsxAttribute(attr) && attr.name.getText(sourceFile) === 'alt'
      );
      if (!hasAlt) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        issues.push({
          message: 'Image element must have an `alt` attribute for screen readers.',
          rule: 'img-alt',
          severity: 'error',
          line,
          column: character,
          snippet: node.getText(sourceFile),
        });
      }
    }
  }

  return issues;
}
