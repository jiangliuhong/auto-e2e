# Runtime Output Specification

All auto-e2e Runtime outputs must be written under `.auto-e2e/`.

External Coding Agents should read this directory to understand project structure, observations, execution results, and feedback.

---

## Directory Layout

```text
.auto-e2e/
├── config.json
├── app-map.json
├── selector-map.json
├── codex-context.md
├── run-result.json
├── failure-summary.md
├── observations/
│   └── <observation-id>/
│       ├── observation.json
│       ├── dom.html
│       ├── screenshot.png
│       ├── console.json
│       └── network.json
└── reports/
    └── <run-id>/
        ├── run-result.json
        ├── failure-summary.md
        └── artifacts/
```

---

## app-map.json

Describes discovered project structure.

```json
{
  "framework": "nextjs",
  "packageManager": "pnpm",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "test:e2e": "playwright test"
  },
  "routes": [
    {
      "path": "/login",
      "source": "src/app/login/page.tsx"
    }
  ],
  "apiRoutes": [],
  "playwright": {
    "configFile": "playwright.config.ts",
    "testDir": "e2e/specs"
  }
}
```

---

## selector-map.json

Describes discovered static selectors.

```json
{
  "items": [
    {
      "source": "src/app/login/page.tsx",
      "kind": "data-testid",
      "value": "login-submit",
      "confidence": 0.95
    }
  ]
}
```

---

## observation.json

Describes an observed page.

```json
{
  "id": "obs_001",
  "url": "/login",
  "finalUrl": "http://localhost:3000/login",
  "title": "Login",
  "status": 200,
  "elements": [
    {
      "kind": "button",
      "text": "Login",
      "role": "button",
      "recommendedSelector": "getByRole('button', { name: 'Login' })"
    }
  ],
  "consoleMessages": [],
  "networkRequests": [],
  "artifacts": {
    "screenshot": ".auto-e2e/observations/obs_001/screenshot.png",
    "dom": ".auto-e2e/observations/obs_001/dom.html"
  }
}
```

---

## run-result.json

Describes the latest test execution.

```json
{
  "runId": "run_001",
  "status": "failed",
  "startedAt": "2026-01-01T00:00:00.000Z",
  "endedAt": "2026-01-01T00:00:10.000Z",
  "summary": {
    "total": 5,
    "passed": 4,
    "failed": 1,
    "skipped": 0
  },
  "failures": [
    {
      "title": "login should succeed",
      "file": "e2e/specs/login.spec.ts",
      "line": 12,
      "message": "Timeout waiting for selector",
      "artifacts": {
        "screenshot": "test-results/login/screenshot.png",
        "trace": "test-results/login/trace.zip"
      }
    }
  ]
}
```

---

## failure-summary.md

Human-readable and Agent-readable failure summary.

Should include:

- failed test name
- source file and line
- error message
- relevant console errors
- relevant network errors
- artifact paths
- suggested next files to inspect

Avoid vague messages.
