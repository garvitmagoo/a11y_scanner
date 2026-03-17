import * as vscode from 'vscode';
import type { A11yIssue, AiFixResponse } from '../types';

const SYSTEM_PROMPT = `You are an accessibility expert specializing in React and WCAG 2.1 compliance.
Given a code snippet and an accessibility issue, provide a minimal, targeted fix.
Return a JSON object with two fields:
- "fixedCode": the corrected code snippet (only the relevant element, not the whole file)
- "explanation": a brief one-sentence explanation of the fix

Rules:
- Only fix the specific accessibility issue mentioned
- Preserve existing functionality and styling
- Follow WCAG 2.1 Level AA guidelines
- Use semantic HTML where possible
- Do not add unnecessary attributes`;

let _secrets: vscode.SecretStorage | undefined;

/**
 * Initialize the AI provider with the extension's SecretStorage.
 * Must be called once from activate().
 */
export function initAiProvider(secrets: vscode.SecretStorage): void {
  _secrets = secrets;
}

/**
 * Store the AI API key securely.
 */
export async function setAiApiKey(): Promise<void> {
  if (!_secrets) {
    vscode.window.showErrorMessage('A11y Scanner: Secret storage not initialized.');
    return;
  }
  const key = await vscode.window.showInputBox({
    prompt: 'Enter your AI provider API key',
    password: true,
    placeHolder: 'sk-...',
    ignoreFocusOut: true,
  });
  if (key !== undefined) {
    await _secrets.store('a11y.aiApiKey', key);
    vscode.window.showInformationMessage('A11y Scanner: API key stored securely.');
  }
}

/**
 * Get an AI-powered fix suggestion for an accessibility issue.
 */
export async function getAiFix(code: string, issue: A11yIssue, surroundingContext: string): Promise<AiFixResponse | null> {
  const config = vscode.workspace.getConfiguration('a11y');
  const provider = config.get<string>('aiProvider', 'none');

  if (provider === 'none') {
    return null;
  }

  // Retrieve API key from SecretStorage
  let apiKey: string | undefined;
  if (_secrets) {
    apiKey = await _secrets.get('a11y.aiApiKey');
  }
  const model = config.get<string>('aiModel', 'gpt-4');

  if (!apiKey) {
    const legacyKey = config.get<string>('aiApiKey', '');
    if (legacyKey) {
      vscode.window.showWarningMessage(
        'A11y Scanner: API key found in plaintext settings. Run "A11y: Set AI API Key" to store it securely, then remove a11y.aiApiKey from settings.',
      );
    } else {
      vscode.window.showWarningMessage('A11y Scanner: AI API key not configured. Run "A11y: Set AI API Key" to set it up.');
    }
    return null;
  }

  const userMessage = `Accessibility Issue: ${issue.message}
Rule: ${issue.rule}
Severity: ${issue.severity}

Code snippet with the issue:
\`\`\`tsx
${code}
\`\`\`

Surrounding context:
\`\`\`tsx
${surroundingContext}
\`\`\`

Provide a fix as JSON with "fixedCode" and "explanation" fields.`;

  try {
    let response: string;

    if (provider === 'azure-openai') {
      response = await callAzureOpenAI(apiKey, model, userMessage, config);
    } else {
      response = await callOpenAI(apiKey, model, userMessage);
    }

    const parsed = JSON.parse(response);
    return {
      fixedCode: parsed.fixedCode,
      explanation: parsed.explanation,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    vscode.window.showErrorMessage(`A11y Scanner: AI fix failed - ${message}`);
    return null;
  }
}

const AI_TIMEOUT_MS = 30_000;

async function callOpenAI(apiKey: string, model: string, userMessage: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    return data.choices[0].message.content;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callAzureOpenAI(apiKey: string, deployment: string, userMessage: string, config: vscode.WorkspaceConfiguration): Promise<string> {
  const endpoint = config.get<string>('aiEndpoint', '');
  if (!endpoint) {
    throw new Error('Azure OpenAI endpoint not configured');
  }

  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=2024-02-01`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Azure OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    return data.choices[0].message.content;
  } finally {
    clearTimeout(timeoutId);
  }
}
