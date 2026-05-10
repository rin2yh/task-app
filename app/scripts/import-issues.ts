#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ulid } from '../server/db/ulid.ts';

interface GhLabel {
  name?: string;
  color?: string | null;
}

interface GhContent {
  type?: string;
  number?: number;
  title?: string;
  body?: string;
  url?: string;
  state?: string;
  labels?: GhLabel[];
}

interface GhItem {
  id?: string;
  content?: GhContent;
  title?: string;
  [key: string]: unknown;
}

interface ParsedArgs {
  userLogin: string;
  input: string;
  output: string;
  statusField: string;
  priorityField: string;
  dueField: string;
  dryRun: boolean;
  force: boolean;
  remote: boolean;
  env: string;
  binding: string;
}

type Priority = 'low' | 'medium' | 'high';

const DEFAULTS = {
  input: 'tmp/project-items.json',
  output: 'tmp/import.sql',
  statusField: 'Status',
  priorityField: 'Priority',
  dueField: 'Due Date',
  projectName: 'task_project (imported)',
  d1Binding: 'task-app-local',
  noStatus: '(no status)',
  titleMax: 200,
  descriptionMax: 10_000,
  defaultColor: '#999999',
};

function normalizeColor(raw: string | null | undefined): string {
  if (typeof raw !== 'string' || raw.length === 0) return DEFAULTS.defaultColor;
  return /^[0-9a-fA-F]{6}$/.test(raw) ? `#${raw}` : raw;
}

function parseArgs(argv: string[]): ParsedArgs {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a?.startsWith('--')) continue;
    const key = a.slice(2);
    if (key === 'dry-run' || key === 'force' || key === 'remote') {
      out[key] = true;
      continue;
    }
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  const str = (k: string, fallback: string): string =>
    typeof out[k] === 'string' ? (out[k] as string) : fallback;
  return {
    userLogin: str('user-login', ''),
    input: str('input', DEFAULTS.input),
    output: str('output', DEFAULTS.output),
    statusField: str('status-field', DEFAULTS.statusField),
    priorityField: str('priority-field', DEFAULTS.priorityField),
    dueField: str('due-field', DEFAULTS.dueField),
    dryRun: out['dry-run'] === true,
    force: out.force === true,
    remote: out.remote === true,
    env: str('env', ''),
    binding: str('binding', DEFAULTS.d1Binding),
  };
}

function sqlString(s: string | null): string {
  if (s === null) return 'NULL';
  return `'${s.replace(/'/g, "''")}'`;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s;
}

function normalizeKey(s: string): string {
  return s.toLowerCase().replace(/[\s_-]+/g, '');
}

function getField(item: GhItem, fieldName: string): unknown {
  const target = normalizeKey(fieldName);
  for (const [key, value] of Object.entries(item)) {
    if (normalizeKey(key) === target) return value;
  }
  return undefined;
}

function mapPriority(raw: string): Priority {
  const v = raw.toLowerCase().trim();
  if (['urgent', 'critical', 'p0', 'high', '高'].includes(v)) return 'high';
  if (['low', 'p2', '低'].includes(v)) return 'low';
  return 'medium';
}

function getStatus(item: GhItem, fieldName: string): string | null {
  const v = getField(item, fieldName);
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function getDueMs(item: GhItem, fieldName: string): number | null {
  const v = getField(item, fieldName);
  if (typeof v !== 'string' || v.length === 0) return null;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? ms : null;
}

function buildDescription(item: GhItem, skip: Set<string>): string | null {
  const parts: string[] = [];
  const c = item.content;
  if (c?.type === 'Issue' && c.number != null && c.url) {
    parts.push(`[GH #${c.number}] ${c.url}`);
  }
  if (c?.body) parts.push(c.body);

  const fields: string[] = [];
  for (const [key, value] of Object.entries(item)) {
    if (skip.has(normalizeKey(key))) continue;
    if (typeof value === 'string' && value.length > 0) fields.push(`${key}: ${value}`);
    else if (typeof value === 'number') fields.push(`${key}: ${value}`);
  }
  if (fields.length > 0) parts.push(`--- fields ---\n${fields.join('\n')}`);

  if (parts.length === 0) return null;
  return truncate(parts.join('\n\n'), DEFAULTS.descriptionMax);
}

interface BuildResult {
  sql: string;
  columns: number;
  labels: number;
  tasks: number;
  issues: number;
  drafts: number;
}

function buildImportSql(items: GhItem[], ownerId: number, args: ParsedArgs): BuildResult {
  const { statusField, priorityField, dueField } = args;
  const skip = new Set(
    ['id', 'content', 'title', statusField, priorityField, dueField].map(normalizeKey),
  );
  const now = Date.now();
  const projectId = ulid();

  const columnIdByStatus = new Map<string, string>();
  const labelIdByKey = new Map<string, string>();
  const taskPosByColumn = new Map<string, number>();
  const lines: string[] = [];
  let issues = 0;
  let drafts = 0;
  let tasks = 0;
  let nextColumnPos = 1;

  lines.push('BEGIN TRANSACTION;');
  lines.push(
    `INSERT INTO projects (id, owner_id, name, description, created_at, updated_at) VALUES (${sqlString(projectId)}, ${ownerId}, ${sqlString(DEFAULTS.projectName)}, NULL, ${now}, ${now});`,
  );

  for (const item of items) {
    const status = getStatus(item, statusField) ?? DEFAULTS.noStatus;
    let columnId = columnIdByStatus.get(status);
    if (!columnId) {
      columnId = ulid();
      columnIdByStatus.set(status, columnId);
      lines.push(
        `INSERT INTO columns (id, project_id, name, position, created_at) VALUES (${sqlString(columnId)}, ${sqlString(projectId)}, ${sqlString(status)}, ${nextColumnPos++}, ${now});`,
      );
    }

    const itemLabelIds: string[] = [];
    for (const lab of item.content?.labels ?? []) {
      const name = typeof lab.name === 'string' ? lab.name : '';
      if (!name) continue;
      const color = normalizeColor(lab.color);
      const key = `${color}:${name}`;
      let labelId = labelIdByKey.get(key);
      if (!labelId) {
        labelId = ulid();
        labelIdByKey.set(key, labelId);
        lines.push(
          `INSERT INTO labels (id, project_id, name, color) VALUES (${sqlString(labelId)}, ${sqlString(projectId)}, ${sqlString(name)}, ${sqlString(color)});`,
        );
      }
      itemLabelIds.push(labelId);
    }

    const taskId = ulid();
    const title = truncate(item.content?.title ?? item.title ?? '(no title)', DEFAULTS.titleMax);
    const description = buildDescription(item, skip);
    const priorityRaw = getField(item, priorityField);
    const priority: Priority =
      typeof priorityRaw === 'string' ? mapPriority(priorityRaw) : 'medium';
    const due = getDueMs(item, dueField);
    const pos = (taskPosByColumn.get(columnId) ?? 0) + 1;
    taskPosByColumn.set(columnId, pos);

    lines.push(
      `INSERT INTO tasks (id, column_id, title, description, priority, due_date, position, created_at, updated_at) VALUES (${sqlString(taskId)}, ${sqlString(columnId)}, ${sqlString(title)}, ${sqlString(description)}, ${sqlString(priority)}, ${due == null ? 'NULL' : due}, ${pos}, ${now}, ${now});`,
    );
    for (const labelId of itemLabelIds) {
      lines.push(
        `INSERT INTO task_labels (task_id, label_id) VALUES (${sqlString(taskId)}, ${sqlString(labelId)});`,
      );
    }

    tasks++;
    if (item.content?.type === 'Issue') issues++;
    else if (item.content?.type === 'DraftIssue') drafts++;
  }

  lines.push('COMMIT;');
  return {
    sql: `${lines.join('\n')}\n`,
    columns: columnIdByStatus.size,
    labels: labelIdByKey.size,
    tasks,
    issues,
    drafts,
  };
}

function wranglerD1Args(args: ParsedArgs): string[] {
  const head = ['d1', 'execute', args.binding];
  if (args.remote) {
    head.push('--remote');
    if (args.env) head.push('--env', args.env);
  } else {
    head.push('--local');
  }
  return head;
}

function queryDb(sql: string, args: ParsedArgs): unknown[] {
  let out: string;
  try {
    out = execFileSync('wrangler', [...wranglerD1Args(args), '--json', '--command', sql], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    const detail = (err.stderr || err.stdout || '').trim().slice(0, 500) || 'no output';
    const flat = detail.replace(/\r?\n/g, ' ');
    console.error(`::error::wrangler d1 execute (query) exited ${err.status ?? '?'}: ${flat}`);
    throw e;
  }
  const parsed = JSON.parse(out.trim()) as unknown;
  if (Array.isArray(parsed)) {
    const first = parsed[0] as { results?: unknown[] } | undefined;
    if (first && Array.isArray(first.results)) return first.results;
  }
  return [];
}

// GitHub Actions parses lines starting with `::error::` from stdout/stderr
// into job annotations, which (unlike the raw step log) we can read back via
// the check-runs API even when the log host isn't reachable.
function failWithAnnotation(message: string): never {
  console.error(`::error::${message.replace(/\r?\n/g, ' ')}`);
  process.exit(1);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.userLogin) {
    failWithAnnotation(
      'Usage: import-issues --user-login <github_login> [--input PATH] [--output PATH] [--status-field NAME] [--priority-field NAME] [--due-field NAME] [--remote] [--env NAME] [--binding NAME] [--dry-run] [--force]',
    );
  }

  const userRows = queryDb(`SELECT id FROM users WHERE login=${sqlString(args.userLogin)};`, args);
  if (userRows.length === 0) {
    failWithAnnotation(
      `User '${args.userLogin}' not found in target D1 (binding=${args.binding}, env=${args.env || 'local'}). Bootstrap the user row (e.g. via the workflow's "Bootstrap user" step) or log in to the app once before importing.`,
    );
  }
  const ownerRow = userRows[0] as { id?: number };
  if (typeof ownerRow.id !== 'number') {
    failWithAnnotation(
      `Unexpected wrangler response while resolving user id: ${JSON.stringify(ownerRow)}`,
    );
  }

  const existing = queryDb(
    `SELECT id FROM projects WHERE name=${sqlString(DEFAULTS.projectName)};`,
    args,
  );
  if (existing.length > 0 && !args.force) {
    failWithAnnotation(
      `Project '${DEFAULTS.projectName}' already exists in target D1. Re-run with --force to add another copy alongside it.`,
    );
  }

  const inputPath = path.resolve(args.input);
  const raw = await readFile(inputPath, 'utf8');
  const parsedJson = JSON.parse(raw) as { items?: GhItem[] };
  const items = (parsedJson.items ?? []).filter((item) => {
    const t = item.content?.type;
    if (t === 'Issue') return item.content?.state === 'OPEN';
    return t === 'DraftIssue';
  });

  const result = buildImportSql(items, ownerRow.id, args);

  const outputPath = path.resolve(args.output);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, result.sql, 'utf8');

  if (!args.dryRun) {
    try {
      execFileSync('wrangler', [...wranglerD1Args(args), `--file=${outputPath}`], {
        stdio: 'inherit',
      });
    } catch (e) {
      const status = (e as { status?: number }).status;
      failWithAnnotation(
        `wrangler d1 execute --file=${outputPath} exited ${status ?? '?'} (see raw step log for SQL error detail)`,
      );
    }
  }

  console.log(
    `created project=1, columns=${result.columns}, labels=${result.labels}, tasks=${result.tasks} (issues=${result.issues}, drafts=${result.drafts})`,
  );
}

await main();
