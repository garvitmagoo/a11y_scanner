import * as vscode from "vscode";
import { scanForA11yIssues } from "./scanner/astScanner";
import { getAiFix } from "./ai/provider";
import type { A11yIssue } from "./types";

/**
 * SARIF (Static Analysis Results Interchange Format) v2.1.0 exporter.
 * Produces output consumable by:
 *   - GitHub Code Scanning (upload via actions/upload-sarif)
 *   - Azure DevOps
 *   - SonarQube
 *   - VS Code SARIF Viewer extension
 *
 * Also supports a lightweight JSON export for custom CI integrations.
 */

/* ── SARIF type subset (just enough to produce valid output) ────────────── */

interface SarifLog {
  $schema: string;
  version: string;
  runs: SarifRun[];
}

interface SarifRun {
  tool: { driver: SarifDriver };
  results: SarifResult[];
}

interface SarifDriver {
  name: string;
  version: string;
  informationUri: string;
  rules: SarifRule[];
}

interface SarifRule {
  id: string;
  shortDescription: { text: string };
  helpUri?: string;
  defaultConfiguration: { level: string };
}

interface SarifResult {
  ruleId: string;
  level: string;
  message: { text: string };
  locations: SarifLocation[];
}

interface SarifLocation {
  physicalLocation: {
    artifactLocation: { uri: string; uriBaseId: string };
    region: { startLine: number; startColumn: number };
  };
}

/* ── Rule metadata for SARIF ────────────────────────────────────────────── */

const RULE_METADATA: Record<string, { description: string; wcag?: string }> = {
  "img-alt": { description: "Images must have alt text", wcag: "1.1.1" },
  "button-label": {
    description: "Buttons must have accessible names",
    wcag: "4.1.2",
  },
  "aria-role": { description: "ARIA roles must be valid", wcag: "4.1.2" },
  "form-label": {
    description: "Form controls must have labels",
    wcag: "1.3.1",
  },
  "click-events-have-key-events": {
    description: "Interactive elements need keyboard support",
    wcag: "2.1.1",
  },
  "aria-pattern": {
    description: "ARIA widget patterns must be correctly structured",
    wcag: "4.1.2",
  },
  "color-contrast": {
    description: "Text must meet WCAG AA contrast ratio",
    wcag: "1.4.3",
  },
  "heading-order": {
    description: "Heading levels should follow logical order",
    wcag: "1.3.1",
  },
};

/* ── Export commands ────────────────────────────────────────────────────── */

export async function exportSarif(): Promise<void> {
  try {
    const result = await scanWorkspaceForExport();
    if (!result) {
      return;
    }

    const sarif = buildSarif(result);
    await saveExport(
      JSON.stringify(sarif, null, 2),
      "a11y-report.sarif",
      "SARIF",
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    vscode.window.showErrorMessage(
      `A11y Scanner: SARIF export failed — ${msg}`,
    );
  }
}

export async function exportJson(): Promise<void> {
  try {
    const result = await scanWorkspaceForExport();
    if (!result) {
      return;
    }

    const report = buildJsonReport(result);
    await saveExport(
      JSON.stringify(report, null, 2),
      "a11y-report.json",
      "JSON",
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    vscode.window.showErrorMessage(`A11y Scanner: JSON export failed — ${msg}`);
  }
}

/**
 * Export report with AI-powered fix suggestions.
 * This includes proposed fixes for each issue from the AI provider.
 */
export async function exportJsonWithAiFixes(): Promise<void> {
  try {
    const result = await scanWorkspaceForExport();
    if (!result) {
      return;
    }

    // Check if AI provider is configured
    const config = vscode.workspace.getConfiguration("a11y");
    const provider = config.get<string>("aiProvider", "none");

    if (provider === "none") {
      vscode.window.showWarningMessage(
        'A11y Scanner: AI provider not configured. Set up "a11y.aiProvider" to enable AI fix suggestions.',
      );
      return;
    }

    // Enhance the report with AI suggestions
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "A11y Scanner: Generating AI fix suggestions...",
        cancellable: false,
      },
      async (progress) => {
        let processed = 0;
        const totalIssues = result.totalIssues;

        for (const file of result.files) {
          // Read the actual file content to get context for AI fixes
          const fileUri = vscode.Uri.file(file.absolutePath);
          const fileContent = await vscode.workspace.fs.readFile(fileUri);
          const fileText = new TextDecoder().decode(fileContent);

          for (const issue of file.issues) {
            processed++;
            progress.report({ increment: 100 / totalIssues });

            // Get AI fix for this issue
            const aiFix = await getIssueAiFix(fileText, issue);
            if (aiFix) {
              (issue as any).aiFix = aiFix;
            }
          }
        }
      },
    );

    const report = buildJsonReport(result);
    await saveExport(
      JSON.stringify(report, null, 2),
      "a11y-report-with-fixes.json",
      "JSON",
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    vscode.window.showErrorMessage(
      `A11y Scanner: JSON export with fixes failed — ${msg}`,
    );
  }
}

/* ── Shared scan ────────────────────────────────────────────────────────── */

interface ScanResult {
  files: { relativePath: string; absolutePath: string; issues: A11yIssue[] }[];
  totalIssues: number;
  scannedAt: string;
}

async function scanWorkspaceForExport(): Promise<ScanResult | null> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showWarningMessage("A11y Scanner: No workspace folder open.");
    return null;
  }

  return await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "A11y Scanner: Scanning workspace for export...",
      cancellable: false,
    },
    async () => {
      const fileUris = await vscode.workspace.findFiles(
        "**/*.{tsx,jsx}",
        "**/node_modules/**",
      );
      const files: ScanResult["files"] = [];
      let totalIssues = 0;

      for (const uri of fileUris) {
        const doc = await vscode.workspace.openTextDocument(uri);
        const issues = scanForA11yIssues(doc.getText(), doc.fileName);
        const relativePath = vscode.workspace.asRelativePath(uri);
        files.push({ relativePath, absolutePath: doc.fileName, issues });
        totalIssues += issues.length;
      }

      return { files, totalIssues, scannedAt: new Date().toISOString() };
    },
  );
}

/* ── SARIF builder ──────────────────────────────────────────────────────── */

function buildSarif(scan: ScanResult): SarifLog {
  const seenRules = new Set<string>();
  const results: SarifResult[] = [];

  for (const file of scan.files) {
    for (const issue of file.issues) {
      seenRules.add(issue.rule);
      results.push({
        ruleId: issue.rule,
        level: severityToSarifLevel(issue.severity),
        message: { text: issue.message },
        locations: [
          {
            physicalLocation: {
              artifactLocation: {
                uri: file.relativePath.replace(/\\/g, "/"),
                uriBaseId: "%SRCROOT%",
              },
              region: {
                startLine: issue.line + 1, // SARIF uses 1-based lines
                startColumn: issue.column + 1,
              },
            },
          },
        ],
      });
    }
  }

  const rules: SarifRule[] = Array.from(seenRules)
    .sort()
    .map((id) => {
      const meta = RULE_METADATA[id];
      return {
        id,
        shortDescription: { text: meta?.description || id },
        helpUri: meta?.wcag
          ? `https://www.w3.org/WAI/WCAG21/Understanding/${wcagAnchor(meta.wcag)}`
          : undefined,
        defaultConfiguration: { level: "warning" },
      };
    });

  return {
    $schema:
      "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "A11y Scanner",
            version: "0.1.0",
            informationUri: "https://github.com/lockton/a11y-scanner-extension",
            rules,
          },
        },
        results,
      },
    ],
  };
}

function severityToSarifLevel(severity: A11yIssue["severity"]): string {
  switch (severity) {
    case "error":
      return "error";
    case "warning":
      return "warning";
    case "info":
      return "note";
    case "hint":
      return "note";
  }
}

function wcagAnchor(sc: string): string {
  // Map WCAG SC numbers to Understanding doc slugs
  const map: Record<string, string> = {
    "1.1.1": "non-text-content",
    "1.3.1": "info-and-relationships",
    "1.4.3": "contrast-minimum",
    "2.1.1": "keyboard",
    "4.1.2": "name-role-value",
  };
  return map[sc] || sc;
}

/* ── JSON report builder ────────────────────────────────────────────────── */

/**
 * Helper function to get context snippet around an issue
 */
function getContextSnippet(
  code: string,
  issue: A11yIssue,
  contextLines: number = 2,
): string {
  const lines = code.split("\n");
  const startLine = Math.max(0, issue.line - contextLines);
  const endLine = Math.min(
    lines.length,
    (issue.endLine ?? issue.line) + contextLines + 1,
  );
  return lines.slice(startLine, endLine).join("\n");
}

/**
 * Get AI fix suggestion for an issue (can be used in reports)
 */
async function getIssueAiFix(
  fileContent: string,
  issue: A11yIssue,
): Promise<{ fixedCode?: string; explanation?: string } | null> {
  try {
    const surroundingContext = getContextSnippet(fileContent, issue);
    const codeSnippet = issue.snippet;
    const aiFix = await getAiFix(codeSnippet, issue, surroundingContext);
    return aiFix;
  } catch (e) {
    console.error("Error getting AI fix:", e);
    return null;
  }
}

function buildJsonReport(scan: ScanResult): object {
  const byRule: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};

  for (const file of scan.files) {
    for (const issue of file.issues) {
      byRule[issue.rule] = (byRule[issue.rule] || 0) + 1;
      bySeverity[issue.severity] = (bySeverity[issue.severity] || 0) + 1;
    }
  }

  return {
    tool: "A11y Scanner",
    version: "0.1.0",
    scannedAt: scan.scannedAt,
    summary: {
      totalIssues: scan.totalIssues,
      filesScanned: scan.files.length,
      filesWithIssues: scan.files.filter((f) => f.issues.length > 0).length,
      byRule,
      bySeverity,
    },
    files: scan.files
      .filter((f) => f.issues.length > 0)
      .map((f) => ({
        path: f.relativePath.replace(/\\/g, "/"),
        issueCount: f.issues.length,
        issues: f.issues.map((i) => {
          const issue: any = {
            rule: i.rule,
            severity: i.severity,
            message: i.message,
            line: i.line + 1,
            column: i.column + 1,
            snippet: i.snippet,
            wcag: RULE_METADATA[i.rule]?.wcag || null,
          };

          // Include AI fix suggestion details if available
          // Note: These are parsed from the issue object if pre-computed
          if ((i as any).aiFix) {
            issue.aiSuggestion = {
              explanation: (i as any).aiFix.explanation,
              fixedCode: (i as any).aiFix.fixedCode,
            };
          }

          return issue;
        }),
      })),
  };
}

/* ── File save helper ───────────────────────────────────────────────────── */

async function saveExport(
  content: string,
  defaultName: string,
  format: string,
): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  const defaultUri = workspaceFolder
    ? vscode.Uri.joinPath(workspaceFolder.uri, defaultName)
    : undefined;

  const saveUri = await vscode.window.showSaveDialog({
    defaultUri,
    filters:
      format === "SARIF"
        ? { SARIF: ["sarif"], JSON: ["json"] }
        : { JSON: ["json"] },
    title: `Save A11y ${format} Report`,
  });

  if (!saveUri) {
    return; // User cancelled
  }

  const encoder = new TextEncoder();
  await vscode.workspace.fs.writeFile(saveUri, encoder.encode(content));
  vscode.window.showInformationMessage(
    `A11y Scanner: ${format} report saved to ${vscode.workspace.asRelativePath(saveUri)}`,
  );
}
