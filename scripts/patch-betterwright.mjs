import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const packageFile = require.resolve('betterwright/package.json');
const agentFile = path.join(path.dirname(packageFile), 'dist', 'src', 'agent.js');
const supportedVersion = '1.10.2';
const marker = 'BETTERWRIGHT_TRANSIENT_MODEL_RESPONSE';
const patchedFragments = [
  `this.code = "${marker}"`,
  'Responses stream ended before response.completed',
  'Responses endpoint returned an empty body',
  'Responses endpoint returned incomplete JSON',
];

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first === -1) throw new Error(`BetterWright patch target not found: ${label}`);
  if (source.indexOf(before, first + before.length) !== -1) {
    throw new Error(`BetterWright patch target is ambiguous: ${label}`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

async function applyPatch() {
  const manifest = JSON.parse(await fs.readFile(packageFile, 'utf8'));
  if (manifest.version !== supportedVersion) {
    throw new Error(
      `Unsupported BetterWright version ${String(manifest.version)}; expected ${supportedVersion}. ` +
      'Review whether the response truncation fix is still required before updating the pin.',
    );
  }

  let source = await fs.readFile(agentFile, 'utf8');
  if (source.includes(marker)) {
    const missing = patchedFragments.filter((fragment) => !source.includes(fragment));
    if (missing.length > 0) {
      throw new Error(`BetterWright response patch is incomplete: missing ${missing.join(', ')}`);
    }
    process.stdout.write(`BetterWright ${supportedVersion} response patch already applied.\n`);
    return;
  }

  source = replaceOnce(
    source,
    `// Retry only what can plausibly succeed on a second try: rate limits,\n// server-side failures, and network-level drops. Client errors (400/401/403),\n// refusals, and programming mistakes are not transient and must surface.\nfunction isTransientModelError(error) {\n    const status = statusFromModelError(error);`,
    `// An empty or truncated successful Responses payload is normally caused by a\n// dropped response body. Keep it distinct from arbitrary SyntaxErrors so only the\n// safe model request is retried, never an already executed browser action.\nclass TransientModelResponseError extends Error {\n    constructor(message, options = {}) {\n        super(message, options);\n        this.name = "TransientModelResponseError";\n        this.code = "${marker}";\n    }\n}\n// Retry only what can plausibly succeed on a second try: rate limits,\n// server-side failures, and network-level drops. Client errors (400/401/403),\n// refusals, and programming mistakes are not transient and must surface.\nfunction isTransientModelError(error) {\n    if (untrustedField(error, "code") === "${marker}")\n        return true;\n    const status = statusFromModelError(error);`,
    'transient response error classification',
  );

  source = replaceOnce(
    source,
    `    const fallback = parseResponsesOutput(completed?.output);\n    return {\n        text: text || fallback.text,`,
    `    if (!completed) {\n        throw new TransientModelResponseError("Responses stream ended before response.completed");\n    }\n    const fallback = parseResponsesOutput(completed.output);\n    return {\n        text: text || fallback.text,`,
    'incomplete Responses stream handling',
  );

  source = replaceOnce(
    source,
    `            const raw = await response.text().catch(() => "");\n            if (!response.ok) {\n                throw new Error(\`${'${options.name || "responses"}'} request failed (${'${response.status}'}): ${'${raw.slice(0, 500)}'}\`);\n            }\n            if (/^(?:event|data):/m.test(raw))\n                return parseResponsesStream(raw);\n            const data = JSON.parse(raw);`,
    `            let raw;\n            try {\n                raw = await response.text();\n            }\n            catch (cause) {\n                throw new TransientModelResponseError("Responses body could not be read", { cause });\n            }\n            if (!response.ok) {\n                throw new Error(\`${'${options.name || "responses"}'} request failed (${'${response.status}'}): ${'${raw.slice(0, 500)}'}\`);\n            }\n            if (!raw.trim()) {\n                throw new TransientModelResponseError("Responses endpoint returned an empty body");\n            }\n            if (/^(?:event|data):/m.test(raw))\n                return parseResponsesStream(raw);\n            let data;\n            try {\n                data = JSON.parse(raw);\n            }\n            catch (cause) {\n                throw new TransientModelResponseError("Responses endpoint returned incomplete JSON", { cause });\n            }`,
    'Responses body parsing',
  );

  await fs.writeFile(agentFile, source, 'utf8');
  process.stdout.write(`Applied BetterWright ${supportedVersion} response truncation patch.\n`);
}

await applyPatch();
