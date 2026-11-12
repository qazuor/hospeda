/**
 * GUARD:G18 — protects the bounded additive grant lane for immutable catalog versions.
 *
 * This static check cannot execute PostgreSQL, resolve dynamic SQL, or prove
 * that a child INSERT's version/key values are safe. It scans only DB migrations
 * and seed data migrations. Migrations numbered 0144 or earlier are exempt as
 * historical catalog publication; those files predate the immutability trigger.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
        )
        .replace(/--[^\n]*/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '');
}

function migrationIsHistorical(file: string): boolean {
    const match = file.match(/(?:^|\/)(\d{4})_[^/]+\.sql$/);
    return match !== null && Number(match[1]) <= 144;
}

export function inspectCatalogAdditiveGrant(args: {
    readonly files: Readonly<Record<string, string>>;
    readonly canonicalFunction: string;
}): Violation[] {
    const canonicalBodies = functionBodies(args.canonicalFunction);
    const canonicalBody = canonicalBodies[0];
    const violations: Violation[] = [];
    for (const [file, sql] of Object.entries(args.files)) {
        if (!file.endsWith('.sql') || migrationIsHistorical(file)) continue;
        const definitions = functionBodies(sql);
        if (definitions.some((body) => body !== canonicalBody)) {
            violations.push({ file, detail: `${FUNCTION_NAME} body differs from extras 041` });
        }
        if (/hospeda\.catalog_versions_created_in_xact/i.test(stripFunctionDefinitions(sql))) {
            violations.push({
                file,
                detail: 'writes catalog_versions_created_in_xact outside the trigger function'
            });
        }
        const childInsert = CHILD_TABLES.some((table) =>
            new RegExp(`INSERT\\s+INTO\\s+["\\x60]?${table}["\\x60]?\\s*\\(`, 'i').test(sql)
        );
        const insertsVersions = /INSERT\s+INTO\s+["`]?\s*(?:plan_version|addon_version)\b/i.test(
            sql
        );
        const hasGrant = /hospeda\.catalog_additive_grant/i.test(sql);
        if (childInsert && !insertsVersions && !hasGrant) {
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
        join(root, 'packages/db/src/migrations'),
        join(root, 'packages/seed/src/data-migrations')
    ];
    const files = Object.fromEntries(
        roots
            .flatMap((directory) => walk(directory))
            .filter((path) => path.endsWith('.sql'))
            .map((path) => [path.slice(root.length + 1), readFileSync(path, 'utf8')])
    );
    const violations = inspectCatalogAdditiveGrant({
        files,
        canonicalFunction: readFileSync(canonicalPath, 'utf8')
    });
    return violations.length
        ? { exitCode: 1, output: violations.map((v) => `G18: ${v.file}: ${v.detail}`).join('\n') }
        : { exitCode: 0, output: `G18: OK; ${Object.keys(files).length} migration files scanned` };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const result = run();
    (result.exitCode === 0 ? console.log : console.error)(result.output);
    process.exit(result.exitCode);
}
