#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ulid } from '../server/db/ulid';

type GhLabel = { name?: string; color?: string | null };

type GhContent = {
  type?: string;
  number?: number;
  title?: string;
  body?: string;
  url?: string;
  state?: string;
  labels?: GhLabel[];
};

type GhItem = {
  id?: string;
  content?: GhContent;
  title?: string;
  [key: string]: unknown;
};

type ParsedArgs = {
  userLogin: string;
  input: string;
  output: string;
  statusField: string;
  priorityField: string;
  dueField: string;
  dryRun: boolean;
  force: boolean;
};

type Priority = 'low' | 'medium' | 'high';

type LabelEntry = { id: string; name: string; color: string };

type ColumnEntry = { id: string; name: string; position: number };

type BuildOpts = {
  items: GhItem[];
  ownerId: number;
  now: number;
  projectName: string;
  statusField: string;
  priorityField: string;
  dueField: string;
};

type BuildResult = {
  sql: string;
  columns: number;
  labels: number;
  tasks: number;
  issues: number;
  drafts: number;
};

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
  defaultColor: '999999',
};

function parseArgs(argv: string[]): ParsedArgs {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a || !a.startsWith('--')) continue;
    const key = a.slice(2);
    if (key === 'dry-run' || key === 'force') {
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
  const userLogin = typeof out['user-login'] === 'string' ? out['user-login'] : '';
  return {
    userLogin,
    input: typeof out.input === 'string' ? out.input : DEFAULTS.input,
    output: typeof out.output === 'string' ? out.output : DEFAULTS.output,
    statusField:
      typeof out['status-field'] === 'string' ? out['status-field'] : DEFAULTS.statusField,
    priorityField:
      typeof out['priority-field'] === 'string' ? out['priority-field'] : DEFAULTS.priorityField,
    dueField: typeof out['due-field'] === 'string' ? out['due-field'] : DEFAULTS.dueField,
    dryRun: out['dry-run'] === true,
    force: out.force === true,
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

function findField(item: GhItem, fieldName: string): { key: string; value: unknown } | undefined {
  const target = normalizeKey(fieldName);
  for (const [key, value] of Object.entries(item)) {
    if (normalizeKey(key) === target) return { key, value };
  }
  return undefined;
}

function mapPriority(raw: string | null | undefined): Priority {
  if (!raw) return 'medium';
  const v = raw.toLowerCase().trim();
  if (['urgent', 'critical', 'p0', 'high', '高'].includes(v)) return 'high';
  if (['medium', 'normal', 'p1', '中'].includes(v)) return 'medium';
  if (['low', 'p2', '低'].includes(v)) return 'low';
  return 'medium';
}

function getStatus(item: GhItem, statusField: string): string | null {
  const f = findField(item, statusField);
  if (!f) return null;
  if (typeof f.value === 'string' && f.value.length > 0) return f.value;
  return null;
}

function getPriority(item: GhItem, priorityField: string): Priority {
  const f = findField(item, priorityField);
  if (!f || typeof f.value !== 'string') return 'medium';
  return mapPriority(f.value);
}

function getDueMs(item: GhItem, dueField: string): number | null {
  const f = findField(item, dueField);
  if (!f) return null;
  if (typeof f.value === 'string' && f.value.length > 0) {
    const ms = Date.parse(f.value);
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

function buildOtherFieldLines(item: GhItem, skipNames: string[]): string[] {
  const skip = new Set(skipNames.map(normalizeKey));
  const lines: string[] = [];
  for (const [key, value] of Object.entries(item)) {
    if (skip.has(normalizeKey(key))) continue;
    if (typeof value === 'string') {
      if (value.length > 0) lines.push(`${key}: ${value}`);
    } else if (typeof value === 'number') {
      lines.push(`${key}: ${value}`);
    }
  }
  return lines;
}

function buildTitle(item: GhItem): string {
  const t = item.content?.title ?? item.title ?? '(no title)';
  return truncate(t, DEFAULTS.titleMax);
}

function buildDescription(item: GhItem, skipNames: string[]): string | null {
  const content = item.content;
  const parts: string[] = [];
  if (content?.type === 'Issue' && content.number != null && content.url) {
    parts.push(`[GH #${content.number}] ${content.url}`);
  }
  const body = content?.body ?? '';
  if (body.length > 0) parts.push(body);
  const fields = buildOtherFieldLines(item, skipNames);
  if (fields.length > 0) parts.push(`--- fields ---\n${fields.join('\n')}`);
  if (parts.length === 0) return null;
  return truncate(parts.join('\n\n'), DEFAULTS.descriptionMax);
}

function buildImportSql(opts: BuildOpts): BuildResult {
  const { items, ownerId, now, projectName, statusField, priorityField, dueField } = opts;
  const skipNames = ['id', 'content', 'title', statusField, priorityField, dueField];

  const projectId = ulid();
  const columnsByStatus = new Map<string, ColumnEntry>();
  const labelByKey = new Map<string, LabelEntry>();
  const lines: string[] = [];

  lines.push('BEGIN TRANSACTION;');
  lines.push(
    `INSERT INTO projects (id, owner_id, name, description, created_at, updated_at) VALUES (${sqlString(projectId)}, ${ownerId}, ${sqlString(projectName)}, NULL, ${now}, ${now});`,
  );

  let columnPosition = 1;
  for (const item of items) {
    const status = getStatus(item, statusField) ?? DEFAULTS.noStatus;
    if (!columnsByStatus.has(status)) {
      const col: ColumnEntry = { id: ulid(), name: status, position: columnPosition++ };
      columnsByStatus.set(status, col);
      lines.push(
        `INSERT INTO columns (id, project_id, name, position, created_at) VALUES (${sqlString(col.id)}, ${sqlString(projectId)}, ${sqlString(col.name)}, ${col.position}, ${now});`,
      );
    }
  }

  for (const item of items) {
    const labels = item.content?.labels ?? [];
    for (const lab of labels) {
      const name = typeof lab.name === 'string' ? lab.name : '';
      if (name.length === 0) continue;
      const color =
        typeof lab.color === 'string' && lab.color.length > 0 ? lab.color : DEFAULTS.defaultColor;
      const key = `${color}:${name}`;
      if (!labelByKey.has(key)) {
        const entry: LabelEntry = { id: ulid(), name, color };
        labelByKey.set(key, entry);
        lines.push(
          `INSERT INTO labels (id, project_id, name, color) VALUES (${sqlString(entry.id)}, ${sqlString(projectId)}, ${sqlString(entry.name)}, ${sqlString(entry.color)});`,
        );
      }
    }
  }

  const taskPositionByColumn = new Map<string, number>();
  let issues = 0;
  let drafts = 0;
  let tasks = 0;

  for (const item of items) {
    const status = getStatus(item, statusField) ?? DEFAULTS.noStatus;
    const column = columnsByStatus.get(status);
    if (!column) continue;
    const taskId = ulid();
    const title = buildTitle(item);
    const description = buildDescription(item, skipNames);
    const priority = getPriority(item, priorityField);
    const due = getDueMs(item, dueField);
    const pos = (taskPositionByColumn.get(column.id) ?? 0) + 1;
    taskPositionByColumn.set(column.id, pos);

    lines.push(
      `INSERT INTO tasks (id, column_id, title, description, priority, due_date, position, created_at, updated_at) VALUES (${sqlString(taskId)}, ${sqlString(column.id)}, ${sqlString(title)}, ${sqlString(description)}, ${sqlString(priority)}, ${due == null ? 'NULL' : due}, ${pos}, ${now}, ${now});`,
    );

    const labels = item.content?.labels ?? [];
    for (const lab of labels) {
      const name = typeof lab.name === 'string' ? lab.name : '';
      if (name.length === 0) continue;
      const color =
        typeof lab.color === 'string' && lab.color.length > 0 ? lab.color : DEFAULTS.defaultColor;
      const key = `${color}:${name}`;
      const entry = labelByKey.get(key);
      if (!entry) continue;
      lines.push(
        `INSERT INTO task_labels (task_id, label_id) VALUES (${sqlString(taskId)}, ${sqlString(entry.id)});`,
      );
    }

    tasks++;
    if (item.content?.type === 'Issue') issues++;
    else if (item.content?.type === 'DraftIssue') drafts++;
  }

  lines.push('COMMIT;');

  return {
    sql: `${lines.join('\n')}\n`,
    columns: columnsByStatus.size,
    labels: labelByKey.size,
    tasks,
    issues,
    drafts,
  };
}

function runWranglerCapture(args: string[]): string {
  return execFileSync('wrangler', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function runWranglerInherit(args: string[]): void {
  execFileSync('wrangler', args, { stdio: 'inherit' });
}

function parseWranglerJson(text: string): unknown[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.trim());
  } catch {
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error(`Failed to parse wrangler JSON output: ${text}`);
    parsed = JSON.parse(match[0]);
  }
  if (Array.isArray(parsed)) {
    const first = parsed[0] as { results?: unknown[] } | undefined;
    if (first && Array.isArray(first.results)) return first.results;
  }
  return [];
}

function queryDb(sql: string): unknown[] {
  const out = runWranglerCapture([
    'd1',
    'execute',
    DEFAULTS.d1Binding,
    '--local',
    '--json',
    '--command',
    sql,
  ]);
  return parseWranglerJson(out);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.userLogin) {
    console.error(
      'Usage: import-issues --user-login <github_login> [--input PATH] [--output PATH] [--status-field NAME] [--priority-field NAME] [--due-field NAME] [--dry-run] [--force]',
    );
    process.exit(1);
  }

  const userRows = queryDb(`SELECT id FROM users WHERE login=${sqlString(args.userLogin)};`);
  if (userRows.length === 0) {
    console.error(
      `User not found: ${args.userLogin}. Log in to the local app once before importing.`,
    );
    process.exit(1);
  }
  const ownerRow = userRows[0] as { id?: number };
  if (typeof ownerRow.id !== 'number') {
    console.error(
      `Unexpected wrangler response while resolving user id: ${JSON.stringify(ownerRow)}`,
    );
    process.exit(1);
  }
  const ownerId = ownerRow.id;

  const projectName = DEFAULTS.projectName;
  const existing = queryDb(`SELECT id FROM projects WHERE name=${sqlString(projectName)};`);
  if (existing.length > 0 && !args.force) {
    console.error(
      `Project '${projectName}' already exists. Re-run with --force to add another copy alongside it.`,
    );
    process.exit(1);
  }

  const inputPath = path.resolve(args.input);
  const raw = await readFile(inputPath, 'utf8');
  const parsedJson = JSON.parse(raw) as { items?: GhItem[] };
  const allItems = parsedJson.items ?? [];

  const items = allItems.filter((item) => {
    const t = item.content?.type;
    if (t === 'PullRequest') return false;
    if (t === 'Issue') return item.content?.state === 'OPEN';
    if (t === 'DraftIssue') return true;
    return false;
  });

  const result = buildImportSql({
    items,
    ownerId,
    now: Date.now(),
    projectName,
    statusField: args.statusField,
    priorityField: args.priorityField,
    dueField: args.dueField,
  });

  const outputPath = path.resolve(args.output);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, result.sql, 'utf8');

  if (!args.dryRun) {
    runWranglerInherit(['d1', 'execute', DEFAULTS.d1Binding, '--local', `--file=${outputPath}`]);
  }

  console.log(
    `created project=1, columns=${result.columns}, labels=${result.labels}, tasks=${result.tasks} (issues=${result.issues}, drafts=${result.drafts})`,
  );
}

await main();
