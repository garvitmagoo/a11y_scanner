# Changelog

## [0.1.0] - 2025-01-01

### Added

- **AST-based accessibility scanning** for React/JSX/TSX files
- **8 built-in rules**: img-alt, button-label, aria-role, form-label, click-key-events, aria-pattern, color-contrast, heading-order
- **AI-powered fix suggestions** via OpenAI or Azure OpenAI
- **Screen reader text preview** with simulated announcements
- **Accessibility score** in the status bar (0–100)
- **Auto-generate accessibility tests** from detected issues
- **Git regression tracking** — compare accessibility between commits
- **CI/CD export** — SARIF and JSON report formats
- **Real-time scanning** with debounced diagnostics on file change
- **Quick fixes** for every rule via VS Code Code Actions
- **Configuration** support via `.a11yrc.json` (enable/disable rules, exclude files)
- **Secure API key storage** using VS Code SecretStorage
- **Webview report panel** with issue visualization
