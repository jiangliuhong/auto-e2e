import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite';
import { AcceptanceRunSchema, type AcceptanceRun } from '../domain/acceptance-run.js';

export interface RunListItem {
  runId: string;
  project: string;
  requirement: string;
  sourceType: AcceptanceRun['source']['type'];
  commit: string | null;
  targetUrl: string;
  status: AcceptanceRun['status'];
  startedAt: string;
  durationMs: number;
  caseCount: number;
  passedCaseCount: number;
  criteriaCount: number;
  passedCriteriaCount: number;
}

export class AcceptanceHistoryStore {
  readonly databasePath: string;

  constructor(projectRoot: string, databasePath = '.auto-e2e/history.sqlite') {
    this.databasePath = path.resolve(projectRoot, databasePath);
  }

  async initialize(): Promise<void> {
    await fs.mkdir(path.dirname(this.databasePath), { recursive: true });
    const db = this.open();
    try {
      db.exec(`
        PRAGMA foreign_keys = ON;
        CREATE TABLE IF NOT EXISTS projects (
          name TEXT PRIMARY KEY,
          last_seen_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS requirements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project TEXT NOT NULL,
          source_type TEXT NOT NULL,
          reference TEXT NOT NULL,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          UNIQUE(project, source_type, reference, content)
        );
        CREATE TABLE IF NOT EXISTS runs (
          run_id TEXT PRIMARY KEY,
          requirement_id INTEGER NOT NULL REFERENCES requirements(id),
          project TEXT NOT NULL,
          commit_hash TEXT,
          target_url TEXT NOT NULL,
          profile TEXT NOT NULL,
          model TEXT NOT NULL,
          session TEXT NOT NULL,
          status TEXT NOT NULL,
          started_at TEXT NOT NULL,
          finished_at TEXT NOT NULL,
          duration_ms INTEGER NOT NULL,
          summary TEXT NOT NULL,
          steps INTEGER NOT NULL,
          proof TEXT,
          error TEXT,
          result_json TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS acceptance_criteria (
          run_id TEXT NOT NULL REFERENCES runs(run_id) ON DELETE CASCADE,
          position INTEGER NOT NULL,
          criterion_id TEXT NOT NULL,
          description TEXT NOT NULL,
          status TEXT NOT NULL,
          actual TEXT NOT NULL,
          proof TEXT,
          PRIMARY KEY(run_id, criterion_id)
        );
        CREATE TABLE IF NOT EXISTS acceptance_cases (
          run_id TEXT NOT NULL REFERENCES runs(run_id) ON DELETE CASCADE,
          position INTEGER NOT NULL,
          case_id TEXT NOT NULL,
          title TEXT NOT NULL,
          status TEXT NOT NULL,
          started_at TEXT NOT NULL,
          finished_at TEXT NOT NULL,
          duration_ms INTEGER NOT NULL,
          summary TEXT NOT NULL,
          steps INTEGER NOT NULL,
          proof TEXT,
          error TEXT,
          result_json TEXT NOT NULL,
          PRIMARY KEY(run_id, case_id)
        );
        CREATE TABLE IF NOT EXISTS artifacts (
          run_id TEXT NOT NULL REFERENCES runs(run_id) ON DELETE CASCADE,
          criterion_id TEXT,
          kind TEXT NOT NULL,
          path TEXT NOT NULL,
          PRIMARY KEY(run_id, kind, path)
        );
        CREATE INDEX IF NOT EXISTS runs_started_at_idx ON runs(started_at DESC);
      `);
    } finally {
      db.close();
    }
  }

  async save(run: AcceptanceRun): Promise<void> {
    const validated = AcceptanceRunSchema.parse(run);
    await this.initialize();
    const db = this.open();
    try {
      db.exec('BEGIN IMMEDIATE');
      db.prepare(`
        INSERT INTO projects(name, last_seen_at) VALUES (?, ?)
        ON CONFLICT(name) DO UPDATE SET last_seen_at = excluded.last_seen_at
      `).run(validated.project, validated.finishedAt);
      db.prepare(`
        INSERT OR IGNORE INTO requirements(project, source_type, reference, title, content)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        validated.project,
        validated.source.type,
        validated.source.reference,
        validated.source.title,
        validated.source.content,
      );
      const requirement = db.prepare(`
        SELECT id FROM requirements
        WHERE project = ? AND source_type = ? AND reference = ? AND content = ?
      `).get(
        validated.project,
        validated.source.type,
        validated.source.reference,
        validated.source.content,
      ) as { id: number };
      db.prepare(`
        INSERT INTO runs(
          run_id, requirement_id, project, commit_hash, target_url, profile, model,
          session, status, started_at, finished_at, duration_ms, summary, steps,
          proof, error, result_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        validated.runId,
        requirement.id,
        validated.project,
        validated.commit,
        validated.targetUrl,
        validated.profile,
        validated.model,
        validated.schemaVersion === 1 ? validated.session : 'suite',
        validated.status,
        validated.startedAt,
        validated.finishedAt,
        validated.durationMs,
        validated.summary,
        validated.steps,
        validated.proof,
        validated.error,
        JSON.stringify(validated),
      );
      const insertCriterion = db.prepare(`
        INSERT INTO acceptance_criteria(
          run_id, position, criterion_id, description, status, actual, proof
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const insertArtifact = db.prepare(`
        INSERT OR IGNORE INTO artifacts(run_id, criterion_id, kind, path) VALUES (?, ?, ?, ?)
      `);
      if (validated.schemaVersion === 1) {
        validated.criteria.forEach((criterion, index) => {
          insertCriterion.run(
            validated.runId,
            index,
            criterion.id,
            criterion.description,
            criterion.status,
            criterion.actual,
            criterion.proof,
          );
          if (criterion.proof) insertArtifact.run(validated.runId, criterion.id, 'proof', criterion.proof);
        });
      } else {
        const insertCase = db.prepare(`
          INSERT INTO acceptance_cases(
            run_id, position, case_id, title, status, started_at, finished_at,
            duration_ms, summary, steps, proof, error, result_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        let criterionPosition = 0;
        validated.cases.forEach((testCase, caseIndex) => {
          insertCase.run(
            validated.runId,
            caseIndex,
            testCase.caseId,
            testCase.source.title,
            testCase.status,
            testCase.startedAt,
            testCase.finishedAt,
            testCase.durationMs,
            testCase.summary,
            testCase.steps,
            testCase.proof,
            testCase.error,
            JSON.stringify(testCase),
          );
          testCase.criteria.forEach((criterion) => {
            const storedCriterionId = `${testCase.caseId}/${criterion.id}`;
            insertCriterion.run(
              validated.runId,
              criterionPosition++,
              storedCriterionId,
              criterion.description,
              criterion.status,
              criterion.actual,
              criterion.proof,
            );
            if (criterion.proof) {
              insertArtifact.run(validated.runId, storedCriterionId, 'proof', criterion.proof);
            }
          });
        });
      }
      if (validated.proof) insertArtifact.run(validated.runId, null, 'proof', validated.proof);
      db.exec('COMMIT');
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch { /* no active transaction */ }
      throw error;
    } finally {
      db.close();
    }
  }

  async list(limit = 50): Promise<RunListItem[]> {
    await this.initialize();
    const db = this.open();
    try {
      const rows = db.prepare(`
        SELECT r.run_id AS runId, r.project, q.title AS requirement,
               q.source_type AS sourceType, r.commit_hash AS "commit",
               r.target_url AS targetUrl, r.status, r.started_at AS startedAt,
               r.duration_ms AS durationMs, r.result_json AS resultJson
        FROM runs r JOIN requirements q ON q.id = r.requirement_id
        ORDER BY r.started_at DESC LIMIT ?
      `).all(Math.max(1, Math.min(Math.trunc(limit), 500))) as unknown as Array<
        Omit<RunListItem, 'caseCount' | 'passedCaseCount' | 'criteriaCount' | 'passedCriteriaCount'> & { resultJson: string }
      >;
      return rows.map(({ resultJson, ...row }) => {
        const run = AcceptanceRunSchema.parse(JSON.parse(resultJson));
        const cases = run.schemaVersion === 1 ? [run] : run.cases;
        const criteria = cases.flatMap((item) => item.criteria);
        return {
          ...row,
          caseCount: cases.length,
          passedCaseCount: cases.filter((item) => item.status === 'passed').length,
          criteriaCount: criteria.length,
          passedCriteriaCount: criteria.filter((item) => item.status === 'passed').length,
        };
      });
    } finally {
      db.close();
    }
  }

  async get(runId: string): Promise<AcceptanceRun | undefined> {
    await this.initialize();
    const db = this.open();
    try {
      const row = db.prepare('SELECT result_json AS resultJson FROM runs WHERE run_id = ?')
        .get(runId) as { resultJson: string } | undefined;
      return row ? AcceptanceRunSchema.parse(JSON.parse(row.resultJson)) : undefined;
    } finally {
      db.close();
    }
  }

  async delete(runId: string): Promise<boolean> {
    await this.initialize();
    const db = this.open();
    try {
      const result = db.prepare('DELETE FROM runs WHERE run_id = ?').run(runId);
      return result.changes > 0;
    } finally {
      db.close();
    }
  }

  private open(): DatabaseSyncType {
    const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
    const db = new DatabaseSync(this.databasePath);
    db.exec('PRAGMA foreign_keys = ON');
    return db;
  }
}
