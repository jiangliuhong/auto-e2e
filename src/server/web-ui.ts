export function renderDashboardHtml(): string {
  return `<!doctype html>
<html lang="zh-CN" data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>auto-e2e · BetterWright 验收工作区</title>
  <style>
    :root {
      --bg: #09090b;
      --panel: #111115;
      --panel-elevated: #18181d;
      --panel-card: #141419;
      --hover: #1f1f26;
      --active: #272732;
      --border: #26262e;
      --border-subtle: #1c1c22;
      --text: #f4f4f6;
      --text-secondary: #a1a1aa;
      --text-muted: #71717a;
      --accent: #6366f1;
      --accent-hover: #4f46e5;
      --accent-light: rgba(99, 102, 241, 0.12);
      --accent-border: rgba(99, 102, 241, 0.28);
      --good: #10b981;
      --good-bg: rgba(16, 185, 129, 0.12);
      --good-border: rgba(16, 185, 129, 0.25);
      --bad: #f43f5e;
      --bad-bg: rgba(244, 63, 94, 0.12);
      --bad-border: rgba(244, 63, 94, 0.25);
      --warn: #f59e0b;
      --warn-bg: rgba(245, 158, 11, 0.12);
      --warn-border: rgba(245, 158, 11, 0.25);
      --radius-sm: 6px;
      --radius-md: 10px;
      --radius-lg: 14px;
      --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.2);
      --shadow-md: 0 4px 14px rgba(0, 0, 0, 0.35);
      --shadow-lg: 0 12px 30px rgba(0, 0, 0, 0.45);
      --font-mono: ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      color-scheme: dark;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }

    html[data-theme="light"] {
      --bg: #f8fafc;
      --panel: #ffffff;
      --panel-elevated: #f1f5f9;
      --panel-card: #ffffff;
      --hover: #f1f5f9;
      --active: #e2e8f0;
      --border: #e2e8f0;
      --border-subtle: #cbd5e1;
      --text: #0f172a;
      --text-secondary: #475569;
      --text-muted: #94a3b8;
      --accent: #4f46e5;
      --accent-hover: #4338ca;
      --accent-light: rgba(79, 70, 229, 0.08);
      --accent-border: rgba(79, 70, 229, 0.25);
      --good: #059669;
      --good-bg: rgba(5, 150, 105, 0.1);
      --good-border: rgba(5, 150, 105, 0.25);
      --bad: #e11d48;
      --bad-bg: rgba(225, 29, 72, 0.1);
      --bad-border: rgba(225, 29, 72, 0.25);
      --warn: #d97706;
      --warn-bg: rgba(217, 119, 6, 0.1);
      --warn-border: rgba(217, 119, 6, 0.25);
      --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
      --shadow-md: 0 4px 14px rgba(0, 0, 0, 0.08);
      --shadow-lg: 0 12px 30px rgba(0, 0, 0, 0.12);
      color-scheme: light;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      line-height: 1.5;
      font-size: 14px;
      -webkit-font-smoothing: antialiased;
    }

    button, input, textarea, select {
      font: inherit;
      color: inherit;
    }
    button {
      cursor: pointer;
      border: none;
      background: none;
    }
    a {
      color: var(--accent);
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }

    /* Scrollbar */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }

    /* Header */
    header {
      height: 64px;
      padding: 0 24px;
      border-bottom: 1px solid var(--border);
      background: var(--panel);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      position: sticky;
      top: 0;
      z-index: 20;
      backdrop-filter: blur(8px);
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 20px;
      flex: 1;
      min-width: 0;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
    }
    .logo-icon {
      width: 34px;
      height: 34px;
      border-radius: var(--radius-md);
      background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      box-shadow: 0 2px 8px rgba(99, 102, 241, 0.4);
      flex-shrink: 0;
    }
    .brand h1 {
      font-size: 16px;
      font-weight: 700;
      letter-spacing: -0.02em;
      display: flex;
      align-items: center;
      gap: 8px;
      line-height: 1.2;
    }
    .brand .version-pill {
      font-size: 11px;
      font-weight: 500;
      padding: 2px 7px;
      border-radius: 20px;
      background: var(--accent-light);
      color: var(--accent);
      border: 1px solid var(--accent-border);
    }
    .brand .sub {
      font-size: 11.5px;
      color: var(--text-muted);
    }

    /* Workspace Picker in Header */
    .workspace-header-picker {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      flex: 1;
    }
    .workspace-picker-btn {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 6px 14px;
      border-radius: var(--radius-md);
      background: var(--panel-elevated);
      border: 1px solid var(--border);
      color: var(--text);
      cursor: pointer;
      transition: all 0.15s ease;
      max-width: 680px;
      min-width: 0;
    }
    .workspace-picker-btn:hover {
      background: var(--hover);
      border-color: var(--accent);
      box-shadow: var(--shadow-sm);
    }
    .workspace-picker-icon {
      color: var(--accent);
      display: flex;
      align-items: center;
      flex-shrink: 0;
    }
    .workspace-picker-details {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 1px;
      min-width: 0;
      overflow: hidden;
    }
    .workspace-picker-name {
      font-weight: 600;
      font-size: 13.5px;
      color: var(--text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .workspace-picker-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      max-width: 100%;
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--text-muted);
      white-space: nowrap;
      overflow: hidden;
    }
    .workspace-picker-path,
    .workspace-picker-url {
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .workspace-picker-path { max-width: 330px; }
    .workspace-picker-url { max-width: 210px; }
    .workspace-picker-separator { flex-shrink: 0; }
    .workspace-open-link {
      width: 32px;
      height: 32px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: var(--panel-elevated);
      color: var(--accent);
      transition: all 0.15s ease;
    }
    .workspace-open-link:hover {
      text-decoration: none;
      border-color: var(--accent);
      background: var(--hover);
    }
    .workspace-open-link[aria-disabled="true"] {
      pointer-events: none;
      color: var(--text-muted);
      opacity: 0.55;
    }
    .workspace-picker-arrow {
      color: var(--text-muted);
      flex-shrink: 0;
      display: flex;
      align-items: center;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
    }
    .server-status {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--good);
      background: var(--good-bg);
      border: 1px solid var(--good-border);
      padding: 4px 10px;
      border-radius: 20px;
      font-weight: 500;
    }
    .status-dot-pulse {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--good);
      box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
      animation: pulse-dot 2s infinite;
    }
    @keyframes pulse-dot {
      0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
      70% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
      100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }

    /* Layout & Main */
    .layout {
      flex: 1;
      display: flex;
      flex-direction: column;
      width: 100%;
    }
    main {
      padding: 24px 32px;
      max-width: 1400px;
      width: 100%;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 20px;
      flex: 1;
    }

    /* Common Components */
    .row { display: flex; align-items: center; gap: 10px; }
    .between { justify-content: space-between; }
    .stack { display: flex; flex-direction: column; gap: 12px; }
    .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
    .grid-1-2 { display: grid; grid-template-columns: 1fr 1.3fr; gap: 20px; }

    .card {
      background: var(--panel-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 20px;
      box-shadow: var(--shadow-sm);
      transition: border-color 0.15s ease;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .card-title {
      font-size: 15px;
      font-weight: 600;
      color: var(--text);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* Buttons */
    .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      border: 1px solid var(--border);
      background: var(--panel-elevated);
      color: var(--text);
      border-radius: var(--radius-md);
      padding: 8px 14px;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.15s ease;
      white-space: nowrap;
    }
    .button:hover:not(:disabled) {
      background: var(--hover);
      border-color: var(--border-subtle);
    }
    .button:active:not(:disabled) {
      transform: scale(0.98);
    }
    .button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .button.primary {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
      font-weight: 600;
      box-shadow: 0 2px 8px rgba(99, 102, 241, 0.35);
    }
    .button.primary:hover:not(:disabled) {
      background: var(--accent-hover);
      border-color: var(--accent-hover);
    }
    .button.danger {
      color: var(--bad);
      border-color: var(--bad-border);
      background: var(--bad-bg);
    }
    .button.danger:hover:not(:disabled) {
      background: var(--bad);
      color: #fff;
    }
    .button.icon-only {
      padding: 8px;
      border-radius: var(--radius-md);
    }
    .button.sm {
      padding: 5px 10px;
      font-size: 12px;
      border-radius: var(--radius-sm);
    }

    /* Inputs */
    .input, .textarea, .select {
      border: 1px solid var(--border);
      background: var(--panel-elevated);
      color: var(--text);
      border-radius: var(--radius-md);
      padding: 9px 13px;
      font-size: 13px;
      transition: all 0.15s ease;
      width: 100%;
    }
    .input:focus, .textarea:focus, .select:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-light);
    }
    .input::placeholder, .textarea::placeholder {
      color: var(--text-muted);
    }
    .label {
      font-size: 12px;
      font-weight: 500;
      color: var(--text-secondary);
      margin-bottom: 5px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .form-field {
      display: flex;
      flex-direction: column;
    }
    .textarea {
      font-family: var(--font-mono);
      font-size: 12.5px;
      line-height: 1.6;
      resize: vertical;
      min-height: 280px;
      tab-size: 2;
    }
    .spec-toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: var(--panel-elevated);
    }
    .spec-toolbar .select {
      flex: 1;
      min-width: 0;
      background: var(--panel-card);
    }
    .spec-count {
      flex-shrink: 0;
      font-size: 11px;
      color: var(--text-muted);
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 3px 8px;
      background: var(--panel-card);
      white-space: nowrap;
    }
    .run-scope {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 11px 12px;
      border: 1px solid var(--accent-border);
      border-radius: var(--radius-md);
      background: var(--accent-light);
      color: var(--text-secondary);
      font-size: 12px;
      line-height: 1.45;
    }
    .run-scope svg { color: var(--accent); flex-shrink: 0; margin-top: 1px; }
    .run-scope strong { color: var(--text); }
    .checkbox-label {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--text-secondary);
      cursor: pointer;
      user-select: none;
    }
    .checkbox-label input[type="checkbox"] {
      accent-color: var(--accent);
      width: 16px;
      height: 16px;
      cursor: pointer;
    }

    .meta-tag {
      font-family: var(--font-mono);
      background: var(--panel-elevated);
      padding: 2px 8px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border);
    }
    .badge-count {
      font-size: 11px;
      font-weight: 600;
      padding: 1px 7px;
      border-radius: 12px;
      background: var(--panel-elevated);
      border: 1px solid var(--border);
      color: var(--text-secondary);
    }

    /* Status Badges */
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 3px 9px;
      border-radius: 20px;
      border: 1px solid transparent;
      line-height: 1;
    }
    .status-badge.passed {
      background: var(--good-bg);
      color: var(--good);
      border-color: var(--good-border);
    }
    .status-badge.failed {
      background: var(--bad-bg);
      color: var(--bad);
      border-color: var(--bad-border);
    }
    .status-badge.blocked, .status-badge.error {
      background: var(--warn-bg);
      color: var(--warn);
      border-color: var(--warn-border);
    }

    /* Run History List */
    .history-tabs {
      display: flex;
      align-items: center;
      gap: 6px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 10px;
      margin-bottom: 4px;
    }
    .tab-btn {
      padding: 4px 10px;
      font-size: 12px;
      border-radius: var(--radius-sm);
      color: var(--text-secondary);
      font-weight: 500;
    }
    .tab-btn:hover {
      background: var(--hover);
      color: var(--text);
    }
    .tab-btn.active {
      background: var(--accent-light);
      color: var(--accent);
      font-weight: 600;
    }
    .runs-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-height: 520px;
      overflow-y: auto;
      padding-right: 4px;
    }
    .run-item {
      padding: 14px;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: var(--panel-elevated);
      cursor: pointer;
      transition: all 0.15s ease;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .run-item:hover {
      background: var(--hover);
      border-color: var(--border-subtle);
      transform: translateY(-1px);
    }
    .run-item.active {
      border-color: var(--accent);
      background: var(--accent-light);
      box-shadow: 0 0 0 1px var(--accent-border);
    }
    .run-item-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .run-item-title {
      font-weight: 600;
      font-size: 13.5px;
      color: var(--text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .run-item-bottom {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11.5px;
      color: var(--text-muted);
    }
    .run-item-stats {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* Run Detail View */
    .detail-view {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .detail-header-card {
      background: var(--panel-elevated);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .detail-summary {
      font-size: 14px;
      color: var(--text);
      line-height: 1.5;
    }
    .detail-meta-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      font-size: 12px;
    }
    .detail-meta-item {
      background: var(--panel-card);
      border: 1px solid var(--border);
      padding: 4px 9px;
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--text-secondary);
    }
    .detail-meta-item strong {
      color: var(--text);
    }

    .criteria-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .criterion-card {
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: var(--panel-elevated);
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      transition: border-color 0.15s ease;
    }
    .criterion-card.passed { border-left: 3px solid var(--good); }
    .criterion-card.failed { border-left: 3px solid var(--bad); }
    .criterion-card.blocked { border-left: 3px solid var(--warn); }
    .criterion-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .criterion-id-tag {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: var(--radius-sm);
      background: var(--panel-card);
      border: 1px solid var(--border);
      color: var(--text-secondary);
    }
    .criterion-desc {
      font-size: 14px;
      font-weight: 600;
      color: var(--text);
      line-height: 1.4;
    }
    .criterion-actual {
      font-size: 12.5px;
      color: var(--text-secondary);
      background: var(--panel-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 8px 12px;
      line-height: 1.5;
    }
    .criterion-proof-img {
      max-width: 100%;
      border-radius: var(--radius-md);
      border: 1px solid var(--border);
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      display: block;
      margin-top: 4px;
    }
    .criterion-proof-img:hover {
      transform: scale(1.01);
      box-shadow: var(--shadow-md);
      border-color: var(--accent);
    }

    /* Terminal Console */
    .terminal-box {
      background: #090a0f;
      color: #e2e8f0;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      font-family: var(--font-mono);
      font-size: 12px;
      line-height: 1.6;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .terminal-header {
      background: #11131a;
      padding: 8px 12px;
      border-bottom: 1px solid #1e222d;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      color: #8b949e;
    }
    .mac-dots {
      display: flex;
      gap: 6px;
    }
    .mac-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    .mac-dot.red { background: #ff5f56; }
    .mac-dot.yellow { background: #ffbd2e; }
    .mac-dot.green { background: #27c93f; }
    .terminal-content {
      padding: 14px;
      max-height: 240px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-all;
    }

    /* Modals & Dialogs */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.72);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      padding: 20px;
      animation: fade-in 0.15s ease;
    }
    .modal-dialog {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      width: 100%;
      max-width: 680px;
      box-shadow: var(--shadow-lg);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      max-height: 86vh;
      animation: slide-up 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .modal-header {
      padding: 18px 24px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--panel-elevated);
    }
    .modal-title-group {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .modal-title {
      font-size: 16px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--text);
    }
    .modal-subtitle {
      font-size: 12px;
      color: var(--text-muted);
    }
    .modal-close-btn {
      width: 32px;
      height: 32px;
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-secondary);
      font-size: 20px;
      transition: all 0.15s ease;
    }
    .modal-close-btn:hover {
      background: var(--hover);
      color: var(--text);
    }
    .modal-tabs {
      display: flex;
      gap: 4px;
      padding: 8px 24px;
      border-bottom: 1px solid var(--border);
      background: var(--panel-card);
    }
    .modal-tab-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 14px;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-secondary);
      border-radius: var(--radius-md);
      transition: all 0.15s ease;
    }
    .modal-tab-btn:hover {
      background: var(--hover);
      color: var(--text);
    }
    .modal-tab-btn.active {
      background: var(--accent-light);
      color: var(--accent);
      font-weight: 600;
    }
    .modal-body {
      padding: 20px 24px;
      overflow-y: auto;
      flex: 1;
      min-height: 300px;
    }
    .modal-ws-search-bar {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 14px;
    }
    .modal-ws-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-height: 400px;
      overflow-y: auto;
    }
    .modal-ws-item {
      padding: 14px 16px;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: var(--panel-elevated);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      transition: all 0.15s ease;
    }
    .modal-ws-item:hover {
      border-color: var(--border-subtle);
      background: var(--hover);
    }
    .modal-ws-item.active {
      border-color: var(--accent);
      background: var(--accent-light);
      box-shadow: 0 0 0 1px var(--accent-border);
    }
    .modal-ws-item-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
      flex: 1;
    }
    .modal-ws-item-title {
      font-weight: 600;
      font-size: 14px;
      color: var(--text);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .modal-ws-item.active .modal-ws-item-title {
      color: var(--accent);
    }
    .modal-ws-item-url {
      font-size: 12px;
      color: var(--text-muted);
      word-break: break-all;
    }
    .modal-ws-item.error .modal-ws-item-url {
      color: var(--bad);
    }
    .modal-ws-item-path {
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--text-muted);
      word-break: break-all;
    }
    .modal-ws-item-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    /* Lightbox Modal */
    .lightbox-content {
      max-width: 90vw;
      max-height: 90vh;
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }
    .lightbox-img {
      max-width: 100%;
      max-height: 80vh;
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-lg);
      border: 1px solid var(--border);
    }

    /* Empty States */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 64px 24px;
      gap: 14px;
      color: var(--text-muted);
    }
    .empty-icon {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: var(--panel-elevated);
      border: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      color: var(--text-secondary);
      margin-bottom: 4px;
    }
    .empty-state h2 {
      font-size: 18px;
      font-weight: 600;
      color: var(--text);
    }
    .empty-state p {
      font-size: 13.5px;
      max-width: 460px;
      line-height: 1.5;
    }

    /* Toast */
    #toast {
      position: fixed;
      right: 24px;
      bottom: 24px;
      background: var(--panel);
      border: 1px solid var(--border);
      box-shadow: var(--shadow-lg);
      padding: 12px 18px;
      border-radius: var(--radius-md);
      display: none;
      z-index: 1000;
      font-size: 13px;
      font-weight: 500;
      align-items: center;
      gap: 8px;
      animation: slide-up 0.2s ease;
    }
    #toast.error {
      border-color: var(--bad-border);
      color: var(--bad);
      background: var(--panel);
    }
    #toast.success {
      border-color: var(--good-border);
      color: var(--good);
      background: var(--panel);
    }

    @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slide-up { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    .hidden { display: none !important; }

    @media (max-width: 1024px) {
      .grid-2, .grid-1-2 { grid-template-columns: 1fr; }
      .header-left { gap: 12px; }
      .workspace-picker-path, .workspace-picker-separator { display: none; }
    }
    @media (max-width: 768px) {
      header { padding: 0 16px; }
      main { padding: 16px; }
      .brand .sub { display: none; }
      .workspace-picker-btn { max-width: 220px; }
    }
  </style>
</head>
<body>
  <header>
    <div class="header-left">
      <div class="brand">
        <div class="logo-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
        </div>
        <div>
          <h1>auto-e2e <span class="version-pill">v0.3.0</span></h1>
          <div class="sub">BetterWright 验收工作区</div>
        </div>
      </div>

      <!-- Top Header Workspace Switcher -->
      <div class="workspace-header-picker">
        <button class="workspace-picker-btn" id="open-workspace-modal" title="点击切换、添加或修改工作区">
          <span class="workspace-picker-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          </span>
          <div class="workspace-picker-details">
            <span class="workspace-picker-name" id="header-ws-name">加载中...</span>
            <span class="workspace-picker-meta">
              <span class="workspace-picker-path" id="header-ws-path">-</span>
              <span class="workspace-picker-separator">·</span>
              <span class="workspace-picker-url" id="header-ws-url">-</span>
            </span>
          </div>
          <span class="workspace-picker-arrow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
          </span>
        </button>
        <a class="workspace-open-link" id="header-ws-url-link" href="#" target="_blank" rel="noreferrer" title="打开被测网站" aria-disabled="true">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
        </a>
      </div>
    </div>

    <div class="header-actions">
      <button class="button sm" id="btn-header-manage-ws" title="管理工作区">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        工作区管理
      </button>
      <div class="server-status">
        <span class="status-dot-pulse"></span>
        <span>本地服务运行中</span>
      </div>
      <button class="button sm" id="theme" title="切换显示主题">切换为亮色</button>
    </div>
  </header>

  <div class="layout">
    <main>
      <!-- Empty State -->
      <div id="empty" class="empty-state">
        <div class="empty-icon">📁</div>
        <h2>还没有选择工作区</h2>
        <p>点击上方顶部工作区按钮或下方按钮打开工作区管理弹窗，添加或选择本地项目。</p>
        <button class="button primary" id="btn-empty-open-modal" style="margin-top:8px">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          选择或添加工作区
        </button>
      </div>

      <!-- Active Workspace View -->
      <div id="workspace-view" class="hidden stack">
        <!-- Top Grid: Task Spec & Run Config -->
        <div class="grid-2">
          <!-- Task Spec Editor -->
          <div class="card">
            <div class="card-header">
              <div class="card-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                验收用例
                <span class="meta-tag" id="spec-path" style="font-weight:normal;font-size:11px">.auto-e2e/specs/</span>
              </div>
              <div class="row">
                <button class="button sm" id="format-spec" title="格式化 JSON 内容">格式化</button>
                <button class="button sm" id="reload-spec" title="重新从磁盘读取">重新加载</button>
                <button class="button primary sm" id="save-spec">保存用例</button>
              </div>
            </div>
            <div class="spec-toolbar">
              <select class="select" id="spec-file" title="选择要编辑的验收用例文件"></select>
              <span class="spec-count" id="spec-count">0 个文件</span>
              <button class="button sm" id="new-spec" title="新建验收用例文件">新建</button>
              <button class="button danger sm" id="delete-spec" title="删除当前验收用例文件">删除</button>
            </div>
            <textarea class="textarea" id="task-spec" spellcheck="false" placeholder="{\n  &quot;taskId&quot;: &quot;PL-01&quot;,\n  &quot;title&quot;: &quot;P&amp;L 预测&quot;,\n  &quot;requirement&quot;: &quot;上传模板并执行计算&quot;,\n  &quot;inputs&quot;: [{&quot;name&quot;:&quot;P&amp;L 模板&quot;,&quot;path&quot;:&quot;fixtures/pl.xlsx&quot;}],\n  &quot;outputs&quot;: [{&quot;name&quot;:&quot;税前利润&quot;,&quot;location&quot;:&quot;结果区&quot;,&quot;expected&quot;:125000,&quot;match&quot;:&quot;numeric&quot;}],\n  &quot;acceptanceCriteria&quot;: [&quot;模板上传并计算成功&quot;]\n}"></textarea>
          </div>

          <!-- Run Acceptance -->
          <div class="card">
            <div class="card-header">
              <div class="card-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                运行验收
                <span class="version-pill" style="font-size:11px">BetterWright</span>
              </div>
            </div>
            <div class="stack">
              <div class="run-scope">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                <div><strong id="run-spec-count">0 个用例</strong><br>保存当前编辑内容后，按文件名顺序运行 specs 目录中的全部 <code>*.spec.json</code> 文件。</div>
              </div>
              <div class="form-field">
                <div class="label">目标 URL</div>
                <input class="input" id="run-url" placeholder="http://127.0.0.1:3000">
              </div>
              <div class="grid-2">
                <div class="form-field">
                  <div class="label">Profile</div>
                  <input class="input" id="run-profile" placeholder="default">
                </div>
                <div class="form-field">
                  <div class="label">Model</div>
                  <input class="input" id="run-model" placeholder="claude-3-5-sonnet-latest">
                </div>
              </div>
              <div class="row between" style="margin-top: 2px">
                <label class="checkbox-label">
                  <input type="checkbox" id="run-headed">
                  <span>显示浏览器窗口 (Headed)</span>
                </label>
                <label class="checkbox-label">
                  <input type="checkbox" id="run-fresh">
                  <span>清理历史会话 (Fresh)</span>
                </label>
              </div>
              <button class="button primary" id="run-acceptance" style="padding:11px;font-size:14px">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                运行全部用例
              </button>

              <div class="terminal-box">
                <div class="terminal-header">
                  <div class="mac-dots">
                    <span class="mac-dot red"></span>
                    <span class="mac-dot yellow"></span>
                    <span class="mac-dot green"></span>
                  </div>
                  <span>执行控制台</span>
                  <button id="copy-output" class="button sm" style="padding:2px 6px;font-size:10px;border:none;background:transparent;color:#8b949e">复制</button>
                </div>
                <div class="terminal-content" id="run-output">等待运行...</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Bottom Grid: Runs History & Run Detail -->
        <div class="grid-1-2">
          <!-- History List -->
          <div class="card">
            <div class="card-header">
              <div class="card-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                运行历史
              </div>
              <button class="button sm" id="refresh-runs">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                刷新
              </button>
            </div>
            <div class="history-tabs">
              <button class="tab-btn active" data-filter="all">全部</button>
              <button class="tab-btn" data-filter="passed">通过</button>
              <button class="tab-btn" data-filter="failed">失败</button>
            </div>
            <div class="runs-list" id="runs"></div>
          </div>

          <!-- Run Detail -->
          <div class="card" id="detail-card">
            <div class="card-header">
              <div class="card-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                验收详情
              </div>
            </div>
            <div id="detail">
              <div class="empty-state" style="padding:40px 10px">
                <div class="empty-icon" style="width:44px;height:44px;font-size:18px">🔍</div>
                <div style="font-size:14px;font-weight:600;color:var(--text)">选择运行记录</div>
                <p class="sub" style="font-size:12px">选择左侧一次运行记录查看验收矩阵与 proof。</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>

  <!-- Workspace Management Modal -->
  <div id="workspace-modal" class="modal-overlay hidden">
    <div class="modal-dialog">
      <div class="modal-header">
        <div class="modal-title-group">
          <div class="modal-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            <span>工作区管理</span>
          </div>
          <div class="modal-subtitle">切换当前工作区、添加新本地项目或修改配置</div>
        </div>
        <button class="modal-close-btn" id="modal-close" title="关闭 (Esc)">&times;</button>
      </div>

      <div class="modal-tabs">
        <button class="modal-tab-btn active" data-tab="list" id="modal-tab-btn-list">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
          <span>工作区列表</span>
          <span class="badge-count" id="modal-ws-count">0</span>
        </button>
        <button class="modal-tab-btn" data-tab="add" id="modal-tab-btn-add">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          <span>添加工作区</span>
        </button>
        <button class="modal-tab-btn" data-tab="edit" id="modal-tab-btn-edit">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          <span>修改工作区配置</span>
        </button>
      </div>

      <div class="modal-body">
        <!-- Tab 1: Workspaces List & Switch -->
        <div id="tab-pane-list" class="tab-pane">
          <div class="modal-ws-search-bar">
            <input class="input" id="modal-ws-search" placeholder="搜索工作区名称、路径或 URL...">
            <button class="button sm" id="modal-refresh-ws" title="刷新列表">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
              刷新
            </button>
          </div>
          <div class="modal-ws-list" id="modal-ws-list"></div>
        </div>

        <!-- Tab 2: Add Workspace -->
        <div id="tab-pane-add" class="tab-pane hidden">
          <div class="stack" style="gap:16px">
            <div class="form-field">
              <div class="label">本地项目根目录绝对路径 <span style="color:var(--bad)">*</span></div>
              <input class="input" id="add-ws-path" placeholder="例如：/Users/username/projects/my-web-app">
              <div style="font-size:12px;color:var(--text-muted);margin-top:6px;line-height:1.4">
                请输入本地项目的根目录绝对路径。系统会自动读取或创建 <code>.auto-e2e.yaml</code> 配置文件与验收需求。
              </div>
            </div>
            <div class="row" style="justify-content:flex-end;margin-top:8px">
              <button class="button primary" id="btn-submit-add-ws">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                添加并进入工作区
              </button>
            </div>
          </div>
        </div>

        <!-- Tab 3: Edit Workspace Config -->
        <div id="tab-pane-edit" class="tab-pane hidden">
          <div class="stack" style="gap:14px">
            <div class="form-field">
              <div class="label">选择要修改的工作区</div>
              <select class="select" id="edit-ws-select"></select>
            </div>
            <div class="form-field">
              <div class="label">工作区路径 (只读)</div>
              <input class="input" id="edit-ws-path" readonly style="opacity:0.75;cursor:not-allowed;background:var(--panel-card)">
            </div>
            <div class="grid-2">
              <div class="form-field">
                <div class="label">项目名称 (project.name) <span style="color:var(--bad)">*</span></div>
                <input class="input" id="edit-ws-name" placeholder="my-app">
              </div>
              <div class="form-field">
                <div class="label">目标 URL (project.baseUrl) <span style="color:var(--bad)">*</span></div>
                <input class="input" id="edit-ws-url" placeholder="http://127.0.0.1:3000">
              </div>
            </div>
            <div class="grid-2">
              <div class="form-field">
                <div class="label">验收 Model (acceptance.model)</div>
                <input class="input" id="edit-ws-model" placeholder="claude-3-5-sonnet-latest">
              </div>
              <div class="form-field">
                <div class="label">验收 Profile (acceptance.profile)</div>
                <input class="input" id="edit-ws-profile" placeholder="auto-e2e">
              </div>
            </div>
            <div class="form-field">
              <label class="checkbox-label" style="margin-top:4px">
                <input type="checkbox" id="edit-ws-headed">
                <span>默认开启浏览器窗口 (Headed 模式)</span>
              </label>
            </div>
            <div class="row between" style="margin-top:10px;padding-top:14px;border-top:1px solid var(--border)">
              <div style="font-size:12px;color:var(--text-muted)">
                保存将直接更新该项目根目录的 <code>.auto-e2e.yaml</code>
              </div>
              <div class="row">
                <button class="button sm" id="btn-reload-ws-config">重新加载</button>
                <button class="button primary sm" id="btn-save-ws-config">保存工作区配置</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div id="toast"></div>

  <!-- Image Lightbox Modal -->
  <div id="lightbox" class="modal-overlay hidden">
    <div class="lightbox-content">
      <button class="modal-close-btn" id="lightbox-close" style="position:absolute;top:-16px;right:-16px;background:var(--panel-elevated);border:1px solid var(--border);border-radius:50%;color:#fff">&times;</button>
      <img id="lightbox-img" class="lightbox-img" alt="截图详情">
      <div id="lightbox-caption" style="font-size:13px;color:#fff;text-align:center;font-family:var(--font-mono)"></div>
    </div>
  </div>

  <script>
    const state = { workspaces: [], selected: null, config: null, specs: [], selectedSpec: null, runs: [], selectedRunId: null, filter: 'all', editingWorkspaceId: null, modalTab: 'list' };
    const el = (id) => document.getElementById(id);
    const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

    function toast(message, isError) {
      const node = el('toast');
      node.textContent = message;
      node.className = isError ? 'error' : 'success';
      node.style.display = 'flex';
      setTimeout(() => { node.style.display = 'none'; }, 3500);
    }

    async function api(url, options) {
      const response = await fetch(url, options);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '请求失败');
      return data;
    }

    function applyTheme(theme) {
      document.documentElement.dataset.theme = theme;
      localStorage.setItem('auto-e2e-theme', theme);
      el('theme').textContent = theme === 'dark' ? '切换为亮色' : '切换为暗色';
    }

    el('theme').onclick = () => {
      const current = document.documentElement.dataset.theme || 'dark';
      applyTheme(current === 'dark' ? 'light' : 'dark');
    };
    applyTheme(localStorage.getItem('auto-e2e-theme') || 'dark');

    // Modal tabs & open/close
    function openModal(tab = 'list', editWsId = null) {
      el('workspace-modal').classList.remove('hidden');
      switchModalTab(tab);
      if (tab === 'edit') {
        const targetId = editWsId || state.selected || (state.workspaces[0] ? state.workspaces[0].id : null);
        if (targetId) {
          el('edit-ws-select').value = targetId;
          loadWorkspaceConfigForEdit(targetId);
        }
      }
    }

    function closeModal() {
      el('workspace-modal').classList.add('hidden');
    }

    function switchModalTab(tabName) {
      state.modalTab = tabName;
      document.querySelectorAll('.modal-tab-btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.tab === tabName);
      });
      el('tab-pane-list').classList.toggle('hidden', tabName !== 'list');
      el('tab-pane-add').classList.toggle('hidden', tabName !== 'add');
      el('tab-pane-edit').classList.toggle('hidden', tabName !== 'edit');

      if (tabName === 'list') {
        renderModalWorkspaceList();
      } else if (tabName === 'edit') {
        const targetId = el('edit-ws-select').value || state.selected || (state.workspaces[0] ? state.workspaces[0].id : null);
        if (targetId) {
          el('edit-ws-select').value = targetId;
          loadWorkspaceConfigForEdit(targetId);
        }
      }
    }

    document.querySelectorAll('.modal-tab-btn').forEach((btn) => {
      btn.onclick = () => switchModalTab(btn.dataset.tab);
    });

    el('modal-close').onclick = closeModal;
    el('workspace-modal').onclick = (e) => {
      if (e.target === el('workspace-modal')) closeModal();
    };

    el('open-workspace-modal').onclick = () => openModal('list');
    el('btn-header-manage-ws').onclick = () => openModal('list');
    el('btn-empty-open-modal').onclick = () => openModal(state.workspaces.length ? 'list' : 'add');

    async function loadWorkspaces() {
      const data = await api('/api/workspaces');
      state.workspaces = data.workspaces;
      el('modal-ws-count').textContent = String(data.workspaces.length);

      // Populate edit select dropdown
      const editSelect = el('edit-ws-select');
      editSelect.replaceChildren();
      data.workspaces.forEach((w) => {
        const opt = document.createElement('option');
        opt.value = w.id;
        opt.textContent = w.name + ' (' + w.path + ')';
        editSelect.appendChild(opt);
      });

      renderModalWorkspaceList();

      if (state.selected && !data.workspaces.some((item) => item.id === state.selected)) {
        state.selected = null;
        localStorage.removeItem('auto-e2e-workspace');
      }

      if (!state.selected) {
        const saved = localStorage.getItem('auto-e2e-workspace');
        if (saved && data.workspaces.some((item) => item.id === saved)) {
          await selectWorkspace(saved);
        } else if (data.workspaces.length > 0) {
          await selectWorkspace(data.workspaces[0].id);
        } else {
          showEmpty();
        }
      }
    }

    function renderModalWorkspaceList() {
      const list = el('modal-ws-list');
      list.replaceChildren();
      const searchQuery = (el('modal-ws-search')?.value || '').trim().toLowerCase();

      const filtered = state.workspaces.filter((w) => {
        if (!searchQuery) return true;
        return (w.name && w.name.toLowerCase().includes(searchQuery)) ||
               (w.path && w.path.toLowerCase().includes(searchQuery)) ||
               (w.targetUrl && w.targetUrl.toLowerCase().includes(searchQuery));
      });

      if (!filtered.length) {
        if (state.workspaces.length === 0) {
          list.innerHTML = '<div class="empty-state" style="padding:32px 10px">' +
            '<div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:6px">暂无已注册工作区</div>' +
            '<p style="font-size:12px;margin-bottom:12px">点击上方“添加工作区”标签页添加本地项目根路径。</p>' +
            '<button class="button primary sm" onclick="switchModalTab(\\'add\\')">+ 立即添加工作区</button>' +
            '</div>';
        } else {
          list.innerHTML = '<div class="empty-state" style="padding:24px 8px"><div style="font-size:12px;color:var(--text-muted)">没有匹配搜索的工作区</div></div>';
        }
        return;
      }

      filtered.forEach((workspace) => {
        const node = document.createElement('div');
        const isSelected = state.selected === workspace.id;
        const hasError = Boolean(workspace.configError);
        node.className = 'modal-ws-item' + (isSelected ? ' active' : '') + (hasError ? ' error' : '');

        const statusTag = isSelected ? '<span class="status-badge passed" style="font-size:10px;padding:2px 6px">当前使用</span>' : '';
        const urlDisplay = workspace.targetUrl || workspace.configError || '未配置目标 URL';

        node.innerHTML = '<div class="modal-ws-item-info">' +
          '<div class="modal-ws-item-title">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>' +
          esc(workspace.name) + statusTag +
          '</div>' +
          '<div class="modal-ws-item-url">' + esc(urlDisplay) + '</div>' +
          '<div class="modal-ws-item-path">' + esc(workspace.path) + '</div>' +
          '</div>' +
          '<div class="modal-ws-item-actions">' +
          (!isSelected ? '<button class="button sm primary btn-switch" title="切换到此工作区">切换</button>' : '') +
          '<button class="button sm btn-edit" title="修改此工作区配置">修改</button>' +
          '<button class="button sm danger btn-remove" title="移除工作区">移除</button>' +
          '</div>';

        const switchBtn = node.querySelector('.btn-switch');
        if (switchBtn) {
          switchBtn.onclick = async (e) => {
            e.stopPropagation();
            await selectWorkspace(workspace.id);
            closeModal();
            toast('已切换到工作区：' + workspace.name);
          };
        }

        const editBtn = node.querySelector('.btn-edit');
        if (editBtn) {
          editBtn.onclick = (e) => {
            e.stopPropagation();
            switchModalTab('edit');
            el('edit-ws-select').value = workspace.id;
            loadWorkspaceConfigForEdit(workspace.id);
          };
        }

        const removeBtn = node.querySelector('.btn-remove');
        if (removeBtn) {
          removeBtn.onclick = async (e) => {
            e.stopPropagation();
            await removeWorkspaceById(workspace.id, workspace.name);
          };
        }

        node.onclick = async () => {
          if (!isSelected) {
            await selectWorkspace(workspace.id);
            closeModal();
            toast('已切换到工作区：' + workspace.name);
          }
        };

        list.appendChild(node);
      });
    }

    el('modal-ws-search').oninput = renderModalWorkspaceList;
    el('modal-refresh-ws').onclick = async () => {
      await loadWorkspaces();
      toast('工作区列表已刷新');
    };

    function showEmpty() {
      el('empty').classList.remove('hidden');
      el('workspace-view').classList.add('hidden');
      el('header-ws-name').textContent = '未选择工作区';
      el('header-ws-path').textContent = '点击选择或添加';
      el('header-ws-url').textContent = '';
      el('header-ws-url-link').href = '#';
      el('header-ws-url-link').setAttribute('aria-disabled', 'true');
    }

    async function selectWorkspace(id) {
      state.selected = id;
      localStorage.setItem('auto-e2e-workspace', id);
      el('empty').classList.add('hidden');
      el('workspace-view').classList.remove('hidden');

      const data = await api('/api/workspaces/' + encodeURIComponent(id));
      state.config = data.config;

      // Update header picker
      el('header-ws-name').textContent = data.workspace.name;
      el('header-ws-path').textContent = data.workspace.path;
      el('header-ws-url').textContent = data.config.project.baseUrl;
      const urlLink = el('header-ws-url-link');
      urlLink.href = data.config.project.baseUrl;
      urlLink.setAttribute('aria-disabled', 'false');

      el('run-url').value = data.config.project.baseUrl;
      el('run-profile').value = data.config.acceptance.profile;
      el('run-model').value = data.config.acceptance.model;
      el('run-headed').checked = data.config.acceptance.headed;

      await Promise.all([loadSpecs(), loadRuns()]);
      renderModalWorkspaceList();
    }

    async function loadWorkspaceConfigForEdit(id) {
      state.editingWorkspaceId = id;
      try {
        const data = await api('/api/workspaces/' + encodeURIComponent(id));
        const conf = data.config;
        el('edit-ws-path').value = data.workspace.path;
        el('edit-ws-name').value = conf.project.name || '';
        el('edit-ws-url').value = conf.project.baseUrl || '';
        el('edit-ws-model').value = conf.acceptance.model || '';
        el('edit-ws-profile').value = conf.acceptance.profile || '';
        el('edit-ws-headed').checked = Boolean(conf.acceptance.headed);
      } catch (error) {
        toast('加载配置失败：' + error.message, true);
      }
    }

    el('edit-ws-select').onchange = (e) => {
      loadWorkspaceConfigForEdit(e.target.value);
    };

    el('btn-reload-ws-config').onclick = () => {
      const targetId = el('edit-ws-select').value;
      if (targetId) loadWorkspaceConfigForEdit(targetId);
    };

    el('btn-save-ws-config').onclick = async () => {
      const targetId = el('edit-ws-select').value;
      if (!targetId) { toast('请选择工作区', true); return; }

      const name = el('edit-ws-name').value.trim();
      const baseUrl = el('edit-ws-url').value.trim();
      const model = el('edit-ws-model').value.trim() || undefined;
      const profile = el('edit-ws-profile').value.trim() || undefined;
      const headed = el('edit-ws-headed').checked;

      if (!name) { toast('项目名称不能为空', true); return; }
      if (!baseUrl) { toast('目标 URL 不能为空', true); return; }

      try {
        new URL(baseUrl);
      } catch {
        toast('目标 URL 格式不正确（例如 http://127.0.0.1:3000）', true);
        return;
      }

      try {
        const currentData = await api('/api/workspaces/' + encodeURIComponent(targetId));
        const updatedConfig = {
          ...currentData.config,
          project: {
            ...currentData.config.project,
            name,
            baseUrl,
          },
          acceptance: {
            ...currentData.config.acceptance,
            model: model || currentData.config.acceptance.model,
            profile: profile || currentData.config.acceptance.profile,
            headed,
          }
        };

        await api('/api/workspaces/' + encodeURIComponent(targetId) + '/config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config: updatedConfig })
        });

        toast('工作区配置已保存');
        await loadWorkspaces();
        if (state.selected === targetId) {
          await selectWorkspace(targetId);
        }
      } catch (error) {
        toast('保存配置失败：' + error.message, true);
      }
    };

    el('btn-submit-add-ws').onclick = async () => {
      const pathValue = el('add-ws-path').value.trim();
      if (!pathValue) { toast('请输入工作区绝对路径', true); return; }
      try {
        const data = await api('/api/workspaces', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: pathValue })
        });
        el('add-ws-path').value = '';
        await loadWorkspaces();
        await selectWorkspace(data.workspace.id);
        closeModal();
        toast('工作区添加成功并已切换');
      } catch (error) {
        toast(error.message, true);
      }
    };

    async function removeWorkspaceById(id, name) {
      if (!confirm('确认从 auto-e2e 移除工作区「' + name + '」？（不会删除本地实际代码文件）')) return;
      try {
        await api('/api/workspaces/' + encodeURIComponent(id), { method: 'DELETE' });
        if (state.selected === id) {
          state.selected = null;
          localStorage.removeItem('auto-e2e-workspace');
        }
        await loadWorkspaces();
        toast('工作区已移除');
      } catch (error) {
        toast(error.message, true);
      }
    }

    function defaultSpec() {
      return {
        taskId: 'CASE-01',
        title: '示例验收用例',
        requirement: '描述期望的功能行为',
        acceptanceCriteria: ['用户可以成功完成操作', '页面展示预期结果']
      };
    }

    async function loadSpecs(preferredFile) {
      const data = await api('/api/workspaces/' + encodeURIComponent(state.selected) + '/task-specs');
      state.specs = data.specs || [];
      el('spec-count').textContent = state.specs.length + ' 个文件';
      el('run-spec-count').textContent = (state.specs.length || 1) + ' 个用例';
      const available = state.specs.map((item) => item.fileName);
      state.selectedSpec = preferredFile && available.includes(preferredFile)
        ? preferredFile
        : state.selectedSpec && available.includes(state.selectedSpec)
          ? state.selectedSpec
          : available[0] || 'example.spec.json';
      const select = el('spec-file');
      select.replaceChildren();
      if (!state.specs.length) {
        const option = document.createElement('option');
        option.value = state.selectedSpec;
        option.textContent = state.selectedSpec + '（新文件）';
        select.appendChild(option);
      } else {
        state.specs.forEach((item) => {
          const option = document.createElement('option');
          option.value = item.fileName;
          option.textContent = item.fileName + ' · ' + item.title + (item.error ? '（格式有误）' : '');
          select.appendChild(option);
        });
      }
      select.value = state.selectedSpec;
      await loadSelectedSpec();
    }

    async function loadSelectedSpec() {
      const existing = state.specs.some((item) => item.fileName === state.selectedSpec);
      const value = existing
        ? (await api('/api/workspaces/' + encodeURIComponent(state.selected) + '/task-specs/' + encodeURIComponent(state.selectedSpec))).spec
        : defaultSpec();
      el('spec-path').textContent = '.auto-e2e/specs/' + state.selectedSpec;
      el('task-spec').value = JSON.stringify(value, null, 2);
      el('delete-spec').disabled = !existing;
    }

    function formatSpecJson() {
      try {
        const spec = JSON.parse(el('task-spec').value);
        el('task-spec').value = JSON.stringify(spec, null, 2);
        toast('JSON 格式化完成');
      } catch (error) {
        toast('JSON 格式错误：' + error.message, true);
      }
    }

    async function saveSpec() {
      let spec;
      try {
        spec = JSON.parse(el('task-spec').value);
      } catch (error) {
        toast('JSON 格式错误：' + error.message, true);
        return false;
      }
      try {
        await api('/api/workspaces/' + encodeURIComponent(state.selected) + '/task-specs/' + encodeURIComponent(state.selectedSpec), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ spec })
        });
        await loadSpecs(state.selectedSpec);
        toast('验收用例已保存：' + state.selectedSpec);
        return true;
      } catch (error) {
        toast('保存失败：' + error.message, true);
        return false;
      }
    }

    async function createSpec() {
      let fileName = prompt('输入用例文件名（建议使用英文短横线命名）', 'new-case.spec.json');
      if (!fileName) return;
      fileName = fileName.trim();
      if (!fileName.endsWith('.spec.json')) fileName += '.spec.json';
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\.spec\.json$/.test(fileName)) {
        toast('文件名必须匹配 *.spec.json，且不能包含目录', true);
        return;
      }
      if (state.specs.some((item) => item.fileName === fileName)) {
        state.selectedSpec = fileName;
        await loadSpecs(fileName);
        toast('该用例文件已存在', true);
        return;
      }
      state.selectedSpec = fileName;
      el('spec-count').textContent = (state.specs.length + 1) + ' 个文件（含未保存）';
      el('run-spec-count').textContent = (state.specs.length + 1) + ' 个用例';
      el('spec-path').textContent = '.auto-e2e/specs/' + fileName;
      el('task-spec').value = JSON.stringify(defaultSpec(), null, 2);
      el('delete-spec').disabled = true;
      const select = el('spec-file');
      const option = document.createElement('option');
      option.value = fileName;
      option.textContent = fileName + '（新文件）';
      select.appendChild(option);
      select.value = fileName;
    }

    async function deleteSpec() {
      if (!state.selectedSpec || !state.specs.some((item) => item.fileName === state.selectedSpec)) return;
      if (!confirm('确认删除验收用例文件「' + state.selectedSpec + '」？')) return;
      try {
        await api('/api/workspaces/' + encodeURIComponent(state.selected) + '/task-specs/' + encodeURIComponent(state.selectedSpec), { method: 'DELETE' });
        state.selectedSpec = null;
        await loadSpecs();
        toast('验收用例文件已删除');
      } catch (error) {
        toast('删除失败：' + error.message, true);
      }
    }

    // Textarea Tab Indentation Support
    el('task-spec').addEventListener('keydown', function(e) {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = this.selectionStart;
        const end = this.selectionEnd;
        this.value = this.value.substring(0, start) + '  ' + this.value.substring(end);
        this.selectionStart = this.selectionEnd = start + 2;
      }
    });

    async function loadRuns() {
      const data = await api('/api/workspaces/' + encodeURIComponent(state.selected) + '/runs');
      state.runs = data.runs || [];
      renderRunsList();
    }

    function renderRunsList() {
      const list = el('runs');
      list.replaceChildren();

      const filtered = state.runs.filter((run) => {
        if (state.filter === 'all') return true;
        return run.status === state.filter;
      });

      if (!filtered.length) {
        list.innerHTML = '<div class="empty-state" style="padding:32px 10px"><div style="font-size:13px;color:var(--text-muted)">暂无匹配的运行记录</div></div>';
        return;
      }

      filtered.forEach((run) => {
        const node = document.createElement('div');
        const isSelected = state.selectedRunId === run.runId;
        node.className = 'run-item' + (isSelected ? ' active' : '');

        const formattedTime = run.startedAt ? new Date(run.startedAt).toLocaleString('zh-CN', { hour12: false }) : '';
        const durationSec = typeof run.durationMs === 'number' ? (run.durationMs / 1000).toFixed(1) + 's' : '';
        const criteriaPassed = run.passedCriteriaCount || 0;
        const criteriaTotal = run.criteriaCount || 0;
        const caseStats = run.caseCount > 1 ? run.passedCaseCount + '/' + run.caseCount + ' 用例' : '';

        node.innerHTML = '<div class="run-item-top">' +
          '<div class="run-item-title">' + esc(run.source?.title || run.requirement || run.runId) + '</div>' +
          '<span class="status-badge ' + esc(run.status) + '">' + esc(run.status) + '</span>' +
          '</div>' +
          '<div class="run-item-bottom">' +
          '<span>' + esc(formattedTime) + '</span>' +
          '<div class="run-item-stats">' +
          (caseStats ? '<span>' + esc(caseStats) + '</span>' : '') +
          (criteriaTotal ? '<span>' + criteriaPassed + '/' + criteriaTotal + ' AC</span>' : '') +
          (durationSec ? '<span>' + durationSec + '</span>' : '') +
          '</div>' +
          '</div>';

        node.onclick = () => {
          state.selectedRunId = run.runId;
          renderRunsList();
          loadRun(run.runId);
        };
        list.appendChild(node);
      });
    }

    async function loadRun(runId) {
      state.selectedRunId = runId;
      const data = await api('/api/workspaces/' + encodeURIComponent(state.selected) + '/runs/' + encodeURIComponent(runId));
      const run = data.run;
      const detailContainer = el('detail');

      function renderCriteria(items) {
        return (items || []).map((item) => {
        let proofHtml = '';
        if (item.proof) {
          const marker = '.auto-e2e/artifacts/';
          const index = item.proof.indexOf(marker);
          const artifactPath = index >= 0 ? item.proof.slice(index + marker.length) : item.proof;
          const imgSrc = '/api/workspaces/' + encodeURIComponent(state.selected) + '/artifacts/' + encodeURI(artifactPath);
          proofHtml = '<div style="margin-top:6px">' +
            '<div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">截图证据 (点击放大)：</div>' +
            '<img class="criterion-proof-img" alt="AC Proof" src="' + imgSrc + '" onclick="openLightbox(\\'' + esc(imgSrc) + '\\', \\'' + esc(item.id + ': ' + item.description) + '\\')">' +
            '</div>';
        }
        return '<div class="criterion-card ' + esc(item.status) + '">' +
          '<div class="criterion-card-header">' +
          '<span class="criterion-id-tag">' + esc(item.id) + '</span>' +
          '<span class="status-badge ' + esc(item.status) + '">' + esc(item.status) + '</span>' +
          '</div>' +
          '<div class="criterion-desc">' + esc(item.description) + '</div>' +
          '<div class="criterion-actual"><strong>实际结果：</strong>' + esc(item.actual) + '</div>' +
          proofHtml +
          '</div>';
        }).join('');
      }

      const runCases = run.schemaVersion === 2 ? run.cases : [{
        caseId: null,
        source: run.source,
        status: run.status,
        summary: run.summary,
        criteria: run.criteria
      }];
      const casesHtml = runCases.map((testCase) => {
        const caseHeader = run.schemaVersion === 2
          ? '<div class="row between" style="padding:10px 0 4px"><div><div style="font-size:14px;font-weight:700">' + esc(testCase.caseId + ' · ' + testCase.source.title) + '</div><div class="sub" style="font-size:12px;margin-top:3px">' + esc(testCase.summary) + '</div></div><span class="status-badge ' + esc(testCase.status) + '">' + esc(testCase.status) + '</span></div>'
          : '';
        return '<div class="stack" style="gap:8px">' + caseHeader + '<div class="criteria-list">' + renderCriteria(testCase.criteria) + '</div></div>';
      }).join('');

      const durationSec = typeof run.durationMs === 'number' ? (run.durationMs / 1000).toFixed(2) + 's' : '-';
      const formattedDate = run.startedAt ? new Date(run.startedAt).toLocaleString('zh-CN', { hour12: false }) : '-';

      detailContainer.innerHTML = '<div class="detail-view">' +
        '<div class="detail-header-card">' +
        '<div class="row between">' +
        '<h2 style="font-size:16px;font-weight:700">' + esc(run.source?.title || '验收详情') + '</h2>' +
        '<span class="status-badge ' + esc(run.status) + '" style="font-size:12px;padding:4px 12px">' + esc(run.status) + '</span>' +
        '</div>' +
        '<div class="detail-summary">' + esc(run.summary || '无摘要') + '</div>' +
        '<div class="detail-meta-grid">' +
        '<div class="detail-meta-item"><span>运行 ID:</span> <strong>' + esc(run.runId) + '</strong></div>' +
        '<div class="detail-meta-item"><span>Commit:</span> <strong>' + esc(run.commit || '无') + '</strong></div>' +
        '<div class="detail-meta-item"><span>耗时:</span> <strong>' + esc(durationSec) + '</strong></div>' +
        '<div class="detail-meta-item"><span>步骤:</span> <strong>' + esc(run.steps ?? '-') + '</strong></div>' +
        '<div class="detail-meta-item"><span>开始时间:</span> <strong>' + esc(formattedDate) + '</strong></div>' +
        '</div>' +
        '</div>' +
        (run.source?.content ? '<div class="stack"><div class="label">需求背景</div><pre style="font-family:var(--font-mono);font-size:12px;background:var(--panel-elevated);padding:12px;border-radius:var(--radius-md);border:1px solid var(--border);white-space:pre-wrap">' + esc(run.source.content) + '</pre></div>' : '') +
        (run.error ? '<div class="stack"><div class="label" style="color:var(--bad)">异常信息</div><pre style="font-family:var(--font-mono);font-size:12px;background:var(--bad-bg);color:var(--bad);padding:12px;border-radius:var(--radius-md);border:1px solid var(--bad-border);white-space:pre-wrap">' + esc(run.error) + '</pre></div>' : '') +
        '<div class="stack"><div class="label">' + (run.schemaVersion === 2 ? '用例与验收标准报告' : '验收标准矩阵 (AC Matrix)') + '</div>' +
        casesHtml +
        '</div>' +
        '</div>';
    }

    function openLightbox(src, caption) {
      el('lightbox-img').src = src;
      el('lightbox-caption').textContent = caption;
      el('lightbox').classList.remove('hidden');
    }
    el('lightbox-close').onclick = () => el('lightbox').classList.add('hidden');
    el('lightbox').onclick = (e) => { if (e.target === el('lightbox')) el('lightbox').classList.add('hidden'); };

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        el('lightbox').classList.add('hidden');
        closeModal();
      }
    });

    async function runAcceptance() {
      if (!await saveSpec()) return;
      const runButton = el('run-acceptance');
      const output = el('run-output');
      runButton.disabled = true;
      runButton.innerHTML = '<span class="status-dot-pulse" style="background:#fff"></span> 正在运行 ' + state.specs.length + ' 个用例...';
      output.textContent = 'BetterWright 正在按文件名顺序执行全部用例，请稍候...';

      try {
        const data = await api('/api/workspaces/' + encodeURIComponent(state.selected) + '/runs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: el('run-url').value,
            profile: el('run-profile').value,
            model: el('run-model').value,
            headed: el('run-headed').checked,
            fresh: el('run-fresh').checked
          })
        });
        output.textContent = JSON.stringify(data.run, null, 2);
        await loadRuns();
        await loadRun(data.run.runId);
        toast('验收完成：' + data.run.status, data.run.status !== 'passed');
      } catch (error) {
        output.textContent = '执行失败：\\n' + error.message;
        toast(error.message, true);
      } finally {
        runButton.disabled = false;
        runButton.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> 运行全部用例';
      }
    }

    // Filter tabs
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.onclick = () => {
        document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.filter = btn.dataset.filter;
        renderRunsList();
      };
    });

    el('copy-output').onclick = () => {
      navigator.clipboard.writeText(el('run-output').textContent).then(() => toast('控制台输出已复制')).catch(() => {});
    };

    el('format-spec').onclick = formatSpecJson;
    el('reload-spec').onclick = loadSelectedSpec;
    el('save-spec').onclick = saveSpec;
    el('new-spec').onclick = createSpec;
    el('delete-spec').onclick = deleteSpec;
    el('spec-file').onchange = async (event) => {
      state.selectedSpec = event.target.value;
      await loadSelectedSpec();
    };
    el('refresh-runs').onclick = loadRuns;
    el('run-acceptance').onclick = runAcceptance;

    loadWorkspaces().catch((error) => toast(error.message, true));
  </script>
</body>
</html>`;
}
