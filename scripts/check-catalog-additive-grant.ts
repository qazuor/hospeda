/**
 * GUARD:catalog-additive-grant — protects the bounded additive grant lane.
 *
 * Scope by rule: function-copy comparison sees every non-historical DB migration
 * .sql file; the created-version-setting ban, grant set/reset check, and child
 * INSERT check see those same DB .sql files plus seed data-migration .ts files.
 * The child INSERT check in TypeScript is best effort and sees SQL-like text only.
 * Comments are stripped before checks. This cannot resolve dynamic SQL. A
 * same-file plan_version/addon_version INSERT excuses child inserts in that file,
 * even if it is unrelated; that is a known limit. Migrations numbered 0144 or
 * earlier are exempt as historical catalog publication.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const GUARD_NAME = 'catalog-additive-grant';
const FUNCTION_NAME = 'reject_catalog_child_insert_into_published_version';
const FUNCTION_RE = new RegExp(
    `CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+${FUNCTION_NAME}\\b[\\s\\S]*?\\$\\$([\\s\\S]*?)\\$\\$\\s+LANGUAGE\\s+plpgsql`,
    'ig'
);
const CHILD_TABLES = [
    'plan_version_entitlement',
    'plan_version_limit',
    'addon_version_entitlement',
    'addon_version_limit'
];

export interface Violation {
    readonly file: string;
    readonly detail: string;
}

function walk(root: string): string[] {
    return readdirSync(root).flatMap((name) => {
        const path = join(root, name);
        return statSync(path).isDirectory() ? walk(path) : [path];
    });
}

function stripComments(text: string): string {
    return text.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

function normalize(sql: string): string {
    return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

function functionBodies(sql: string): string[] {
    return [...sql.matchAll(FUNCTION_RE)].map((match) => normalize(match[1] ?? ''));
}

function stripFunctionDefinitions(sql: string): string {
    return sql
        .replace(FUNCTION_RE, '')
        .replace(
            /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+record_catalog_version_created_in_xact\b[\s\S]*?\$\$[\s\S]*?\$\$\s+LANGUAGE\s+plpgsql/gi,
            ''
        );
}

function migrationIsHistorical(file: string): boolean {
    const match = file.match(/(?:^|\/)(\d{4})_[^/]+\.sql$/);
    return match !== null && Number(match[1]) <= 144;
}

function childInsertPattern(table: string): RegExp {
    const identifier = '(?:["`]?[\\w]+["`]?)';
    const quotedTable = `["\\x60]?${table}["\\x60]?`;
    const target = `(?:${identifier}\\s*\\.\\s*)?${quotedTable}`;
    return new RegExp(
        `\\bINSERT\\s+INTO\\s+${target}(?=\\s*(?:\\([^;]*?\\))?\\s+(?:VALUES|SELECT|DEFAULT|WITH)\\b)`,
        'i'
    );
}

function hasChildInsert(sql: string): boolean {
    return CHILD_TABLES.some((table) => childInsertPattern(table).test(sql));
}

function hasVersionInsert(sql: string): boolean {
    return /\bINSERT\s+INTO\s+(?:["`]?\w+["`]?\s*\.\s*)?["`]?\s*(?:plan_version|addon_version)\b/i.test(
        sql
    );
}

function signalSetStatements(sql: string): Array<{ index: number; value: string }> {
    const result: Array<{ index: number; value: string }> = [];
    const re =
        /set_config\s*\(\s*['"]hospeda\.catalog_additive_grant['"]\s*,\s*(['"])(.*?)\1\s*,\s*(?:true|false)\s*\)/gi;
    for (const match of sql.matchAll(re)) {
        result.push({ index: match.index ?? 0, value: match[2] ?? '' });
    }
    return result;
}

export function inspectCatalogAdditiveGrant(args: {
    readonly files: Readonly<Record<string, string>>;
    readonly canonicalFunction: string;
}): Violation[] {
    const canonicalBodies = functionBodies(stripComments(args.canonicalFunction));
    const canonicalBody = canonicalBodies[0];
    const violations: Violation[] = [];
    for (const [file, source] of Object.entries(args.files)) {
        const isSql = file.endsWith('.sql');
        const isSeedTs =
            file.startsWith('packages/seed/src/data-migrations/') && file.endsWith('.ts');
        if ((!isSql && !isSeedTs) || (isSql && migrationIsHistorical(file))) continue;
        const text = stripComments(source);
        if (isSql) {
            const definitions = functionBodies(text);
            if (definitions.some((body) => body !== canonicalBody)) {
                violations.push({ file, detail: `${FUNCTION_NAME} body differs from extras 041` });
            }
        }
        if (/hospeda\.catalog_versions_created_in_xact/i.test(stripFunctionDefinitions(text))) {
            violations.push({
                file,
                detail: 'writes catalog_versions_created_in_xact outside the trigger function'
            });
        }

        const sets = signalSetStatements(text);
        const nonEmptySets = sets.filter(({ value }) => value !== '');
        const childIndexes = CHILD_TABLES.flatMap((table) => {
            const re = childInsertPattern(table);
            return [...text.matchAll(new RegExp(re.source, 'gi'))].map((match) => match.index ?? 0);
        });
        if (nonEmptySets.length > 0) {
            const lastChildInsert = Math.max(-1, ...childIndexes);
            const lastNonEmptySet = Math.max(...nonEmptySets.map(({ index }) => index));
            const resetAfterLastChild = sets.some(
                ({ index, value }) =>
                    value === '' && index > lastChildInsert && index > lastNonEmptySet
            );
            if (!resetAfterLastChild) {
                violations.push({
                    file,
                    detail: 'non-empty additive-grant signal is not reset after the last child INSERT'
                });
            }
        }

        const childInsert = hasChildInsert(text);
        const insertsVersions = hasVersionInsert(text);
        if (childInsert && !insertsVersions && nonEmptySets.length === 0) {
            violations.push({
                file,
                detail: 'child INSERT has neither same-file version INSERT nor additive-grant signal'
            });
        }
    }
    return violations;
}

export function run(root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')): {
    readonly exitCode: number;
    readonly output: string;
} {
    const canonicalPath = join(
        root,
        'packages/db/src/migrations/extras/041-plan-catalog-immutability.trigger.sql'
    );
    const roots = [
        { directory: join(root, 'packages/db/src/migrations'), extensions: ['.sql'] },
        { directory: join(root, 'packages/seed/src/data-migrations'), extensions: ['.ts'] }
    ];
    const files = Object.fromEntries(
        roots
            .flatMap(({ directory }) => walk(directory))
            .filter((path) =>
                roots.some(
                    ({ directory, extensions }) =>
                        path.startsWith(directory) && extensions.some((ext) => path.endsWith(ext))
                )
            )
            .map((path) => [path.slice(root.length + 1), readFileSync(path, 'utf8')])
    );
    const violations = inspectCatalogAdditiveGrant({
        files,
        canonicalFunction: readFileSync(canonicalPath, 'utf8')
    });
    return violations.length
        ? {
              exitCode: 1,
              output: violations.map((v) => `${GUARD_NAME}: ${v.file}: ${v.detail}`).join('\n')
          }
        : {
              exitCode: 0,
              output: `${GUARD_NAME}: OK; ${Object.keys(files).length} migration files scanned`
          };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const result = run();
    (result.exitCode === 0 ? console.log : console.error)(result.output);
    process.exit(result.exitCode);
}
