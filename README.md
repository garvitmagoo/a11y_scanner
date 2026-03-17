# A11y Scanner - VS Code Extension

AI-powered accessibility scanner for React/JSX/TSX projects. Detects WCAG violations inline and provides intelligent fix suggestions.

## Features

- **Real-time scanning** — Detects accessibility issues as you type/save
- **Inline diagnostics** — Issues appear as squiggly lines in the editor
- **Quick Fixes** — Click the lightbulb to apply static fixes instantly
- **AI-powered fixes** — Optional AI integration (OpenAI / Azure OpenAI) for intelligent fix suggestions
- **Workspace scanning** — Scan the entire project at once
- **HTML Report** — Visual dashboard summarizing all issues

## Rules

| Rule | Severity | Description |
|------|----------|-------------|
| `img-alt` | Error | `<img>` must have an `alt` attribute |
| `button-label` | Error/Warning | Buttons must have accessible text or `aria-label` |
| `aria-role` | Error | ARIA `role` values must be valid WAI-ARIA roles |
| `form-label` | Warning | Form inputs must have associated labels |
| `click-events-have-key-events` | Warning | Non-interactive elements with `onClick` need keyboard support |

## Getting Started

### Install dependencies

```bash
cd a11y-scanner-extension
npm install
```

### Compile

```bash
npm run compile
```

### Run in VS Code

1. Open this folder in VS Code
2. Press `F5` to launch the Extension Development Host
3. Open any `.tsx` or `.jsx` file — issues will appear inline

### Package as VSIX

```bash
npm run package
```

This produces a `.vsix` file you can install via `code --install-extension a11y-scanner-0.1.0.vsix`.

## Commands

Open the Command Palette (`Ctrl+Shift+P`) and type:

- **A11y: Scan Current File** — Scan the active file
- **A11y: Scan Workspace** — Scan all TSX/JSX files in the workspace
- **A11y: Show Report** — Open the accessibility report panel

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `a11y.scanOnSave` | `true` | Auto-scan on file save |
| `a11y.scanOnOpen` | `true` | Auto-scan when a file is opened |
| `a11y.severity` | `warning` | Default diagnostic severity |
| `a11y.aiProvider` | `none` | AI provider: `none`, `openai`, `azure-openai` |
| `a11y.aiApiKey` | `""` | API key for AI suggestions |
| `a11y.aiEndpoint` | `""` | Azure OpenAI endpoint URL |
| `a11y.aiModel` | `gpt-4` | Model/deployment name |

### Enable AI Fixes

In VS Code Settings:

```json
{
  "a11y.aiProvider": "azure-openai",
  "a11y.aiApiKey": "your-api-key",
  "a11y.aiEndpoint": "https://your-resource.openai.azure.com",
  "a11y.aiModel": "gpt-4"
}
```

## Project Structure

```
a11y-scanner-extension/
├── src/
│   ├── extension.ts              # Entry point
│   ├── types.ts                  # Shared types
│   ├── diagnostics.ts            # VS Code diagnostic integration
│   ├── codeActions.ts            # Quick Fix provider + AI fix command
│   ├── scanner/
│   │   ├── astScanner.ts         # Main scanner (TypeScript AST)
│   │   └── rules/
│   │       ├── imgAlt.ts         # img-alt rule
│   │       ├── buttonLabel.ts    # button-label rule
│   │       ├── ariaRole.ts       # aria-role rule
│   │       ├── formLabel.ts      # form-label rule
│   │       └── clickKeyEvents.ts # click-events-have-key-events rule
│   ├── ai/
│   │   └── provider.ts           # OpenAI / Azure OpenAI integration
│   └── webview/
│       └── reportPanel.ts        # HTML report webview
├── package.json
├── tsconfig.json
└── README.md
```

## Adding New Rules

Create a new file in `src/scanner/rules/`:

```ts
import * as ts from 'typescript';
import type { A11yIssue } from '../types';

export function checkMyRule(node: ts.Node, sourceFile: ts.SourceFile): A11yIssue[] {
  const issues: A11yIssue[] = [];
  // Your check logic here
  return issues;
}
```

Then register it in `src/scanner/astScanner.ts`:

```ts
import { checkMyRule } from './rules/myRule';
const ALL_RULES: RuleChecker[] = [
  // ...existing rules
  checkMyRule,
];
```
