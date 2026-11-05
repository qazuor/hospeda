/**
 * @fileoverview
 * GATE:FP.3 / TEST:V8b:8 (owner decision, 2026-11-05): reject destructive
 * statements in SQL migrations added by a phase branch. This is separate from
 * the schema drift guard because schema drift compares the TypeScript schema
 * with migration snapshots, while this guard enforces the phase branch's
 * additive-only deployment contract.
 *
 * It scans only added `.sql` files under `packages/db/src/migrations` since
 * the merge-base with `origin/staging`, and rejects DROP/RENAME of a table or
 * column and column type changes. It does NOT see a pre-existing migration
 * modified in place (only added files are scanned), `ALTER TYPE ... RENAME
 * VALUE` or `DROP TYPE` for enums (Q-4 follows the owner's literal list),
 * `SET NOT NULL` or other tightenings, statements inside `$$...$$` bodies,
 * SQL generated at runtime by TypeScript migrations, or a type change disguised
 * as DROP plus ADD of the same column (the DROP COLUMN itself is rejected).
 *
 * Exit codes: 0 = no destructive added migration; 1 = violation or an
 * unresolvable/unreadable phase-branch comparison.
 */
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** One destructive statement found in an added migration. */
export interface Violation {
    readonly file: string;
    readonly line: number;
    readonly rule:
        | 'DROP_TABLE'
        | 'DROP_COLUMN'
        | 'RENAME_TABLE'
        | 'RENAME_COLUMN'
        | 'CHANGE_COLUMN_TYPE';
    readonly statement: string;
}

interface SqlPart {
    readonly text: string;
    readonly line: number;
}

/** Removes SQL comments and masks strings and quoted identifiers while keeping line breaks. */
function sanitizeSql(sql: string): string {
    let out = '';
    let i = 0;
    while (i < sql.length) {
        const current = sql[i] ?? '';
        const next = sql[i + 1] ?? '';
        if (
            current === '-' &&
            next === '-' &&
            /^-->\s*statement-breakpoint\b/i.test(sql.slice(i))
        ) {
            out += '\u0000';
            i += 2;
            while (i < sql.length && sql[i] !== '\n') i++;
            continue;
        }
        if (current === '-' && next === '-') {
            i += 2;
            while (i < sql.length && sql[i] !== '\n') i++;
            continue;
        }
        if (current === '/' && next === '*') {
            i += 2;
            let depth = 1;
            while (i < sql.length && depth > 0) {
                if (sql[i] === '/' && sql[i + 1] === '*') {
                    depth++;
                    i += 2;
                } else if (sql[i] === '*' && sql[i + 1] === '/') {
                    depth--;
                    i += 2;
                } else {
                    if (sql[i] === '\n') out += '\n';
                    i++;
                }
            }
            continue;
        }
        if (current === "'") {
            out += "''";
            i++;
            while (i < sql.length) {
                if (sql[i] === "'" && sql[i + 1] === "'") {
                    i += 2;
                    continue;
                }
                if (sql[i] === "'") {
                    i++;
                    break;
                }
                if (sql[i] === '\n') out += '\n';
                i++;
            }
            continue;
        }
        if (current === '"') {
            out += '_';
            i++;
            while (i < sql.length) {
                if (sql[i] === '"' && sql[i + 1] === '"') {
                    i += 2;
                    continue;
                }
                if (sql[i] === '"') {
                    i++;
                    break;
                }
                if (sql[i] === '\n') out += '\n';
                i++;
            }
            continue;
        }
        const dollarTag = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i))?.[0];
        if (dollarTag) {
            const bodyStart = i + dollarTag.length;
            const closing = sql.indexOf(dollarTag, bodyStart);
            const end = closing < 0 ? sql.length : closing + dollarTag.length;
            out += "''";
            for (let cursor = i; cursor < end; cursor++) if (sql[cursor] === '\n') out += '\n';
            i = end;
            continue;
        }
        out += current;
        i++;
    }
    return out;
}

/** Splits sanitized SQL at semicolons and Drizzle statement breakpoints. */
function splitStatements(sql: string): readonly SqlPart[] {
    const sanitized = sanitizeSql(sql).replace(/-->\s*STATEMENT-BREAKPOINT/gi, '\u0000');
    const parts: SqlPart[] = [];
    let line = 1;
    let startLine = 1;
    let text = '';
    let hasContent = false;
    const finish = (): void => {
        if (hasContent) parts.push({ text, line: startLine });
        text = '';
        hasContent = false;
        startLine = line;
    };
    for (const char of sanitized) {
        if (char === ';' || char === '\u0000') {
            finish();
            continue;
        }
        if (!hasContent && !/\s/.test(char)) {
            startLine = line;
            hasContent = true;
        }
        text += char;
        if (char === '\n') line++;
    }
    finish();
    return parts;
}

/** Purely finds phase-prohibited statements in one migration's SQL content. */
export function findDestructiveStatements(params: {
    readonly file: string;
    readonly sql: string;
}): readonly Violation[] {
    const violations: Violation[] = [];
    for (const part of splitStatements(params.sql)) {
        const statement = part.text.replace(/\s+/g, ' ').trim().toUpperCase();
        if (!statement) continue;
        const add = (rule: Violation['rule']): void => {
            violations.push({
                file: params.file,
                line: part.line,
                rule,
                statement: statement.slice(0, 180)
            });
        };
        const identifier = '(?:_|[A-Z_][A-Z0-9_$]*)(?:\\.(?:_|[A-Z_][A-Z0-9_$]*))*';
        if (new RegExp(`^DROP\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?${identifier}`).test(statement))
            add('DROP_TABLE');
        const alterTable = new RegExp(`^ALTER\\s+TABLE\\s+${identifier}\\s+`);
        if (!alterTable.test(statement)) continue;
        const actions = statement.replace(alterTable, '').split(/\s*,\s*/);
        for (const action of actions) {
            if (new RegExp(`^DROP\\s+COLUMN\\s+(?:IF\\s+EXISTS\\s+)?${identifier}`).test(action))
                add('DROP_COLUMN');
            if (new RegExp(`^RENAME\\s+TO\\s+${identifier}`).test(action)) add('RENAME_TABLE');
            if (
                new RegExp(`^RENAME\\s+(?:COLUMN\\s+)?${identifier}\\s+TO\\s+${identifier}`).test(
                    action
                )
            )
                add('RENAME_COLUMN');
            if (
                new RegExp(`^ALTER\\s+COLUMN\\s+${identifier}\\s+(?:SET\\s+DATA\\s+)?TYPE\\b`).test(
                    action
                )
            )
                add('CHANGE_COLUMN_TYPE');
        }
    }
    return violations;
}

/** Returns whether CI or the local checkout is running on a phase branch. */
export function isPhaseBranchContext(params: {
    readonly env: Readonly<Record<string, string | undefined>>;
    readonly currentBranch: string;
}): boolean {
    const refs = [
        params.env.GITHUB_BASE_REF,
        params.env.GITHUB_HEAD_REF,
        params.env.GITHUB_REF_NAME
    ];
    if (refs.some((ref) => Boolean(ref))) return refs.some((ref) => ref?.startsWith('epic/'));
    return params.currentBranch.startsWith('epic/');
}

function git(root: string, args: readonly string[]): string {
    return execFileSync('git', [...args], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: 16 * 1024 * 1024
    }).trimEnd();
}

function resolveBase(params: { readonly cwd: string; readonly since?: string }): string {
    if (params.since !== undefined)
        return git(params.cwd, ['rev-parse', '--verify', `${params.since}^{commit}`]);
    try {
        return git(params.cwd, ['merge-base', 'HEAD', 'origin/staging']);
    } catch {
        try {
            git(params.cwd, [
                'fetch',
                '--no-tags',
                'origin',
                '+refs/heads/staging:refs/remotes/origin/staging'
            ]);
            return git(params.cwd, ['merge-base', 'HEAD', 'origin/staging']);
        } catch {
            throw new Error('cannot resolve the base (merge-base with origin/staging)');
        }
    }
}

/** Runs the guard against added migration files from the correct phase base. */
export function run(params: {
    readonly cwd: string;
    readonly env: Readonly<Record<string, string | undefined>>;
    readonly argv: readonly string[];
}): { readonly exitCode: 0 | 1; readonly output: string } {
    const sinceArg = params.argv.find((arg) => arg.startsWith('--since='));
    const since = sinceArg?.slice('--since='.length);
    let currentBranch = '';
    try {
        currentBranch = git(params.cwd, ['branch', '--show-current']);
    } catch {
        // An empty branch name is not phase context unless a CI ref says so.
    }
    if (since === undefined && !isPhaseBranchContext({ env: params.env, currentBranch })) {
        return {
            exitCode: 0,
            output: 'OK: not a phase branch (no epic/* CI ref or local branch) — nothing to check.'
        };
    }

    let base: string;
    try {
        base = resolveBase({ cwd: params.cwd, ...(since === undefined ? {} : { since }) });
    } catch (error) {
        return { exitCode: 1, output: `FAIL: cannot resolve the base: ${String(error)}` };
    }

    let files: string[];
    try {
        files = git(params.cwd, [
            'diff',
            '--no-renames',
            '--name-status',
            '--diff-filter=A',
            base,
            'HEAD',
            '--',
            'packages/db/src/migrations'
        ])
            .split('\n')
            .filter(Boolean)
            .flatMap((row) => {
                const [status, file] = row.split('\t');
                return status === 'A' &&
                    file &&
                    /^packages\/db\/src\/migrations\/(?:extras\/)?[^/]+\.sql$/.test(file)
                    ? [file]
                    : [];
            });
    } catch (error) {
        return { exitCode: 1, output: `FAIL: cannot list added migration files: ${String(error)}` };
    }

    const violations: Violation[] = [];
    for (const file of files) {
        try {
            violations.push(
                ...findDestructiveStatements({
                    file,
                    sql: git(params.cwd, ['show', `HEAD:${file}`])
                })
            );
        } catch {
            return { exitCode: 1, output: `FAIL: cannot read committed migration ${file}` };
        }
    }
    const shortBase = base.slice(0, 12);
    const lines = [`scanned ${files.length} migration file(s) added since ${shortBase}`];
    for (const violation of violations)
        lines.push(
            `${violation.file}:${violation.line}: ${violation.rule}: ${violation.statement}`
        );
    if (violations.length === 0) lines.push('OK: added migrations are additive.');
    return { exitCode: violations.length > 0 ? 1 : 0, output: lines.join('\n') };
}

function isMainScript(): boolean {
    const entry = process.argv[1];
    if (!entry) return false;
    try {
        return fileURLToPath(import.meta.url) === realpathSync(entry);
    } catch {
        return false;
    }
}

if (isMainScript()) {
    const cwd = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const result = run({ cwd, env: process.env, argv: process.argv.slice(2) });
    (result.exitCode === 0 ? console.log : console.error)(result.output);
    process.exit(result.exitCode);
}
