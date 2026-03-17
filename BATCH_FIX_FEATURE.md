# Batch AI Fix Feature - Implementation Summary

## Overview
Added comprehensive batch AI fix capabilities to the A11y Scanner extension. Users can now fix multiple accessibility issues across an entire file or workspace at once, with a preview panel to review all changes before applying them.

## New Features

### 1. **Batch Fix Current File**
- Command: `a11y.batchFixCurrentFile`
- Analyzes the active file for all accessibility issues
- Gets AI-powered fixes for all detected issues
- Shows before-and-after preview in a webview panel
- Allows selective approval before applying fixes

### 2. **Batch Fix Entire Workspace**
- Command: `a11y.batchFixWorkspace`
- Scans all `.tsx` and `.jsx` files in the workspace
- Generates AI fixes for issues across all files
- Displays batch preview with file-level organization
- Apply fixes to multiple files in one action

### 3. **Interactive Preview Panel**
- Visual before-and-after code comparison
- File-level summaries showing:
  - Number of successfully fixed issues
  - Number of failed fixes
  - Issue details with explanations
- Checkboxes to select/deselect files
- "Select All" / "Deselect All" controls
- Summary statistics:
  - Total files affected
  - Total issues found
  - Applied fixes count
  - Failed fixes count

## New Files Created

### `/src/ai/batchFixer.ts`
Core logic for batch fixing operations:
- `getFileBatchFixPreview()` - Generate preview for a single file
- `getWorkspaceBatchFixPreview()` - Generate previews for all workspace files
- `applyBatchFixPreview()` - Apply fixes from preview to a single file
- `applyBatchFixPreviews()` - Apply fixes from multiple file previews
- `generateFixSummary()` - Create summary statistics
- Helper functions for code manipulation and context extraction

**Key Types:**
```typescript
interface FileFixPreview {
  uri: vscode.Uri;
  path: string;
  originalCode: string;
  fixedCode: string;
  issues: IssueFix[];
  appliedCount: number;
  failedCount: number;
}

interface IssueFix {
  issue: A11yIssue;
  status: 'pending' | 'applied' | 'failed';
  fixedCode?: string;
  explanation?: string;
  error?: string;
}
```

### `/src/webview/batchFixPreviewPanel.ts`
Webview UI for batch fix preview:
- Displays files with checkboxes for selection
- Shows code snippets with before/after comparison
- AI explanations for each fix
- Interactive buttons to apply, select, or deselect fixes
- Responsive VS Code theme-aware styling
- Real-time webview message handling

## Updated Files

### `/src/extension.ts`
Added two new command registrations:

```typescript
// Batch fix current file
vscode.commands.registerCommand('a11y.batchFixCurrentFile', async () => {
  // Shows preview for active file
});

// Batch fix workspace
vscode.commands.registerCommand('a11y.batchFixWorkspace', async () => {
  // Shows preview for all files in workspace
});
```

### `/package.json`
Added command contributions:
```json
{
  "command": "a11y.batchFixCurrentFile",
  "title": "A11y: Batch Fix Current File (Preview & Apply)"
},
{
  "command": "a11y.batchFixWorkspace",
  "title": "A11y: Batch Fix Entire Workspace (Preview & Apply)"
}
```

## User Workflow

1. **Access batch fix feature:**
   - Open Command Palette (Cmd+Shift+P / Ctrl+Shift+P)
   - Search for "Batch Fix Current File" or "Batch Fix Workspace"

2. **Review preview:**
   - Extension analyzes issues and gets AI fixes
   - Progress notification shows analysis status
   - Preview panel opens with before/after comparisons
   - Each file shows applied vs failed fix counts

3. **Select files to fix:**
   - Check/uncheck individual files
   - Use "Select All" / "Deselect All" buttons
   - View detailed fix explanations by expanding file sections

4. **Apply fixes:**
   - Click "Apply Selected Fixes" button
   - Confirmation dialog appears
   - Files are updated with fixes
   - Success message with summary statistics

## Technical Features

### Error Handling
- Gracefully handles AI failures per issue
- Shows which fixes failed in preview
- Allows applying successful fixes even if some fail
- Detailed error messages in webview

### Performance
- Parallel AI requests for better speed
- Debounced UI updates
- Progress notifications for long operations
- Cancellable operations with proper cleanup

### Code Safety
- Sorts issues by line number (reverse) to avoid offset conflicts
- Preserves original code until user confirms
- Full file backup available in webview
- Validation of line/column ranges

### AI Integration
- Reuses existing AI provider infrastructure
- Supports OpenAI and Azure OpenAI
- Includes surrounding context for better fixes
- Configurable system prompts and models

## Configuration

The feature automatically uses existing a11y scanner configuration:
- AI provider setting: `a11y.aiProvider`
- AI model setting: `a11y.aiModel`
- API key from SecretStorage: `a11y.aiApiKey`
- File exclusions: `.a11yrc.json`

## Future Enhancements

Potential improvements for future versions:
- Undo capability for applied batch fixes
- Diff viewer integration with native VS Code diff
- Batch fix scheduling/automation
- Fix history and rollback
- Performance metrics and timing
- Custom fix templates
- Machine learning to learn from accepted/rejected fixes

## Testing

To test the feature:
1. Set up AI provider with valid API key
2. Run `npm run compile` to build
3. Press F5 to launch Extension Development Host
4. Open a project with accessibility issues
5. Run "A11y: Batch Fix Current File" or "A11y: Batch Fix Workspace"
6. Review the preview and test applying fixes

