import * as ts from 'typescript';

export interface ScreenReaderAnnouncement {
  element: string;
  role: string;
  accessibleName: string;
  announcement: string;
  line: number;
  column: number;
  hasIssue: boolean;
  issueMessage?: string;
}

const LANDMARK_ELEMENTS: Record<string, string> = {
  'nav': 'navigation',
  'main': 'main',
  'aside': 'complementary',
  'header': 'banner',
  'footer': 'contentinfo',
  'section': 'region',
  'form': 'form',
};

const HEADING_RE = /^h([1-6])$/;

/**
 * Walk the JSX AST and produce a list of announcements simulating what
 * a screen reader would say for each semantic / interactive element.
 */
export function simulateScreenReader(sourceCode: string, fileName: string): ScreenReaderAnnouncement[] {
  const isTsx = fileName.endsWith('.tsx') || fileName.endsWith('.jsx');
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceCode,
    ts.ScriptTarget.Latest,
    true,
    isTsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const announcements: ScreenReaderAnnouncement[] = [];

  function getAttr(
    node: ts.JsxSelfClosingElement | ts.JsxOpeningElement,
    name: string,
  ): string | undefined {
    for (const prop of node.attributes.properties) {
      if (!ts.isJsxAttribute(prop) || prop.name.getText(sourceFile) !== name) {
        continue;
      }
      if (!prop.initializer) {
        return '';
      }
      if (ts.isStringLiteral(prop.initializer)) {
        return prop.initializer.text;
      }
      if (ts.isJsxExpression(prop.initializer) && prop.initializer.expression) {
        if (ts.isStringLiteral(prop.initializer.expression)) {
          return prop.initializer.expression.text;
        }
        return `{${prop.initializer.expression.getText(sourceFile)}}`;
      }
      return '';
    }
    return undefined;
  }

  function getTextContent(element: ts.JsxElement): string {
    const parts: string[] = [];
    for (const child of element.children) {
      if (ts.isJsxText(child)) {
        const t = child.getText(sourceFile).trim();
        if (t) { parts.push(t); }
      } else if (ts.isJsxExpression(child) && child.expression) {
        if (ts.isStringLiteral(child.expression)) {
          parts.push(child.expression.text);
        } else {
          parts.push(`{${child.expression.getText(sourceFile)}}`);
        }
      } else if (ts.isJsxElement(child)) {
        parts.push(getTextContent(child));
      }
    }
    return parts.join(' ');
  }

  function process(node: ts.JsxSelfClosingElement | ts.JsxOpeningElement): void {
    const tagName = node.tagName.getText(sourceFile);
    const tagLower = tagName.toLowerCase();
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));

    const ariaLabel = getAttr(node, 'aria-label');
    const ariaLabelledBy = getAttr(node, 'aria-labelledby');
    const role = getAttr(node, 'role');
    const title = getAttr(node, 'title');

    let textContent = '';
    if (ts.isJsxOpeningElement(node) && ts.isJsxElement(node.parent)) {
      textContent = getTextContent(node.parent);
    }

    const computedName = ariaLabel || ariaLabelledBy || textContent || title || '';

    // ── Images ──
    if (tagLower === 'img') {
      const alt = getAttr(node, 'alt');
      if (alt !== undefined && alt !== '') {
        announcements.push({ element: `<${tagName}>`, role: role || 'image', accessibleName: alt, announcement: `"${alt}", image`, line, column: character, hasIssue: false });
      } else if (alt === '') {
        announcements.push({ element: `<${tagName}>`, role: role || 'image', accessibleName: '(decorative)', announcement: '(decorative image — hidden from screen reader)', line, column: character, hasIssue: false });
      } else {
        announcements.push({ element: `<${tagName}>`, role: role || 'image', accessibleName: '', announcement: 'image (NO ACCESSIBLE NAME)', line, column: character, hasIssue: true, issueMessage: 'Image is missing alt text — screen reader cannot describe it' });
      }
      return;
    }

    // ── Headings ──
    const headingMatch = tagLower.match(HEADING_RE);
    if (headingMatch) {
      const level = headingMatch[1];
      const name = computedName;
      if (name) {
        announcements.push({ element: `<${tagName}>`, role: `heading level ${level}`, accessibleName: name, announcement: `"${name}", heading level ${level}`, line, column: character, hasIssue: false });
      } else {
        announcements.push({ element: `<${tagName}>`, role: `heading level ${level}`, accessibleName: '', announcement: `heading level ${level} (EMPTY)`, line, column: character, hasIssue: true, issueMessage: 'Heading has no text content' });
      }
      return;
    }

    // ── Buttons ──
    if (tagLower === 'button' || tagName === 'IconButton') {
      const name = computedName;
      if (name) {
        announcements.push({ element: `<${tagName}>`, role: role || 'button', accessibleName: name, announcement: `"${name}", button`, line, column: character, hasIssue: false });
      } else {
        announcements.push({ element: `<${tagName}>`, role: role || 'button', accessibleName: '', announcement: 'button (NO ACCESSIBLE NAME)', line, column: character, hasIssue: true, issueMessage: 'Button has no accessible name — screen reader cannot identify it' });
      }
      return;
    }

    // ── Links ──
    if (tagLower === 'a') {
      const href = getAttr(node, 'href');
      const name = computedName;
      if (name) {
        announcements.push({ element: `<${tagName}>`, role: role || 'link', accessibleName: name, announcement: `"${name}", link`, line, column: character, hasIssue: false });
      } else {
        announcements.push({ element: `<${tagName}>`, role: role || 'link', accessibleName: '', announcement: `link (NO ACCESSIBLE NAME)${href ? ` → ${href}` : ''}`, line, column: character, hasIssue: true, issueMessage: 'Link has no accessible name' });
      }
      return;
    }

    // ── Form inputs ──
    if (tagLower === 'input' || tagLower === 'select' || tagLower === 'textarea' || tagName === 'TextField') {
      const type = getAttr(node, 'type') || 'text';
      const placeholder = getAttr(node, 'placeholder');
      const name = ariaLabel || ariaLabelledBy || title || placeholder || '';
      const inputType = tagLower === 'input' ? type : tagLower;

      if (name) {
        const extra = placeholder && name !== placeholder ? `, placeholder: "${placeholder}"` : '';
        announcements.push({ element: `<${tagName}>`, role: role || inputType, accessibleName: name, announcement: `"${name}", ${inputType}${extra}`, line, column: character, hasIssue: false });
      } else {
        announcements.push({ element: `<${tagName}>`, role: role || inputType, accessibleName: '', announcement: `${inputType} (NO ACCESSIBLE NAME)`, line, column: character, hasIssue: true, issueMessage: `Form ${inputType} has no label — screen reader cannot identify it` });
      }
      return;
    }

    // ── Landmark elements ──
    if (LANDMARK_ELEMENTS[tagLower]) {
      const landmark = LANDMARK_ELEMENTS[tagLower];
      const name = computedName;
      const needsLabel = tagLower === 'section' || tagLower === 'form';
      if (name) {
        announcements.push({ element: `<${tagName}>`, role: landmark, accessibleName: name, announcement: `"${name}", ${landmark} landmark`, line, column: character, hasIssue: false });
      } else {
        announcements.push({ element: `<${tagName}>`, role: landmark, accessibleName: '', announcement: `${landmark} landmark`, line, column: character, hasIssue: needsLabel, issueMessage: needsLabel ? `<${tagLower}> landmark should have an aria-label` : undefined });
      }
      return;
    }

    // ── Elements with explicit role ──
    if (role) {
      const name = computedName;
      announcements.push({ element: `<${tagName}>`, role, accessibleName: name, announcement: name ? `"${name}", ${role}` : `${role} (no accessible name)`, line, column: character, hasIssue: !name, issueMessage: !name ? `Element with role="${role}" should have an accessible name` : undefined });
      return;
    }

    // ── Elements with aria-label but no role ──
    if (ariaLabel) {
      announcements.push({ element: `<${tagName}>`, role: 'generic', accessibleName: ariaLabel, announcement: `"${ariaLabel}"`, line, column: character, hasIssue: false });
    }
  }

  function visit(node: ts.Node): void {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      process(node);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return announcements;
}
