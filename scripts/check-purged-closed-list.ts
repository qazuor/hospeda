/**
 * GUARD:G-R9 (HOS-1476, AC:V6:14) — every table hanging from a listing has a row in the
 * PURGED closed list (`scripts/guards/purged-closed-list.json`, from
 * `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md` §4.1).
 *
 * What it does: walks the `.ts` files of `packages/db/src/schemas/` listed by git and, with
 * the TypeScript AST, takes every `pgTable('<name>', ...)` that
 * (a) has a `references(() => <listing>.<column>)` to `accommodations`, `gastronomies` or
 *     `experiences`, however the formatter splits it across lines;
 * (b) declares a `foreignKey({ foreignColumns: [<listing>.<column>, ...] })`; or
 * (c) has a column whose SQL name is the literal `'entity_type'`, whatever its constructor.
 * It fails when one of those tables has no row in the closed list.
 *
 * What it does NOT verify:
 * - that the treatment each row declares (`inPurged`) is the correct one, or that PB9/PB12
 *   apply it: it only says no table hanging from a listing was left without a row;
 * - the cutover passage table (`cutover_v6_deleted_listing`): it lives only in the SQL of the
 *   cutover migration, outside the Drizzle schema, and is not part of this walk;
 * - that every row of the list is found by the walk: a row the walk does not see (e.g.
 *   `addon_instance`, a polymorphic target with neither FK nor `entity_type`) is not an error.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

/** The three listing tables (SQL and Drizzle export names coincide). */
export const LISTING_TABLES = ['accommodations', 'venues', 'experiences'] as const;

/** Fewer schema files than this means the walk looked at the wrong tree. */
export const MIN_SCANNED_FILES = 100;

/** Path of the PURGED closed list, relative to the repository root. */
export const PURGED_LIST_PATH = 'scripts/guards/purged-closed-list.json';

const SCHEMA_ROOT = /^packages\/db\/src\/schemas\//;
const CODE_FILE = /\.ts$/;
const TEST_FILE = /(?:\.(?:test|spec)\.ts$)|(?:^|\/)(?:test|tests|__tests__)\//;
const LISTING_SET: ReadonlySet<string> = new Set(LISTING_TABLES);
const HANGS_BY = new Set(['fk', 'entity_type', 'none']);

/** Why a table hangs from a listing. */
export type HangingReason =
    | { readonly kind: 'fk'; readonly target: (typeof LISTING_TABLES)[number] }
    | { readonly kind: 'entity_type' };

/** A table of a schema file that hangs from a listing. */
export type HangingTable = {
    readonly table: string;
    readonly file: string;
    readonly line: number;
    readonly reason: HangingReason;
};

function literalText(node: ts.Node | undefined): string | null {
    if (!node) return null;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    return null;
}

function unwrap(node: ts.Expression): ts.Expression {
    let current = node;
    while (ts.isParenthesizedExpression(current) || ts.isAsExpression(current)) {
        current = current.expression;
    }
    return current;
}

function listingOf(node: ts.Expression | undefined): (typeof LISTING_TABLES)[number] | null {
    if (!node) return null;
    const target = unwrap(node);
    if (!ts.isPropertyAccessExpression(target)) return null;
    const owner = unwrap(target.expression);
    if (!ts.isIdentifier(owner) || !LISTING_SET.has(owner.text)) return null;
    return owner.text as (typeof LISTING_TABLES)[number];
}

function arrowTarget(node: ts.Expression | undefined): ts.Expression | undefined {
    if (!node) return undefined;
    const fn = unwrap(node);
    if (!ts.isArrowFunction(fn) && !ts.isFunctionExpression(fn)) return undefined;
    if (!ts.isBlock(fn.body)) return fn.body;
    const ret = fn.body.statements.find(ts.isReturnStatement);
    return ret?.expression;
}

function calleeName(call: ts.CallExpression): string | null {
    const callee = call.expression;
    if (ts.isIdentifier(callee)) return callee.text;
    if (ts.isPropertyAccessExpression(callee)) return callee.name.text;
    return null;
}

function reasonOf(call: ts.CallExpression): HangingReason | null {
    const name = calleeName(call);
    if (name === 'references') {
        const target = listingOf(arrowTarget(call.arguments[0]));
        if (target) return { kind: 'fk', target };
    }
    if (name === 'foreignKey') {
        const config = call.arguments[0] ? unwrap(call.arguments[0]) : undefined;
        if (config && ts.isObjectLiteralExpression(config)) {
            for (const prop of config.properties) {
                if (!ts.isPropertyAssignment(prop)) continue;
                if (!ts.isIdentifier(prop.name) || prop.name.text !== 'foreignColumns') continue;
                const columns = unwrap(prop.initializer);
                if (!ts.isArrayLiteralExpression(columns)) continue;
                for (const column of columns.elements) {
                    const target = listingOf(column);
                    if (target) return { kind: 'fk', target };
                }
            }
        }
    }
    if (ts.isIdentifier(call.expression) && literalText(call.arguments[0]) === 'entity_type') {
        return { kind: 'entity_type' };
    }
    return null;
}

/**
 * Returns, for every `pgTable(...)` of one schema file, whether it hangs from a listing and
 * why. Each finding is attributed to the `pgTable(...)` call that contains it; an FK wins
 * over `entity_type` when a table has both.
 *
 * @param args.file - repository-relative path, used in the result
 * @param args.source - the file's source text
 * @returns the hanging tables of the file, with the line of the first finding
 */
export function findHangingTables(args: {
    readonly file: string;
    readonly source: string;
}): readonly HangingTable[] {
    const sourceFile = ts.createSourceFile(args.file, args.source, ts.ScriptTarget.Latest, true);
    const found = new Map<string, HangingTable>();
    const lineOf = (node: ts.Node) =>
        sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;

    function record(table: string, node: ts.Node, reason: HangingReason): void {
        const previous = found.get(table);
        if (previous && (previous.reason.kind === 'fk' || reason.kind === 'entity_type')) return;
        found.set(table, { table, file: args.file, line: lineOf(node), reason });
    }

    function visit(node: ts.Node, table: string | null): void {
        let current = table;
        if (ts.isCallExpression(node)) {
            if (ts.isIdentifier(node.expression) && node.expression.text === 'pgTable') {
                current = literalText(node.arguments[0]) ?? current;
            } else if (current) {
                const reason = reasonOf(node);
                if (reason) record(current, node, reason);
            }
        }
        ts.forEachChild(node, (child) => visit(child, current));
    }
    visit(sourceFile, null);
    return [...found.values()];
}

type ListRow = { readonly table: string; readonly hangsBy: string; readonly spec: string };

function loadList(path: string): { readonly rows?: readonly ListRow[]; readonly error?: string } {
    let parsed: unknown;
    try {
        parsed = JSON.parse(readFileSync(path, 'utf8'));
    } catch (error) {
        return { error: `cannot load ${PURGED_LIST_PATH}: ${(error as Error).message}` };
    }
    if (!Array.isArray(parsed)) return { error: `${PURGED_LIST_PATH} is not an array` };
    const rows: ListRow[] = [];
    const seen = new Set<string>();
    for (const [index, raw] of parsed.entries()) {
        const row = raw as Partial<Record<string, unknown>> | null;
        const table = typeof row?.table === 'string' ? row.table.trim() : '';
        const spec = typeof row?.spec === 'string' ? row.spec.trim() : '';
        const hangsBy = typeof row?.hangsBy === 'string' ? row.hangsBy : '';
        if (!table || !spec) {
            return { error: `${PURGED_LIST_PATH} row ${index} has no table or no spec` };
        }
        if (!HANGS_BY.has(hangsBy)) {
            return { error: `${PURGED_LIST_PATH} row ${index} (${table}) has an invalid hangsBy` };
        }
        if (seen.has(table)) return { error: `${PURGED_LIST_PATH} repeats table ${table}` };
        seen.add(table);
        rows.push({ table, hangsBy, spec });
    }
    return { rows };
}

function listSchemaFiles(root: string): readonly string[] {
    const output = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024
    });
    return output
        .split('\0')
        .filter(Boolean)
        .filter((file) => SCHEMA_ROOT.test(file) && CODE_FILE.test(file) && !TEST_FILE.test(file))
        .filter((file) => existsSync(join(root, file)));
}

function describeReason(reason: HangingReason): string {
    return reason.kind === 'fk' ? `fk -> ${reason.target}` : 'entity_type';
}

/**
 * Runs GUARD:G-R9 over a repository tree.
 *
 * @param args.root - repository root (defaults to this repository)
 * @param args.listPath - absolute path of the closed list (defaults to `<root>/scripts/guards/...`)
 * @param args.minScannedFiles - minimum number of schema files the walk must see
 * @returns the exit code and the text to print
 */
export function run(
    args: {
        readonly root?: string;
        readonly listPath?: string;
        readonly minScannedFiles?: number;
    } = {}
): { readonly exitCode: number; readonly output: string } {
    const root = args.root ?? resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
    const minScannedFiles = args.minScannedFiles ?? MIN_SCANNED_FILES;
    const files = listSchemaFiles(root);
    if (files.length < minScannedFiles) {
        return {
            exitCode: 1,
            output: `FAIL GUARD:G-R9: scanned ${files.length} schema files; expected at least ${minScannedFiles}`
        };
    }
    const list = loadList(args.listPath ?? join(root, PURGED_LIST_PATH));
    if (!list.rows) return { exitCode: 1, output: `FAIL GUARD:G-R9: ${list.error}` };
    const listed = new Set(list.rows.map((row) => row.table));
    const hanging = files.flatMap((file) =>
        findHangingTables({ file, source: readFileSync(join(root, file), 'utf8') })
    );
    const missing = hanging.filter((entry) => !listed.has(entry.table));
    if (missing.length > 0) {
        return {
            exitCode: 1,
            output: missing
                .map(
                    (entry) =>
                        `FAIL GUARD:G-R9: ${entry.file}:${entry.line} table ${entry.table} hangs from a listing (${describeReason(entry.reason)}) and has no row in the PURGED closed list (${PURGED_LIST_PATH})`
                )
                .join('\n')
        };
    }
    const byFk = hanging.filter((entry) => entry.reason.kind === 'fk').length;
    const byEntityType = hanging.length - byFk;
    return {
        exitCode: 0,
        output: `OK GUARD:G-R9: ${files.length} schema files scanned; ${byFk} tables hang by FK and ${byEntityType} by entity_type; all in the PURGED closed list (${list.rows.length} rows)`
    };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const result = run();
    (result.exitCode === 0 ? console.log : console.error)(result.output);
    process.exit(result.exitCode);
}
