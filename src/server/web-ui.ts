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
    html, body { height: 100%; overflow: hidden; }
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
      flex-shrink: 0;
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
      align-items: stretch;
      width: 100%;
      min-height: 0;
      overflow: hidden;
    }
    .sidebar {
      width: 224px;
      flex-shrink: 0;
      padding: 22px 14px;
      border-right: 1px solid var(--border);
      background: var(--panel);
      display: flex;
      flex-direction: column;
      gap: 18px;
      height: 100%;
      overflow-y: auto;
      overscroll-behavior: contain;
    }
    .sidebar-label {
      padding: 0 10px;
      color: var(--text-muted);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .sidebar-nav {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .nav-item {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 11px;
      border-radius: var(--radius-md);
      color: var(--text-secondary);
      font-size: 13px;
      font-weight: 550;
      text-align: left;
      transition: all 0.15s ease;
    }
    .nav-item:hover { background: var(--hover); color: var(--text); }
    .nav-item.active {
      color: var(--accent);
      background: var(--accent-light);
      box-shadow: inset 0 0 0 1px var(--accent-border);
    }
    .nav-item svg { flex-shrink: 0; }
    .sidebar-footer {
      margin-top: auto;
      padding: 12px 10px 0;
      border-top: 1px solid var(--border);
      color: var(--text-muted);
      font-size: 11px;
      line-height: 1.55;
    }
    main {
      padding: 24px 32px;
      max-width: 1480px;
      width: 100%;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 20px;
      flex: 1;
      min-width: 0;
      min-height: 0;
      height: 100%;
      overflow-y: auto;
      overscroll-behavior: contain;
    }

    #workspace-view { flex: 1; min-height: 0; }
    body[data-page="reports"] main {
      max-width: none;
      overflow: hidden;
      padding: 12px 16px 16px;
      gap: 0;
    }
    .page-view[data-page-view="reports"] {
      height: 100%;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }
    .page-view[data-page-view="reports"] .page-heading {
      align-items: center;
      flex-shrink: 0;
      margin-bottom: 10px;
      min-height: 36px;
    }
    .page-view[data-page-view="reports"] .page-heading > div {
      display: flex;
      align-items: baseline;
      gap: 12px;
      min-width: 0;
    }
    .page-view[data-page-view="reports"] .page-heading h2 {
      flex-shrink: 0;
      font-size: 18px;
    }
    .page-view[data-page-view="reports"] .page-heading p {
      margin-top: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .page-view[data-page-view="reports"] .grid-1-2 {
      flex: 1;
      min-height: 0;
      gap: 12px;
      grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
    }
    .page-view[data-page-view="reports"] .card {
      min-height: 0;
      overflow: hidden;
      padding: 16px;
      gap: 12px;
    }
    .page-view[data-page-view="reports"] .runs-list {
      flex: 1;
      max-height: none;
      min-height: 0;
      overscroll-behavior: contain;
    }
    #detail-card #detail {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
      padding-right: 4px;
    }

    .page-view { animation: page-enter 0.18s ease; }
    @keyframes page-enter { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: none; } }
    .page-heading {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 18px;
    }
    .page-heading h2 { font-size: 20px; line-height: 1.25; letter-spacing: -0.025em; }
    .page-heading p { color: var(--text-muted); font-size: 12.5px; margin-top: 5px; }

    .overview-metrics {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 18px;
    }
    .metric-card {
      padding: 16px;
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      background: var(--panel-card);
      box-shadow: var(--shadow-sm);
    }
    .metric-label { color: var(--text-muted); font-size: 11.5px; }
    .metric-value { margin-top: 7px; font-size: 24px; font-weight: 720; letter-spacing: -0.035em; }
    .metric-note { margin-top: 2px; color: var(--text-muted); font-size: 11px; }
    .overview-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) minmax(300px, 0.65fr);
      gap: 18px;
    }
    .latest-run-hero {
      min-height: 190px;
      justify-content: space-between;
      background:
        radial-gradient(circle at 90% 10%, var(--accent-light), transparent 40%),
        var(--panel-card);
    }
    .latest-run-title { font-size: 18px; font-weight: 700; letter-spacing: -0.02em; }
    .latest-run-summary { color: var(--text-secondary); max-width: 760px; }
    .overview-actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .attention-list { display: flex; flex-direction: column; gap: 8px; }
    .attention-item {
      width: 100%;
      padding: 10px 11px;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: var(--panel-elevated);
      text-align: left;
      color: var(--text);
    }
    .attention-item:hover { border-color: var(--accent); background: var(--hover); }
    .attention-item-title { font-size: 12.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .attention-item-meta { margin-top: 3px; font-size: 10.5px; color: var(--text-muted); }
    .settings-summary { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .settings-value {
      padding: 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: var(--panel-elevated);
      min-width: 0;
    }
    .settings-value strong { display: block; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; }

    .doctor-toolbar {
      display: flex;
      align-items: flex-end;
      gap: 12px;
      flex-wrap: wrap;
    }
    .doctor-scope { width: min(320px, 100%); }
    .doctor-summary {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
    }
    .doctor-summary-item {
      padding: 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: var(--panel-elevated);
    }
    .doctor-summary-item strong { display: block; margin-top: 3px; font-size: 20px; }
    .doctor-group-list { display: flex; flex-direction: column; gap: 14px; }
    .doctor-check-list { display: flex; flex-direction: column; }
    .doctor-check {
      display: grid;
      grid-template-columns: 76px minmax(150px, 0.35fr) minmax(0, 1fr);
      gap: 12px;
      align-items: start;
      padding: 12px 0;
      border-top: 1px solid var(--border);
    }
    .doctor-check:first-child { border-top: 0; padding-top: 0; }
    .doctor-check:last-child { padding-bottom: 0; }
    .doctor-check-label { font-weight: 600; font-size: 12.5px; }
    .doctor-check-detail { color: var(--text-secondary); font-size: 12px; overflow-wrap: anywhere; }
    .doctor-check-fix { margin-top: 5px; color: var(--warn); }
    .doctor-status {
      display: inline-flex;
      justify-content: center;
      width: 58px;
      padding: 3px 7px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: .04em;
    }
    .doctor-status.pass { color: var(--good); background: var(--good-bg); border: 1px solid var(--good-border); }
    .doctor-status.warn { color: var(--warn); background: var(--warn-bg); border: 1px solid var(--warn-border); }
    .doctor-status.fail { color: var(--bad); background: var(--bad-bg); border: 1px solid var(--bad-border); }
    .doctor-status.skip { color: var(--text-muted); background: var(--panel-elevated); border: 1px solid var(--border); }

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
    .run-spec-picker {
      max-height: 220px;
      overflow: auto;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: var(--panel-elevated);
    }
    .run-spec-item {
      display: flex;
      align-items: flex-start;
      gap: 9px;
      padding: 9px 11px;
      border-bottom: 1px solid var(--border);
      cursor: pointer;
    }
    .run-spec-item:last-child { border-bottom: 0; }
    .run-spec-item:hover { background: var(--panel-card); }
    .run-spec-item input { margin-top: 2px; }
    .run-spec-item-copy { min-width: 0; font-size: 12px; line-height: 1.4; }
    .run-spec-item-copy strong { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .run-spec-item-copy span { color: var(--text-muted); }
    .run-spec-item.invalid { cursor: not-allowed; opacity: .62; }
    .manual-login-panel { align-items: center; }
    .manual-login-copy { flex: 1; min-width: 0; }
    .manual-login-panel .button { flex-shrink: 0; }
    .live-view-card {
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: var(--panel-card);
      overflow: hidden;
    }
    .live-view-header {
      min-height: 42px;
      padding: 7px 10px 7px 13px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      border-bottom: 1px solid var(--border);
      background: var(--panel-elevated);
    }
    .live-view-title { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .live-view-title strong { font-size: 12px; }
    .live-view-header > .row { flex-shrink: 0; }
    .live-view-status { font-size: 11px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .live-view-body { position: relative; aspect-ratio: 16 / 11; min-height: 360px; background: #090a0f; }
    .live-view-frame { position: absolute; inset: 0; display: block; width: 100%; height: 100%; border: 0; background: #fff; }
    .live-view-empty {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 24px;
      color: #8b949e;
      text-align: center;
      font-size: 12px;
      pointer-events: none;
    }
    .live-view-card.collapsed .live-view-body { display: none; }
    .live-view-card:fullscreen { display: flex; flex-direction: column; width: 100%; height: 100%; border: 0; border-radius: 0; }
    .live-view-card:fullscreen .live-view-header { flex-shrink: 0; }
    .live-view-card:fullscreen .live-view-body { display: block; flex: 1; aspect-ratio: auto; height: auto; min-height: 0; }
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
    .case-filter-bar {
      display: grid;
      grid-template-columns: minmax(180px, 1fr) 132px auto;
      align-items: center;
      gap: 10px;
    }
    .case-filter-count {
      color: var(--text-muted);
      font-size: 12px;
      white-space: nowrap;
      text-align: right;
    }
    .case-picker-list {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 8px;
    }
    .case-picker-item {
      min-width: 0;
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: var(--panel-elevated);
      color: var(--text-secondary);
      text-align: left;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .case-picker-item:hover {
      border-color: var(--accent);
      background: var(--hover);
    }
    .case-picker-item.active {
      border-color: var(--accent);
      background: var(--accent-light);
      box-shadow: 0 0 0 1px var(--accent-border);
      color: var(--text);
    }
    .case-picker-item-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-size: 12.5px;
      font-weight: 650;
    }
    .case-picker-item-title > span:first-child {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .case-picker-item-summary {
      margin-top: 5px;
      overflow: hidden;
      color: var(--text-muted);
      font-size: 11px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .case-report {
      padding: 16px;
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      background: var(--panel-card);
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
      .page-view[data-page-view="reports"] .grid-1-2 { grid-template-columns: 1fr; }
      .overview-metrics { grid-template-columns: repeat(2, 1fr); }
      .overview-grid { grid-template-columns: 1fr; }
      .header-left { gap: 12px; }
      .workspace-picker-path, .workspace-picker-separator { display: none; }
    }
    @media (max-width: 768px) {
      header { padding: 0 16px; }
      .layout { flex-direction: column; }
      .sidebar {
        width: 100%;
        padding: 8px 12px;
        border-right: none;
        border-bottom: 1px solid var(--border);
        overflow-x: auto;
        overflow-y: hidden;
        height: auto;
        flex-shrink: 0;
      }
      .sidebar-label, .sidebar-footer { display: none; }
      .sidebar-nav { flex-direction: row; min-width: max-content; }
      .nav-item { width: auto; padding: 8px 10px; }
      main { padding: 16px; }
      body[data-page="reports"] main { overflow-y: auto; }
      .page-view[data-page-view="reports"] { height: auto; }
      .page-view[data-page-view="reports"] .grid-1-2 { min-height: auto; }
      .page-view[data-page-view="reports"] .card { overflow: visible; }
      .page-view[data-page-view="reports"] .runs-list { max-height: 360px; }
      #detail-card #detail { max-height: 65vh; }
      .overview-metrics { grid-template-columns: 1fr 1fr; }
      .settings-summary { grid-template-columns: 1fr; }
      .doctor-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .doctor-check { grid-template-columns: 64px 1fr; }
      .doctor-check-detail { grid-column: 2; }
      .brand .sub { display: none; }
      .workspace-picker-btn { max-width: 220px; }
      .header-actions .server-status, #btn-header-manage-ws { display: none; }
    }
    @media (max-width: 520px) {
      .nav-item span { display: none; }
      .overview-metrics { grid-template-columns: 1fr; }
      .page-heading { flex-direction: column; }
      .page-view[data-page-view="reports"] .page-heading {
        align-items: stretch;
      }
      .page-view[data-page-view="reports"] .page-heading > div {
        align-items: flex-start;
        flex-direction: column;
        gap: 2px;
      }
      .page-view[data-page-view="reports"] .page-heading p {
        white-space: normal;
      }
      .case-filter-bar { grid-template-columns: 1fr; }
      .case-filter-count { text-align: left; }
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
          <h1>auto-e2e <span class="version-pill">v0.3.1</span></h1>
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
    <aside class="sidebar" aria-label="工作区导航">
      <div class="sidebar-label">Workspace</div>
      <nav class="sidebar-nav">
        <button class="nav-item active" data-nav-page="overview">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          <span>概览</span>
        </button>
        <button class="nav-item" data-nav-page="specs">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>
          <span>验收用例</span>
        </button>
        <button class="nav-item" data-nav-page="run">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          <span>执行验收</span>
        </button>
        <button class="nav-item" data-nav-page="reports">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="m7 16 4-5 4 3 5-7"/></svg>
          <span>运行报告</span>
        </button>
        <button class="nav-item" data-nav-page="doctor">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
          <span>环境诊断</span>
        </button>
        <button class="nav-item" data-nav-page="settings">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6h.09A1.65 1.65 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v.09A1.65 1.65 0 0 0 20.91 10H21a2 2 0 1 1 0 4h-.09A1.65 1.65 0 0 0 19.4 15z"/></svg>
          <span>工作区设置</span>
        </button>
      </nav>
      <div class="sidebar-footer">本地只读报告服务<br>数据保留在当前工作区</div>
    </aside>
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
        <!-- Overview -->
        <section class="page-view" data-page-view="overview">
          <div class="page-heading">
            <div><h2>工作区概览</h2><p>聚焦最近一次验收结果和需要处理的问题。</p></div>
            <button class="button primary" id="overview-run">配置并运行</button>
          </div>
          <div class="overview-metrics">
            <div class="metric-card"><div class="metric-label">验收用例</div><div class="metric-value" id="overview-spec-total">0</div><div class="metric-note">当前工作区</div></div>
            <div class="metric-card"><div class="metric-label">配置问题</div><div class="metric-value" id="overview-spec-invalid">0</div><div class="metric-note">需要修复的用例</div></div>
            <div class="metric-card"><div class="metric-label">最近运行</div><div class="metric-value" id="overview-latest-status">—</div><div class="metric-note" id="overview-latest-time">暂无运行记录</div></div>
            <div class="metric-card"><div class="metric-label">近 20 次通过率</div><div class="metric-value" id="overview-pass-rate">—</div><div class="metric-note" id="overview-run-total">0 次运行</div></div>
          </div>
          <div class="overview-grid">
            <div class="card latest-run-hero">
              <div>
                <div class="row between"><div class="card-title">最近一次验收</div><span id="overview-latest-badge" class="status-badge blocked">暂无</span></div>
                <div class="latest-run-title" id="overview-latest-title" style="margin-top:18px">还没有运行记录</div>
                <div class="latest-run-summary" id="overview-latest-summary" style="margin-top:8px">运行验收后，这里会展示结果摘要。</div>
              </div>
              <div class="overview-actions">
                <button class="button primary sm" id="overview-view-report" disabled>查看最近报告</button>
                <button class="button sm" id="overview-new-spec">新建验收用例</button>
              </div>
            </div>
            <div class="card">
              <div class="card-header"><div class="card-title">需要关注</div><button class="button sm" id="overview-all-reports">全部报告</button></div>
              <div class="attention-list" id="overview-attention"><div class="sub">暂无失败或阻塞记录</div></div>
            </div>
          </div>
        </section>

        <!-- Task Spec Editor -->
        <section class="page-view hidden" data-page-view="specs">
          <div class="page-heading">
            <div><h2>验收用例</h2><p>编辑任务规格，并管理 Bundle 所需的输入与期望资源。</p></div>
          </div>
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
            <textarea class="textarea" id="task-spec" spellcheck="false" placeholder="{\n  &quot;schemaVersion&quot;: 2,\n  &quot;taskId&quot;: &quot;PL-01&quot;,\n  &quot;title&quot;: &quot;P&amp;L 预测&quot;,\n  &quot;requirement&quot;: &quot;上传模板并执行计算&quot;,\n  &quot;steps&quot;: [{&quot;id&quot;:&quot;STEP-01&quot;,&quot;instruction&quot;:&quot;上传模板并试算&quot;,&quot;expected&quot;:&quot;试算成功&quot;}],\n  &quot;results&quot;: [{&quot;id&quot;:&quot;RESULT-01&quot;,&quot;name&quot;:&quot;状态&quot;,&quot;actual&quot;:&quot;页面状态&quot;,&quot;expected&quot;:&quot;成功&quot;,&quot;match&quot;:&quot;equals&quot;}]\n}"></textarea>
            <div class="spec-toolbar" style="margin-top:10px;align-items:flex-start">
              <select class="select" id="resource-role" style="max-width:130px" title="资源目录">
                <option value="inputs">inputs</option>
                <option value="expected">expected</option>
                <option value="references">references</option>
              </select>
              <input id="resource-files" type="file" multiple class="hidden">
              <button class="button sm" id="upload-resources">上传资源文件</button>
              <div id="bundle-resources" class="sub" style="flex:1;font-size:11px;line-height:1.7">保存 Bundle 后可管理资源文件</div>
            </div>
          </div>
        </section>

        <!-- Run Acceptance -->
        <section class="page-view hidden" data-page-view="run">
          <div class="page-heading">
            <div><h2>执行验收</h2><p>选择本次需要验证的用例，并确认目标环境与执行参数。</p></div>
          </div>
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
                <div><strong id="run-spec-count">0 / 0 个用例已选择</strong><br><span id="run-spec-summary">默认执行全部有效用例，也可以按需取消选择。</span></div>
              </div>
              <div class="form-field">
                <div class="row between">
                  <div class="label">执行范围</div>
                  <div class="row">
                    <button class="button sm" type="button" id="run-spec-all">全选</button>
                    <button class="button sm" type="button" id="run-spec-none">清空</button>
                  </div>
                </div>
                <div class="run-spec-picker" id="run-spec-picker"></div>
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
              <div class="form-field">
                <div class="label">并发用例数</div>
                <input class="input" id="run-concurrency" type="number" min="1" max="32" step="1" value="1">
                <div class="sub" style="font-size:11px">默认 1；提高后会同时启动多个独立 BetterWright Session。</div>
              </div>
              <div class="run-scope manual-login-panel">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                <div class="manual-login-copy"><strong>需要人工登录？</strong><br>使用当前目标 URL 和 Profile 打开可交互浏览器；登录状态会被后续验收复用。</div>
                <button class="button sm" id="manual-login">打开手动登录</button>
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

              <div class="live-view-card" id="live-view-card">
                <div class="live-view-header">
                  <div class="live-view-title">
                    <strong>实时浏览器</strong>
                    <span class="status-badge blocked" id="live-view-badge">未连接</span>
                    <span class="live-view-status" id="live-view-status">打开手动登录或运行验收后，将在这里显示浏览器画面。</span>
                  </div>
                  <div class="row">
                    <button class="button sm" id="live-view-reload" disabled>刷新画面</button>
                    <button class="button sm" id="live-view-fullscreen" aria-pressed="false" aria-controls="live-view-card">全屏</button>
                    <button class="button sm" id="live-view-toggle">收起</button>
                  </div>
                </div>
                <div class="live-view-body">
                  <div class="live-view-empty" id="live-view-empty">
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="15" rx="2"></rect><path d="M8 21h8"></path><path d="M12 18v3"></path></svg>
                    <strong>等待 BetterWright Live View</strong>
                    <span>浏览器启动后无需离开当前页面即可登录或观察验收过程。</span>
                  </div>
                  <iframe class="live-view-frame hidden" id="live-view-frame" title="BetterWright 实时浏览器" referrerpolicy="no-referrer" sandbox="allow-scripts allow-forms allow-pointer-lock allow-downloads" allow="clipboard-read; clipboard-write; fullscreen"></iframe>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Runs History & Run Detail -->
        <section class="page-view hidden" data-page-view="reports">
          <div class="page-heading">
            <div><h2>运行报告</h2><p>查看历史验收结果、断言详情和截图证据。</p></div>
            <button class="button sm" id="refresh-runs-top">刷新报告</button>
          </div>
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
              <div class="row" style="gap:6px">
                <button class="button sm" id="export-run-html" disabled title="导出包含截图证据的独立 HTML 文件">导出 HTML</button>
                <button class="button sm" id="export-run-markdown" disabled title="导出包含截图证据的 Markdown 文件">导出 Markdown</button>
                <button class="button danger sm" id="delete-run" disabled title="删除当前运行报告及其截图证据">删除报告</button>
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
        </section>

        <!-- Doctor -->
        <section class="page-view hidden" data-page-view="doctor">
          <div class="page-heading">
            <div><h2>环境诊断</h2><p>检查 auto-e2e 工具链和当前项目是否具备验收运行条件。</p></div>
          </div>
          <div class="card">
            <div class="doctor-toolbar">
              <div class="form-field doctor-scope">
                <div class="label">检查范围</div>
                <select class="select" id="doctor-scope">
                  <option value="all">全部：工具链与当前项目</option>
                  <option value="tool">仅工具链</option>
                  <option value="project">仅当前项目</option>
                </select>
              </div>
              <button class="button primary" id="run-doctor">开始诊断</button>
            </div>
            <div id="doctor-result">
              <div class="empty-state" style="padding:34px 10px">
                <div class="empty-icon">🩺</div>
                <div style="font-size:14px;font-weight:600;color:var(--text)">尚未运行诊断</div>
                <p class="sub" style="font-size:12px">选择检查范围后开始诊断。</p>
              </div>
            </div>
          </div>
        </section>

        <!-- Settings -->
        <section class="page-view hidden" data-page-view="settings">
          <div class="page-heading">
            <div><h2>工作区设置</h2><p>查看当前配置，或进入工作区管理修改项目参数。</p></div>
            <button class="button primary" id="settings-edit">编辑工作区配置</button>
          </div>
          <div class="card">
            <div class="card-header"><div class="card-title">当前工作区</div><span class="status-badge passed">已连接</span></div>
            <div class="settings-summary">
              <div class="settings-value"><span class="sub">项目名称</span><strong id="settings-name">—</strong></div>
              <div class="settings-value"><span class="sub">项目路径</span><strong id="settings-path" style="font-family:var(--font-mono);font-size:12px">—</strong></div>
              <div class="settings-value"><span class="sub">目标 URL</span><strong id="settings-url">—</strong></div>
              <div class="settings-value"><span class="sub">默认 Profile</span><strong id="settings-profile">—</strong></div>
              <div class="settings-value"><span class="sub">默认 Model</span><strong id="settings-model">—</strong></div>
              <div class="settings-value"><span class="sub">并发用例数</span><strong id="settings-concurrency">—</strong></div>
              <div class="settings-value"><span class="sub">浏览器模式</span><strong id="settings-headed">—</strong></div>
            </div>
          </div>
        </section>
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
                请输入本地项目的根目录绝对路径。系统会读取项目配置和验收需求，默认配置位置为 <code>.auto-e2e/config.yaml</code>。
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
              <div class="label">并发用例数 (acceptance.concurrency)</div>
              <input class="input" id="edit-ws-concurrency" type="number" min="1" max="32" step="1" value="1">
            </div>
            <div class="form-field">
              <label class="checkbox-label" style="margin-top:4px">
                <input type="checkbox" id="edit-ws-headed">
                <span>默认开启浏览器窗口 (Headed 模式)</span>
              </label>
            </div>
            <div class="row between" style="margin-top:10px;padding-top:14px;border-top:1px solid var(--border)">
              <div style="font-size:12px;color:var(--text-muted)">
                保存将更新 <code id="edit-ws-config-file">.auto-e2e/config.yaml</code>
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
    const state = { workspaces: [], selected: null, config: null, specs: [], selectedSpec: null, runSpecReferences: [], resources: [], runs: [], selectedRunId: null, filter: 'all', editingWorkspaceId: null, modalTab: 'list', currentPage: 'overview', runEvents: null, runWatchStop: null, liveViewerUrl: null, doctorReport: null };
    const el = (id) => document.getElementById(id);
    const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

    function routeParts() {
      return location.hash.replace(/^#\\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    }

    function navigate(page, detailId) {
      const suffix = detailId ? '/' + encodeURIComponent(detailId) : '';
      location.hash = '#/' + page + suffix;
    }

    function renderRoute() {
      const parts = routeParts();
      const allowed = ['overview', 'specs', 'run', 'reports', 'doctor', 'settings'];
      const page = allowed.includes(parts[0]) ? parts[0] : 'overview';
      state.currentPage = page;
      document.body.dataset.page = page;
      document.querySelectorAll('[data-page-view]').forEach((node) => {
        node.classList.toggle('hidden', node.dataset.pageView !== page);
      });
      document.querySelectorAll('[data-nav-page]').forEach((node) => {
        node.classList.toggle('active', node.dataset.navPage === page);
      });
      if (page === 'reports' && parts[1] && state.runs.some((run) => run.runId === parts[1])) {
        loadRun(parts[1]).catch((error) => toast(error.message, true));
      }
      window.scrollTo({ top: 0, behavior: 'instant' });
    }

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

    function statusLabel(status) {
      return ({ passed: '通过', failed: '失败', blocked: '阻塞', error: '异常' })[status] || '暂无';
    }

    function doctorStatusLabel(status) {
      return ({ pass: 'PASS', warn: 'WARN', fail: 'FAIL', skip: 'SKIP' })[status] || String(status).toUpperCase();
    }

    function renderDoctorReport(report) {
      state.doctorReport = report;
      const result = el('doctor-result');
      const summary = report.summary;
      const groups = [['tool', '工具链'], ['project', '当前项目']]
        .filter(([name]) => report.groups[name]);
      result.innerHTML = '<div class="stack">' +
        '<div class="row between"><div><strong>' + (report.ok ? '诊断通过，可以运行验收' : '诊断发现阻塞项') + '</strong>' +
        '<div class="sub" style="font-size:11px;margin-top:3px">检查范围：' + esc(({ all: '全部', tool: '工具链', project: '当前项目' })[report.scope] || report.scope) + '</div></div>' +
        '<span class="status-badge ' + (report.ok ? 'passed' : 'failed') + '">' + (report.ok ? 'READY' : 'BLOCKED') + '</span></div>' +
        '<div class="doctor-summary">' +
          '<div class="doctor-summary-item"><span class="sub">通过</span><strong style="color:var(--good)">' + esc(summary.pass) + '</strong></div>' +
          '<div class="doctor-summary-item"><span class="sub">警告</span><strong style="color:var(--warn)">' + esc(summary.warn) + '</strong></div>' +
          '<div class="doctor-summary-item"><span class="sub">失败</span><strong style="color:var(--bad)">' + esc(summary.fail) + '</strong></div>' +
          '<div class="doctor-summary-item"><span class="sub">跳过</span><strong style="color:var(--text-muted)">' + esc(summary.skip) + '</strong></div>' +
        '</div>' +
        '<div class="doctor-group-list">' + groups.map(([name, title]) => {
          const group = report.groups[name];
          return '<div class="card" style="box-shadow:none">' +
            '<div class="card-header"><div class="card-title">' + title + '</div><span class="doctor-status ' + esc(group.status) + '">' + doctorStatusLabel(group.status) + '</span></div>' +
            '<div class="doctor-check-list">' + group.checks.map((check) =>
              '<div class="doctor-check">' +
                '<div><span class="doctor-status ' + esc(check.status) + '">' + doctorStatusLabel(check.status) + '</span></div>' +
                '<div class="doctor-check-label">' + esc(check.label) + '</div>' +
                '<div class="doctor-check-detail">' + esc(check.detail) +
                  (check.fix && check.status !== 'pass' ? '<div class="doctor-check-fix">修复：' + esc(check.fix) + '</div>' : '') +
                '</div>' +
              '</div>'
            ).join('') + '</div>' +
          '</div>';
        }).join('') + '</div>' +
      '</div>';
    }

    async function runDoctorCheck() {
      if (!state.selected) return;
      const button = el('run-doctor');
      button.disabled = true;
      button.innerHTML = '<span class="status-dot-pulse" style="background:#fff"></span> 正在诊断...';
      try {
        const data = await api('/api/workspaces/' + encodeURIComponent(state.selected) + '/doctor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scope: el('doctor-scope').value })
        });
        renderDoctorReport(data.report);
        toast(data.report.ok ? '环境诊断通过' : '环境诊断发现阻塞项', !data.report.ok);
      } catch (error) {
        toast('环境诊断失败：' + error.message, true);
      } finally {
        button.disabled = false;
        button.textContent = '重新诊断';
      }
    }

    function renderOverview() {
      const runs = state.runs.slice(0, 20);
      const latest = runs[0];
      const invalidSpecs = state.specs.filter((spec) => spec.error).length;
      const passed = runs.filter((run) => run.status === 'passed').length;
      el('overview-spec-total').textContent = String(state.specs.length);
      el('overview-spec-invalid').textContent = String(invalidSpecs);
      el('overview-pass-rate').textContent = runs.length ? Math.round(passed / runs.length * 100) + '%' : '—';
      el('overview-run-total').textContent = runs.length + ' 次运行';

      const attention = el('overview-attention');
      const problems = state.runs.filter((run) => run.status !== 'passed').slice(0, 5);
      attention.replaceChildren();
      if (!problems.length) {
        attention.innerHTML = '<div class="sub">暂无失败或阻塞记录</div>';
      } else {
        problems.forEach((run) => {
          const button = document.createElement('button');
          button.className = 'attention-item';
          button.innerHTML = '<div class="row between"><div class="attention-item-title">' + esc(run.requirement || run.runId) + '</div><span class="status-badge ' + esc(run.status) + '">' + statusLabel(run.status) + '</span></div>' +
            '<div class="attention-item-meta">' + esc(new Date(run.startedAt).toLocaleString('zh-CN', { hour12: false })) + ' · ' + esc(run.passedCaseCount + '/' + run.caseCount + ' 用例通过') + '</div>';
          button.onclick = () => navigate('reports', run.runId);
          attention.appendChild(button);
        });
      }

      const reportButton = el('overview-view-report');
      if (!latest) {
        el('overview-latest-status').textContent = '—';
        el('overview-latest-time').textContent = '暂无运行记录';
        el('overview-latest-title').textContent = '还没有运行记录';
        el('overview-latest-summary').textContent = '运行验收后，这里会展示结果摘要。';
        el('overview-latest-badge').className = 'status-badge blocked';
        el('overview-latest-badge').textContent = '暂无';
        reportButton.disabled = true;
        reportButton.onclick = null;
        return;
      }

      const time = new Date(latest.startedAt).toLocaleString('zh-CN', { hour12: false });
      el('overview-latest-status').textContent = statusLabel(latest.status);
      el('overview-latest-time').textContent = time;
      el('overview-latest-title').textContent = latest.requirement || latest.runId;
      el('overview-latest-summary').textContent = latest.passedCaseCount + '/' + latest.caseCount + ' 个用例通过，' + latest.passedCriteriaCount + '/' + latest.criteriaCount + ' 个验收项通过，耗时 ' + (latest.durationMs / 1000).toFixed(1) + ' 秒。';
      el('overview-latest-badge').className = 'status-badge ' + latest.status;
      el('overview-latest-badge').textContent = statusLabel(latest.status);
      reportButton.disabled = false;
      reportButton.onclick = () => navigate('reports', latest.runId);
    }

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
      const changed = state.selected !== id;
      if (changed) clearLiveViewer();
      if (changed) {
        state.specs = [];
        state.runSpecReferences = [];
        state.doctorReport = null;
        el('doctor-result').innerHTML = '<div class="empty-state" style="padding:34px 10px"><div class="empty-icon">🩺</div><div style="font-size:14px;font-weight:600;color:var(--text)">尚未运行诊断</div><p class="sub" style="font-size:12px">选择检查范围后开始诊断。</p></div>';
        el('run-doctor').textContent = '开始诊断';
      }
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
      el('run-concurrency').value = data.config.acceptance.concurrency;
      el('run-headed').checked = data.config.acceptance.headed;

      el('settings-name').textContent = data.workspace.name;
      el('settings-path').textContent = data.workspace.path;
      el('settings-url').textContent = data.config.project.baseUrl;
      el('settings-profile').textContent = data.config.acceptance.profile;
      el('settings-model').textContent = data.config.acceptance.model;
      el('settings-concurrency').textContent = data.config.acceptance.concurrency;
      el('settings-headed').textContent = data.config.acceptance.headed ? '显示浏览器窗口' : '无头模式';

      await Promise.all([loadSpecs(), loadRuns()]);
      renderOverview();
      renderRoute();
      renderModalWorkspaceList();
      if (changed || !state.runEvents) void resumeActiveRun(id);
    }

    async function loadWorkspaceConfigForEdit(id) {
      state.editingWorkspaceId = id;
      try {
        const data = await api('/api/workspaces/' + encodeURIComponent(id));
        const conf = data.config;
        el('edit-ws-path').value = data.workspace.path;
        el('edit-ws-name').value = conf.project.name || '';
        el('edit-ws-url').value = conf.project.baseUrl || '';
        el('edit-ws-config-file').textContent = data.configFile;
        el('edit-ws-model').value = conf.acceptance.model || '';
        el('edit-ws-profile').value = conf.acceptance.profile || '';
        el('edit-ws-concurrency').value = conf.acceptance.concurrency || 1;
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
      const concurrency = Number(el('edit-ws-concurrency').value);
      const headed = el('edit-ws-headed').checked;

      if (!name) { toast('项目名称不能为空', true); return; }
      if (!baseUrl) { toast('目标 URL 不能为空', true); return; }
      if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 32) {
        toast('并发用例数必须是 1 到 32 之间的整数', true);
        return;
      }

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
            concurrency,
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
        schemaVersion: 2,
        taskId: 'CASE-01',
        title: '示例验收用例',
        requirement: '描述期望的功能行为',
        steps: [{
          id: 'STEP-01',
          instruction: '完成需要验收的业务操作',
          expected: '操作完成并显示成功状态'
        }],
        results: [{
          id: 'RESULT-01',
          name: '页面结果',
          actual: '操作完成后的页面结果',
          expected: '预期结果',
          match: 'equals'
        }]
      };
    }

    function specDisplayPath(name) {
      return '.auto-e2e/specs/' + name + (name.endsWith('.spec.json') ? '' : '/spec.json');
    }

    async function loadSpecs(preferredFile) {
      const previousRunnable = state.specs.filter((item) => !item.error).map((item) => item.reference);
      const previouslySelected = new Set(state.runSpecReferences);
      const previouslyAllSelected = previousRunnable.length === 0 || previousRunnable.every((reference) => previouslySelected.has(reference));
      const data = await api('/api/workspaces/' + encodeURIComponent(state.selected) + '/task-specs');
      state.specs = data.specs || [];
      el('spec-count').textContent = state.specs.length + ' 个文件';
      const runnable = state.specs.filter((item) => !item.error).map((item) => item.reference);
      state.runSpecReferences = previouslyAllSelected
        ? runnable
        : runnable.filter((reference) => previouslySelected.has(reference));
      renderRunSpecPicker();
      const available = state.specs.map((item) => item.fileName);
      state.selectedSpec = preferredFile && available.includes(preferredFile)
        ? preferredFile
        : state.selectedSpec && available.includes(state.selectedSpec)
          ? state.selectedSpec
          : available[0] || 'example';
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
      renderOverview();
    }

    function renderRunSpecPicker() {
      const container = el('run-spec-picker');
      container.replaceChildren();
      if (!state.specs.length) {
        container.innerHTML = '<div class="empty-state" style="padding:18px"><span class="sub">暂无可执行用例</span></div>';
      } else {
        const selected = new Set(state.runSpecReferences);
        state.specs.forEach((item) => {
          const label = document.createElement('label');
          label.className = 'run-spec-item' + (item.error ? ' invalid' : '');
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.value = item.reference;
          checkbox.checked = selected.has(item.reference);
          checkbox.disabled = Boolean(item.error);
          checkbox.onchange = () => {
            const next = new Set(state.runSpecReferences);
            if (checkbox.checked) next.add(item.reference); else next.delete(item.reference);
            state.runSpecReferences = state.specs.map((spec) => spec.reference).filter((reference) => next.has(reference));
            updateRunScope();
          };
          const copy = document.createElement('div');
          copy.className = 'run-spec-item-copy';
          const title = document.createElement('strong');
          title.textContent = (item.taskId ? item.taskId + ' · ' : '') + item.title;
          const detail = document.createElement('span');
          detail.textContent = item.error ? '格式有误：' + item.error : item.reference;
          copy.append(title, detail);
          label.append(checkbox, copy);
          container.appendChild(label);
        });
      }
      updateRunScope();
    }

    function updateRunScope() {
      const runnableCount = state.specs.filter((item) => !item.error).length;
      const selectedCount = state.runSpecReferences.length;
      el('run-spec-count').textContent = selectedCount + ' / ' + runnableCount + ' 个用例已选择';
      el('run-spec-summary').textContent = selectedCount === runnableCount && runnableCount > 0
        ? '将按目录顺序运行全部有效用例。'
        : selectedCount > 0 ? '本次只运行选中的用例。' : '请至少选择一个有效用例。';
      if (!state.runEvents) setRunControlsIdle();
    }

    async function loadSelectedSpec() {
      const existing = state.specs.some((item) => item.fileName === state.selectedSpec);
      const value = existing
        ? (await api('/api/workspaces/' + encodeURIComponent(state.selected) + '/task-specs/' + encodeURIComponent(state.selectedSpec))).spec
        : defaultSpec();
      el('spec-path').textContent = specDisplayPath(state.selectedSpec);
      el('task-spec').value = JSON.stringify(value, null, 2);
      el('delete-spec').disabled = !existing;
      await loadBundleResources();
    }

    function resourceApiBase() {
      return '/api/workspaces/' + encodeURIComponent(state.selected) + '/task-specs/' +
        encodeURIComponent(state.selectedSpec) + '/resources';
    }

    async function loadBundleResources() {
      const existingBundle = state.specs.some((item) => item.fileName === state.selectedSpec) &&
        !state.selectedSpec.endsWith('.spec.json');
      el('upload-resources').disabled = !existingBundle;
      el('resource-role').disabled = !existingBundle;
      if (!existingBundle) {
        state.resources = [];
        el('bundle-resources').textContent = state.selectedSpec?.endsWith('.spec.json')
          ? '旧版 Spec 不支持 Bundle 资源'
          : '先保存 Bundle，再上传 inputs / expected / references 文件';
        return;
      }
      try {
        const data = await api(resourceApiBase());
        state.resources = data.files || [];
        const container = el('bundle-resources');
        container.replaceChildren();
        if (!state.resources.length) {
          container.textContent = '暂无资源文件';
          return;
        }
        state.resources.forEach((resource) => {
          const row = document.createElement('div');
          row.className = 'row between';
          const label = document.createElement('span');
          label.textContent = resource.path + ' · ' + Math.ceil(resource.size / 1024) + ' KB';
          const remove = document.createElement('button');
          remove.className = 'button danger sm';
          remove.textContent = '删除';
          remove.onclick = () => deleteBundleResource(resource.path);
          row.append(label, remove);
          container.appendChild(row);
        });
      } catch (error) {
        el('bundle-resources').textContent = '资源读取失败：' + error.message;
      }
    }

    async function uploadBundleResources(files) {
      if (!files.length) return;
      const directory = el('resource-role').value;
      try {
        for (const file of files) {
          const resourcePath = directory + '/' + file.name;
          const response = await fetch(resourceApiBase() + '/' + encodeURIComponent(resourcePath), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: file
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || '上传失败');
        }
        el('resource-files').value = '';
        await loadBundleResources();
        toast(files.length + ' 个资源文件已上传');
      } catch (error) {
        toast('上传资源失败：' + error.message, true);
      }
    }

    async function deleteBundleResource(resourcePath) {
      if (!confirm('确认删除资源文件「' + resourcePath + '」？')) return;
      try {
        await api(resourceApiBase() + '/' + encodeURIComponent(resourcePath), { method: 'DELETE' });
        await loadBundleResources();
        toast('资源文件已删除');
      } catch (error) {
        toast('删除资源失败：' + error.message, true);
      }
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
      let fileName = prompt('输入 Spec Bundle 名称（建议使用英文短横线命名）', 'new-case');
      if (!fileName) return;
      fileName = fileName.trim();
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(fileName)) {
        toast('Bundle 名称只能包含字母、数字、点、下划线和短横线', true);
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
      el('spec-path').textContent = specDisplayPath(fileName);
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
      if (state.selectedRunId && !state.runs.some((run) => run.runId === state.selectedRunId)) {
        state.selectedRunId = null;
        clearRunDetail();
      }
      renderRunsList();
      renderOverview();
    }

    function clearRunDetail() {
      el('delete-run').disabled = true;
      el('export-run-html').disabled = true;
      el('export-run-markdown').disabled = true;
      el('detail').innerHTML = '<div class="empty-state" style="padding:40px 10px">' +
        '<div class="empty-icon" style="width:44px;height:44px;font-size:18px">🔍</div>' +
        '<div style="font-size:14px;font-weight:600;color:var(--text)">选择运行记录</div>' +
        '<p class="sub" style="font-size:12px">选择左侧一次运行记录查看验收矩阵与 proof。</p>' +
        '</div>';
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
          if (routeParts()[0] !== 'reports' || routeParts()[1] !== run.runId) {
            navigate('reports', run.runId);
          }
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
      el('delete-run').disabled = false;
      el('export-run-html').disabled = false;
      el('export-run-markdown').disabled = false;

      function renderCriteria(items) {
        return (items || []).map((item) => {
        let proofHtml = '';
        if (item.proof) {
          const roots = data.artifactRoots.map((root) => root.replaceAll(String.fromCharCode(92), '/') + '/');
          const proof = item.proof.replaceAll(String.fromCharCode(92), '/');
          const marker = '.auto-e2e/artifacts/';
          const index = proof.indexOf(marker);
          const root = roots.find((candidate) => proof.startsWith(candidate));
          const artifactPath = root ? proof.slice(root.length)
            : index >= 0 ? proof.slice(index + marker.length) : proof;
          const imgSrc = '/api/workspaces/' + encodeURIComponent(state.selected) + '/artifacts/' + artifactPath.split('/').map(encodeURIComponent).join('/');
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
        criteria: run.criteria,
        workflowSteps: run.workflowSteps,
        resultAssertions: run.resultAssertions,
        specDigest: run.specDigest
      }];
      const casesHtml = runCases.map((testCase, caseIndex) => {
        const caseHeader = run.schemaVersion === 2
          ? '<div class="row between" style="padding:10px 0 4px"><div><div style="font-size:14px;font-weight:700">' + esc(testCase.caseId + ' · ' + testCase.source.title) + '</div><div class="sub" style="font-size:12px;margin-top:3px">' + esc(testCase.summary) + '</div></div><span class="status-badge ' + esc(testCase.status) + '">' + esc(testCase.status) + '</span></div>'
          : '';
        const workflow = (testCase.workflowSteps || []).map((step) => ({
          id: step.id,
          status: step.status,
          description: step.instruction + '；完成状态：' + step.expected,
          actual: step.actual,
          proof: step.proof
        }));
        const results = (testCase.resultAssertions || []).map((result) => ({
          id: result.id,
          status: result.status,
          description: result.name + '；期望：' + JSON.stringify(result.expected) + '；比较：' + result.match,
          actual: typeof result.actual === 'string' ? result.actual : JSON.stringify(result.actual),
          proof: result.proof
        }));
        const structured = workflow.length || results.length
          ? (workflow.length ? '<div class="label">业务步骤</div><div class="criteria-list">' + renderCriteria(workflow) + '</div>' : '') +
            (results.length ? '<div class="label" style="margin-top:8px">结果断言</div><div class="criteria-list">' + renderCriteria(results) + '</div>' : '')
          : '<div class="criteria-list">' + renderCriteria(testCase.criteria) + '</div>';
        const digest = testCase.specDigest
          ? '<div class="sub" style="font-family:var(--font-mono);font-size:11px">Spec: ' + esc(testCase.specDigest) + '</div>'
          : '';
        return '<article class="case-report' + (caseIndex ? ' hidden' : '') + '" data-case-index="' + caseIndex + '">' +
          '<div class="stack" style="gap:8px">' + caseHeader + digest + structured + '</div>' +
          '</article>';
      }).join('');

      const casePickerHtml = runCases.length > 1
        ? '<div class="stack" style="gap:10px">' +
          '<div class="case-filter-bar">' +
          '<input class="input" id="case-filter-search" type="search" placeholder="筛选用例 ID、标题或摘要" aria-label="筛选验收用例">' +
          '<select class="select" id="case-filter-status" aria-label="按状态筛选验收用例">' +
          '<option value="all">全部状态</option><option value="passed">通过</option><option value="failed">失败</option><option value="blocked">阻塞</option><option value="error">异常</option>' +
          '</select>' +
          '<span class="case-filter-count" id="case-filter-count"></span>' +
          '</div>' +
          '<div class="case-picker-list" id="case-picker-list">' +
          runCases.map((testCase, caseIndex) =>
            '<button class="case-picker-item' + (caseIndex ? '' : ' active') + '" type="button" data-case-index="' + caseIndex + '" data-case-status="' + esc(testCase.status) + '" data-case-search="' + esc([testCase.caseId, testCase.source.title, testCase.summary].join(' ').toLowerCase()) + '">' +
            '<div class="case-picker-item-title"><span>' + esc(testCase.caseId + ' · ' + testCase.source.title) + '</span><span class="status-badge ' + esc(testCase.status) + '">' + esc(testCase.status) + '</span></div>' +
            '<div class="case-picker-item-summary">' + esc(testCase.summary) + '</div>' +
            '</button>'
          ).join('') +
          '</div></div>'
        : '';

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
        casePickerHtml +
        casesHtml +
        '</div>' +
        '</div>';

      if (runCases.length > 1) {
        const pickerItems = Array.from(detailContainer.querySelectorAll('.case-picker-item'));
        const caseReports = Array.from(detailContainer.querySelectorAll('.case-report'));
        let activeCaseIndex = 0;

        function applyCaseFilter() {
          const query = el('case-filter-search').value.trim().toLowerCase();
          const status = el('case-filter-status').value;
          const matches = pickerItems.filter((item) => {
            const matchesQuery = !query || item.dataset.caseSearch.includes(query);
            const matchesStatus = status === 'all' || item.dataset.caseStatus === status;
            item.classList.toggle('hidden', !matchesQuery || !matchesStatus);
            return matchesQuery && matchesStatus;
          });

          if (!matches.some((item) => Number(item.dataset.caseIndex) === activeCaseIndex)) {
            activeCaseIndex = matches.length ? Number(matches[0].dataset.caseIndex) : -1;
          }
          pickerItems.forEach((item) => item.classList.toggle('active', Number(item.dataset.caseIndex) === activeCaseIndex));
          caseReports.forEach((report) => report.classList.toggle('hidden', Number(report.dataset.caseIndex) !== activeCaseIndex));
          el('case-filter-count').textContent = matches.length + ' / ' + runCases.length + ' 个用例';
        }

        pickerItems.forEach((item) => {
          item.onclick = () => {
            activeCaseIndex = Number(item.dataset.caseIndex);
            applyCaseFilter();
          };
        });
        el('case-filter-search').oninput = applyCaseFilter;
        el('case-filter-status').onchange = applyCaseFilter;
        applyCaseFilter();
      }
    }

    async function deleteRun() {
      const runId = state.selectedRunId;
      if (!runId || !confirm('确认永久删除运行报告「' + runId + '」？相关报告文件和截图证据也会被删除。')) return;
      const button = el('delete-run');
      button.disabled = true;
      try {
        await api('/api/workspaces/' + encodeURIComponent(state.selected) + '/runs/' + encodeURIComponent(runId), { method: 'DELETE' });
        state.selectedRunId = null;
        clearRunDetail();
        navigate('reports');
        await loadRuns();
        toast('运行报告已删除');
      } catch (error) {
        button.disabled = false;
        toast('删除失败：' + error.message, true);
      }
    }

    function exportRun(format) {
      const runId = state.selectedRunId;
      if (!runId || !state.selected) return;
      const link = document.createElement('a');
      link.href = '/api/workspaces/' + encodeURIComponent(state.selected) + '/runs/' + encodeURIComponent(runId) + '/export?format=' + encodeURIComponent(format);
      link.download = '';
      document.body.appendChild(link);
      link.click();
      link.remove();
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
      const editedSpec = state.specs.find((item) => item.fileName === state.selectedSpec);
      const shouldSaveEditedSpec = !editedSpec || state.runSpecReferences.includes(editedSpec.reference);
      if (shouldSaveEditedSpec && !await saveSpec()) return;
      const selectedSpecs = [...state.runSpecReferences];
      if (!selectedSpecs.length) {
        toast('请至少选择一个有效用例', true);
        return;
      }
      const concurrency = Number(el('run-concurrency').value);
      if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 32) {
        toast('并发用例数必须是 1 到 32 之间的整数', true);
        return;
      }
      const output = el('run-output');
      const workspaceId = state.selected;
      setRunControlsRunning(selectedSpecs.length);
      output.textContent = '正在创建验收任务...';

      try {
        const data = await api('/api/workspaces/' + encodeURIComponent(state.selected) + '/run-jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: el('run-url').value,
            profile: el('run-profile').value,
            model: el('run-model').value,
            specs: selectedSpecs,
            concurrency,
            headed: el('run-headed').checked,
            fresh: el('run-fresh').checked
          })
        });
        await watchRunJob(data.jobId, output, workspaceId);
      } catch (error) {
        output.textContent = '执行失败：\\n' + error.message;
        toast(error.message, true);
      } finally {
        if (state.selected === workspaceId && !state.runEvents) setRunControlsIdle();
      }
    }

    async function openManualLogin() {
      const button = el('manual-login');
      button.disabled = true;
      button.textContent = '正在打开…';
      setLiveViewStatus('正在启动手动登录浏览器…', 'blocked', '连接中');
      try {
        const data = await api('/api/workspaces/' + encodeURIComponent(state.selected) + '/manual-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: el('run-url').value,
            profile: el('run-profile').value,
            headed: el('run-headed').checked
          })
        });
        showLiveViewer(data.viewerUrl, '手动登录 · ' + data.profile);
        toast('手动登录浏览器已连接；完成登录后可直接运行验收');
      } catch (error) {
        setLiveViewStatus('手动登录启动失败：' + error.message, 'failed', '连接失败');
        toast(error.message, true);
      } finally {
        button.disabled = false;
        button.textContent = '打开手动登录';
      }
    }

    function initLiveViewFullscreen() {
      const card = el('live-view-card');
      const button = el('live-view-fullscreen');
      const toggle = el('live-view-toggle');
      const sync = () => {
        const active = document.fullscreenElement === card;
        button.textContent = active ? '退出全屏' : '全屏';
        button.setAttribute('aria-pressed', String(active));
        toggle.disabled = active;
      };
      button.disabled = !document.fullscreenEnabled || typeof card.requestFullscreen !== 'function';
      if (button.disabled) button.title = '当前浏览器不支持全屏';
      document.addEventListener('fullscreenchange', sync);
      button.onclick = async () => {
        try {
          if (document.fullscreenElement === card) {
            await document.exitFullscreen();
          } else {
            await card.requestFullscreen();
            card.classList.remove('collapsed');
            toggle.textContent = '收起';
          }
        } catch (error) {
          toast('切换全屏失败：' + error.message, true);
        }
        sync();
      };
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && document.fullscreenElement === card) {
          event.preventDefault();
          button.click();
        }
      });
      sync();
    }

    function setLiveViewStatus(message, badgeClass, badgeText) {
      el('live-view-status').textContent = message;
      const badge = el('live-view-badge');
      badge.className = 'status-badge ' + badgeClass;
      badge.textContent = badgeText;
    }

    function showLiveViewer(url, label) {
      state.liveViewerUrl = url;
      const frame = el('live-view-frame');
      frame.src = url;
      frame.classList.remove('hidden');
      el('live-view-empty').classList.add('hidden');
      el('live-view-reload').disabled = false;
      el('live-view-card').classList.remove('collapsed');
      el('live-view-toggle').textContent = '收起';
      setLiveViewStatus(label, 'passed', '已连接');
    }

    function clearLiveViewer() {
      state.runWatchStop?.();
      state.runWatchStop = null;
      disconnectLiveViewer();
      if (el('live-view-status')) setLiveViewStatus('打开手动登录或运行验收后，将在这里显示浏览器画面。', 'blocked', '未连接');
    }

    function disconnectLiveViewer() {
      state.liveViewerUrl = null;
      const frame = el('live-view-frame');
      if (frame) {
        frame.removeAttribute('src');
        frame.classList.add('hidden');
      }
      el('live-view-empty')?.classList.remove('hidden');
      if (el('live-view-reload')) el('live-view-reload').disabled = true;
    }

    function setRunControlsRunning(count) {
      const runButton = el('run-acceptance');
      runButton.disabled = true;
      runButton.innerHTML = '<span class="status-dot-pulse" style="background:#fff"></span> 正在运行 ' + count + ' 个用例...';
      el('manual-login').disabled = true;
    }

    function setRunControlsIdle() {
      const runButton = el('run-acceptance');
      const selectedCount = state.runSpecReferences.length;
      const runnableCount = state.specs.filter((item) => !item.error).length;
      runButton.disabled = selectedCount === 0;
      const label = selectedCount === runnableCount && runnableCount > 0
        ? '运行全部用例' : '运行选中的 ' + selectedCount + ' 个用例';
      runButton.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> ' + label;
      el('manual-login').disabled = false;
    }

    function setRunControlsChecking() {
      const runButton = el('run-acceptance');
      runButton.disabled = true;
      runButton.innerHTML = '<span class="status-dot-pulse"></span> 正在检查运行状态...';
      el('manual-login').disabled = true;
    }

    async function resumeActiveRun(workspaceId) {
      if (state.selected !== workspaceId || state.runEvents) return;
      setRunControlsChecking();
      try {
        const data = await api('/api/workspaces/' + encodeURIComponent(workspaceId) + '/run-jobs/active');
        if (state.selected !== workspaceId || state.runEvents) return;
        if (!data.job) {
          setRunControlsIdle();
          return;
        }
        const output = el('run-output');
        output.textContent = '正在恢复验收任务的实时连接...';
        setRunControlsRunning(state.specs.length);
        try {
          await watchRunJob(data.job.id, output, workspaceId);
        } catch (error) {
          if (state.selected === workspaceId) {
            output.textContent = '执行失败：\\n' + error.message;
            toast(error.message, true);
          }
        } finally {
          if (state.selected === workspaceId && !state.runEvents) setRunControlsIdle();
        }
      } catch (error) {
        if (state.selected === workspaceId) {
          setRunControlsIdle();
          toast('恢复验收任务失败：' + error.message, true);
        }
      }
    }

    function watchRunJob(jobId, output, workspaceId) {
      return new Promise((resolve, reject) => {
        state.runWatchStop?.();
        const events = new EventSource('/api/workspaces/' + encodeURIComponent(workspaceId) + '/run-jobs/' + encodeURIComponent(jobId) + '/events');
        state.runEvents = events;
        const lines = [];
        const seenEvents = new Set();
        let finished = false;
        let reconnecting = false;
        const detach = () => {
          if (finished) return;
          finished = true;
          events.close();
          if (state.runEvents === events) state.runEvents = null;
          if (state.runWatchStop === detach) state.runWatchStop = null;
          resolve(null);
        };
        state.runWatchStop = detach;
        const append = (line) => {
          lines.push(line);
          output.textContent = lines.join('\\n');
          output.scrollTop = output.scrollHeight;
        };
        events.onmessage = async (message) => {
          const event = JSON.parse(message.data);
          if (seenEvents.has(event.eventId)) return;
          seenEvents.add(event.eventId);
          if (event.type === 'run-started') append('验收任务已启动。');
          if (event.type === 'case-started') {
            append('[' + (event.index + 1) + '/' + event.total + '] 正在执行 ' + event.caseId + ' · ' + event.title);
            if (event.concurrency > 1) {
              disconnectLiveViewer();
              setLiveViewStatus('并发执行时不提供单一 Session 的实时浏览器画面。', 'blocked', '并发模式');
            } else {
              setLiveViewStatus('正在连接 ' + event.caseId + ' · ' + event.title, 'blocked', '连接中');
            }
          }
          if (event.type === 'viewer-ready') {
            showLiveViewer(event.viewerUrl, event.caseId + ' · ' + event.title);
          }
          if (event.type === 'viewer-error') {
            append('实时浏览器不可用：' + event.error);
            disconnectLiveViewer();
            setLiveViewStatus(event.error, 'failed', '连接失败');
          }
          if (event.type === 'case-completed') append(event.caseId + ' 执行完成：' + event.status);
          if (event.type === 'run-completed') {
            finished = true;
            events.close();
            if (state.runEvents === events) state.runEvents = null;
            if (state.runWatchStop === detach) state.runWatchStop = null;
            output.textContent = JSON.stringify(event.run, null, 2);
            setLiveViewStatus('验收完成：' + event.run.status, event.run.status === 'passed' ? 'passed' : 'failed', event.run.status === 'passed' ? '已完成' : '未通过');
            await loadRuns();
            toast('验收完成：' + event.run.status, event.run.status !== 'passed');
            resolve(event.run);
          }
          if (event.type === 'run-failed') {
            finished = true;
            events.close();
            if (state.runEvents === events) state.runEvents = null;
            if (state.runWatchStop === detach) state.runWatchStop = null;
            setLiveViewStatus('验收任务异常结束', 'failed', '异常');
            reject(new Error(event.error));
          }
        };
        events.onopen = () => {
          if (reconnecting) append('实时连接已恢复。');
          reconnecting = false;
        };
        events.onerror = () => {
          if (finished) return;
          if (!reconnecting) append('实时连接暂时中断，正在自动重连...');
          reconnecting = true;
          setLiveViewStatus('与验收任务的连接暂时中断，正在自动重连…', 'blocked', '重连中');
        };
      });
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
    el('delete-run').onclick = deleteRun;
    el('export-run-html').onclick = () => exportRun('html');
    el('export-run-markdown').onclick = () => exportRun('markdown');
    el('upload-resources').onclick = () => el('resource-files').click();
    el('resource-files').onchange = (event) => uploadBundleResources(Array.from(event.target.files || []));
    el('spec-file').onchange = async (event) => {
      state.selectedSpec = event.target.value;
      await loadSelectedSpec();
    };
    el('refresh-runs').onclick = loadRuns;
    el('refresh-runs-top').onclick = loadRuns;
    el('manual-login').onclick = openManualLogin;
    el('run-acceptance').onclick = runAcceptance;
    el('run-spec-all').onclick = () => {
      state.runSpecReferences = state.specs.filter((item) => !item.error).map((item) => item.reference);
      renderRunSpecPicker();
    };
    el('run-spec-none').onclick = () => {
      state.runSpecReferences = [];
      renderRunSpecPicker();
    };
    el('run-doctor').onclick = runDoctorCheck;
    initLiveViewFullscreen();
    el('live-view-reload').onclick = () => {
      if (!state.liveViewerUrl) return;
      const frame = el('live-view-frame');
      frame.src = state.liveViewerUrl;
    };
    el('live-view-toggle').onclick = () => {
      const card = el('live-view-card');
      const collapsed = card.classList.toggle('collapsed');
      el('live-view-toggle').textContent = collapsed ? '展开' : '收起';
    };

    document.querySelectorAll('[data-nav-page]').forEach((button) => {
      button.onclick = () => navigate(button.dataset.navPage);
    });
    el('overview-run').onclick = () => navigate('run');
    el('overview-new-spec').onclick = async () => {
      navigate('specs');
      await createSpec();
    };
    el('overview-all-reports').onclick = () => navigate('reports');
    el('settings-edit').onclick = () => openModal('edit', state.selected);
    window.addEventListener('hashchange', renderRoute);
    if (!location.hash) history.replaceState(null, '', '#/overview');

    loadWorkspaces().catch((error) => toast(error.message, true));
  </script>
</body>
</html>`;
}
