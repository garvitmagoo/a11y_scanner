import * as vscode from 'vscode';

export interface A11yIssue {
  message: string;
  rule: string;
  severity: 'error' | 'warning' | 'info' | 'hint';
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  snippet: string;
  fix?: string;
}

export interface A11yRule {
  id: string;
  description: string;
  severity: 'error' | 'warning' | 'info' | 'hint';
  check: (node: any, sourceFile: any) => A11yIssue[];
}

export interface AiFixRequest {
  code: string;
  issue: A11yIssue;
  context: string;
}

export interface AiFixResponse {
  fixedCode: string;
  explanation: string;
}

export function toVscodeSeverity(severity: A11yIssue['severity']): vscode.DiagnosticSeverity {
  switch (severity) {
    case 'error': return vscode.DiagnosticSeverity.Error;
    case 'warning': return vscode.DiagnosticSeverity.Warning;
    case 'info': return vscode.DiagnosticSeverity.Information;
    case 'hint': return vscode.DiagnosticSeverity.Hint;
  }
}
