# Runtime 输出规范

所有 auto-e2e Runtime 输出都必须写入 `.auto-e2e/`。

外部编码 Agent 应当读取该目录,以了解项目结构、观察结果、执行结果和反馈。

---

## 目录布局

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

描述发现的项目结构。

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

描述发现的静态选择器。

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

描述一个被观察的页面。

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

描述最近一次测试执行。

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

人类可读且 Agent 可读的失败摘要。

应包括:

- 失败的测试名
- 源文件和行号
- 错误信息
- 相关的控制台错误
- 相关的网络错误
- 产物路径
- 建议接下来检查的文件

避免含糊不清的信息。
