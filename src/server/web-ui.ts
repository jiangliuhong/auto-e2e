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
      position: sticky;
      top: 0;
      z-index: 20;
      backdrop-filter: blur(8px);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
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
      font-size: 17px;
      font-weight: 700;
      letter-spacing: -0.02em;
      display: flex;
      align-items: center;
      gap: 8px;
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
      font-size: 12px;
      color: var(--text-muted);
    }
    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
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

    /* Layout */
    .layout {
      display: grid;
      grid-template-columns: 320px 1fr;
      flex: 1;
      min-height: calc(100vh - 64px);
    }

    /* Aside */
    aside {
      padding: 20px 16px;
      border-right: 1px solid var(--border);
      background: var(--panel);
      display: flex;
      flex-direction: column;
      gap: 16px;
      overflow-y: auto;
    }
    .sidebar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .sidebar-title {
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      gap: 8px;
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
    .workspace-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      overflow-y: auto;
      flex: 1;
    }
    .workspace-item {
      padding: 12px 14px;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: var(--panel-card);
      cursor: pointer;
      transition: all 0.15s ease;
      position: relative;
    }
    .workspace-item:hover {
      background: var(--hover);
      border-color: var(--border-subtle);
      transform: translateY(-1px);
    }
    .workspace-item.active {
      background: var(--accent-light);
      border-color: var(--accent);
      box-shadow: 0 0 0 1px var(--accent-border);
    }
    .workspace-item-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .workspace-item-name {
      font-weight: 600;
      font-size: 14px;
      color: var(--text);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .workspace-item.active .workspace-item-name {
      color: var(--accent);
    }
    .workspace-item-url {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 4px;
      word-break: break-all;
    }
    .workspace-item.error .workspace-item-url {
      color: var(--bad);
    }
    .workspace-item-path {
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 6px;
      word-break: break-all;
      line-height: 1.3;
    }
    .add-workspace-box {
      border-top: 1px solid var(--border);
      padding-top: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    /* Main Area */
    main {
      padding: 24px 32px;
      max-width: 1400px;
      width: 100%;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 20px;
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

    /* Workspace Top Banner */
    .workspace-banner {
      background: var(--panel-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      box-shadow: var(--shadow-sm);
    }
    .workspace-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .workspace-header-title {
      font-size: 18px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .workspace-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 12px;
      color: var(--text-muted);
      flex-wrap: wrap;
    }
    .meta-tag {
      font-family: var(--font-mono);
      background: var(--panel-elevated);
      padding: 2px 8px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border);
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

    /* Lightbox Modal */
    .modal-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      padding: 24px;
      animation: fade-in 0.15s ease;
    }
    .modal-content {
      max-width: 90vw;
      max-height: 90vh;
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }
    .modal-img {
      max-width: 100%;
      max-height: 80vh;
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-lg);
      border: 1px solid var(--border);
    }
    .modal-close {
      position: absolute;
      top: -16px;
      right: -16px;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--panel-elevated);
      border: 1px solid var(--border);
      color: var(--text);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 18px;
      box-shadow: var(--shadow-md);
    }
    .modal-close:hover {
      background: var(--hover);
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
      max-width: 440px;
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
      .layout { grid-template-columns: 1fr; }
      aside { border-right: none; border-bottom: 1px solid var(--border); }
      .grid-2, .grid-1-2 { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <div class="logo-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
      </div>
      <div>
        <h1>auto-e2e <span class="version-pill">v0.3.0</span></h1>
        <div class="sub">BetterWright 验收工作区</div>
      </div>
    </div>
    <div class="header-actions">
      <div class="server-status">
        <span class="status-dot-pulse"></span>
        <span>本地服务运行中</span>
      </div>
      <button class="button" id="theme" title="切换显示主题">切换为亮色</button>
    </div>
  </header>

  <div class="layout">
    <aside>
      <div class="sidebar-header">
        <div class="sidebar-title">
          <span>工作区</span>
          <span class="badge-count" id="workspace-count">0</span>
        </div>
        <button class="button icon-only sm" id="refresh" title="刷新工作区列表">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
        </button>
      </div>

      <div class="workspace-list" id="workspace-list"></div>

      <div class="add-workspace-box">
        <div class="label">添加本地项目</div>
        <input class="input" id="workspace-path" placeholder="输入本地项目绝对路径 (/path/to/project)">
        <button class="button primary" id="add-workspace">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          添加工作区
        </button>
      </div>
    </aside>

    <main>
      <div id="empty" class="empty-state">
        <div class="empty-icon">📁</div>
        <h2>还没有选择工作区</h2>
        <p>从左侧添加或选择一个本地项目。已删除的路径会自动从列表清理。</p>
      </div>

      <div id="workspace-view" class="hidden stack">
        <!-- Workspace Banner -->
        <div class="workspace-banner">
          <div class="workspace-info">
            <div class="workspace-header-title">
              <span id="workspace-name">项目名称</span>
            </div>
            <div class="workspace-meta">
              <span class="meta-tag" id="workspace-meta">/path · http://...</span>
              <a id="workspace-url-link" href="#" target="_blank" class="row sm" style="font-size:12px;gap:4px">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                打开被测网站
              </a>
            </div>
          </div>
          <button class="button danger" id="remove-workspace" title="从工作区列表移除">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            移除工作区
          </button>
        </div>

        <!-- Top Grid: Task Spec & Run Config -->
        <div class="grid-2">
          <!-- Task Spec Editor -->
          <div class="card">
            <div class="card-header">
              <div class="card-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                验收需求
                <span class="meta-tag" style="font-weight:normal;font-size:11px">.auto-e2e/task-spec.json</span>
              </div>
              <div class="row">
                <button class="button sm" id="format-spec" title="格式化 JSON 内容">格式化</button>
                <button class="button sm" id="reload-spec" title="重新从磁盘读取">重新加载</button>
                <button class="button primary sm" id="save-spec">保存需求</button>
              </div>
            </div>
            <textarea class="textarea" id="task-spec" spellcheck="false" placeholder="{\n  &quot;title&quot;: &quot;...&quot;,\n  &quot;requirement&quot;: &quot;...&quot;,\n  &quot;acceptanceCriteria&quot;: [&quot;...&quot;]\n}"></textarea>
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
                开始 BetterWright 验收
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

  <div id="toast"></div>

  <!-- Image Lightbox Modal -->
  <div id="lightbox" class="modal-overlay hidden">
    <div class="modal-content">
      <button class="modal-close" id="lightbox-close">&times;</button>
      <img id="lightbox-img" class="modal-img" alt="截图详情">
      <div id="lightbox-caption" style="font-size:13px;color:#fff;text-align:center;font-family:var(--font-mono)"></div>
    </div>
  </div>

  <script>
    const state = { workspaces: [], selected: null, config: null, runs: [], selectedRunId: null, filter: 'all' };
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

    async function loadWorkspaces() {
      const data = await api('/api/workspaces');
      state.workspaces = data.workspaces;
      el('workspace-count').textContent = String(data.workspaces.length);
      const list = el('workspace-list');
      list.replaceChildren();

      if (!data.workspaces.length) {
        list.innerHTML = '<div class="empty-state" style="padding:24px 8px"><div style="font-size:12px;color:var(--text-muted)">暂无已注册工作区</div></div>';
      } else {
        data.workspaces.forEach((workspace) => {
          const node = document.createElement('div');
          const isSelected = state.selected === workspace.id;
          const hasError = Boolean(workspace.configError);
          node.className = 'workspace-item' + (isSelected ? ' active' : '') + (hasError ? ' error' : '');
          node.innerHTML = '<div class="workspace-item-header"><div class="workspace-item-name"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>' + esc(workspace.name) + '</div></div>' +
            '<div class="workspace-item-url">' + esc(workspace.targetUrl || workspace.configError || '未配置目标 URL') + '</div>' +
            '<div class="workspace-item-path">' + esc(workspace.path) + '</div>';
          node.onclick = () => selectWorkspace(workspace.id);
          list.appendChild(node);
        });
      }

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

    function showEmpty() {
      el('empty').classList.remove('hidden');
      el('workspace-view').classList.add('hidden');
    }

    async function selectWorkspace(id) {
      state.selected = id;
      localStorage.setItem('auto-e2e-workspace', id);
      el('empty').classList.add('hidden');
      el('workspace-view').classList.remove('hidden');

      const data = await api('/api/workspaces/' + encodeURIComponent(id));
      state.config = data.config;
      el('workspace-name').textContent = data.workspace.name;
      el('workspace-meta').textContent = data.workspace.path + ' · ' + data.config.project.baseUrl;
      const urlLink = el('workspace-url-link');
      urlLink.href = data.config.project.baseUrl;

      el('run-url').value = data.config.project.baseUrl;
      el('run-profile').value = data.config.acceptance.profile;
      el('run-model').value = data.config.acceptance.model;
      el('run-headed').checked = data.config.acceptance.headed;

      await Promise.all([loadSpec(), loadRuns()]);
      await loadWorkspaces();
    }

    async function loadSpec() {
      const data = await api('/api/workspaces/' + encodeURIComponent(state.selected) + '/task-spec');
      const value = data.spec || {
        title: '示例验收需求',
        requirement: '描述期望的功能行为',
        acceptanceCriteria: ['用户可以成功完成操作', '页面展示预期结果']
      };
      el('task-spec').value = JSON.stringify(value, null, 2);
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
        await api('/api/workspaces/' + encodeURIComponent(state.selected) + '/task-spec', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ spec })
        });
        toast('验收需求已保存');
        return true;
      } catch (error) {
        toast('保存失败：' + error.message, true);
        return false;
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
        const criteriaPassed = run.criteria ? run.criteria.filter((c) => c.status === 'passed').length : 0;
        const criteriaTotal = run.criteria ? run.criteria.length : 0;

        node.innerHTML = '<div class="run-item-top">' +
          '<div class="run-item-title">' + esc(run.source?.title || run.requirement || run.runId) + '</div>' +
          '<span class="status-badge ' + esc(run.status) + '">' + esc(run.status) + '</span>' +
          '</div>' +
          '<div class="run-item-bottom">' +
          '<span>' + esc(formattedTime) + '</span>' +
          '<div class="run-item-stats">' +
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

      const criteriaHtml = (run.criteria || []).map((item) => {
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
        '<div class="stack"><div class="label">验收标准矩阵 (AC Matrix)</div>' +
        '<div class="criteria-list">' + criteriaHtml + '</div>' +
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
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') el('lightbox').classList.add('hidden'); });

    async function runAcceptance() {
      if (!await saveSpec()) return;
      const runButton = el('run-acceptance');
      const output = el('run-output');
      runButton.disabled = true;
      runButton.innerHTML = '<span class="status-dot-pulse" style="background:#fff"></span> BetterWright 验收执行中...';
      output.textContent = 'BetterWright 正在执行，请稍候...';

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
        runButton.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> 开始 BetterWright 验收';
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

    el('add-workspace').onclick = async () => {
      const pathValue = el('workspace-path').value.trim();
      if (!pathValue) { toast('请输入工作区绝对路径', true); return; }
      try {
        const data = await api('/api/workspaces', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: pathValue })
        });
        el('workspace-path').value = '';
        await loadWorkspaces();
        await selectWorkspace(data.workspace.id);
        toast('工作区已添加');
      } catch (error) {
        toast(error.message, true);
      }
    };

    el('remove-workspace').onclick = async () => {
      if (!state.selected) return;
      if (!confirm('确认从 auto-e2e 移除此工作区？（不会删除本地实际代码文件）')) return;
      try {
        await api('/api/workspaces/' + encodeURIComponent(state.selected), { method: 'DELETE' });
        state.selected = null;
        localStorage.removeItem('auto-e2e-workspace');
        await loadWorkspaces();
        toast('工作区已移除');
      } catch (error) {
        toast(error.message, true);
      }
    };

    el('refresh').onclick = loadWorkspaces;
    el('format-spec').onclick = formatSpecJson;
    el('reload-spec').onclick = loadSpec;
    el('save-spec').onclick = saveSpec;
    el('refresh-runs').onclick = loadRuns;
    el('run-acceptance').onclick = runAcceptance;

    loadWorkspaces().catch((error) => toast(error.message, true));
  </script>
</body>
</html>`;
}
