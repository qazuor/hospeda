/**
 * AC:V6:25 (HOS-1477) — no listing delete or restore door outside the design.
 *
 * What it asserts: only PB12 (the owner, `POST /protected/{plural}/{id}/purge`) and action 23
 * (support at the owner's request, `POST /admin/{plural}/{id}/purge`) delete a listing; there is
 * no hard delete of listings or accounts, and no listing restore.
 * Source: `.specs/HOS-1352-billing-verticals-redesign/spec-consolidada/10-corte/V6.md:613-622`
 * (AC:V6:25). The inventory of doors lives in `scripts/guards/listing-delete-doors.json`; each of
 * its rows cites the spec lines that place it (`V/descomposicion.md` §2.13 and the closed rule of
 * `03-maquinas-de-estado.md:541-545`).
 *
 * Predicates (each failure names its own):
 * - (p1) no `retired[].file` exists in the tree (`git ls-files -co --exclude-standard`);
 * - (p2) in the direct `.ts` children of `apps/api/src/routes/{accommodation,gastronomy,experience}/
 *   {admin,protected}/`, no route config (the first argument of a `create*Route(...)` call) has
 *   `method: 'delete'` with `path: '/{id}'` or `'/{id}/hard'`, nor `path: '/{id}/restore'` with any
 *   method; and in `apps/api/src/routes/user/admin/`, none has `path: '/{id}/hard'`;
 * - (p3) every `kept[].file` exists and declares `method: 'post'` with `path: '/{id}/purge'`;
 * - (p4) in the `.ts`/`.tsx` sources of `apps/*\/src` and `packages/*\/src` (tests excluded), no
 *   call `softDelete`, `hardDelete`, `restore` or `softDeleteOwnDraft` on a listing service or
 *   model, no `hardDelete` on the user service or model, and no class declares a
 *   `softDeleteOwnDraft` method.
 *
 * What it does NOT verify:
 * - routes registered outside the walked folders: TEST:V6:33 (a) asserts that over `initApp()`;
 * - an aliased receiver (`const s = accommodationService; s.softDelete(...)`), a computed member
 *   (`accommodationService['softDelete'](...)`) or a route config built outside the call;
 * - the soft delete and the restore of ACCOUNTS (`outOfScope`: action 24, HOS-1494, and notas H2);
 * - the routes of the Better Auth plugin (V5);
 * - the revalidation each transition schedules: TEST:V6:33 (c) proves that, not this guard.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

/** Fewer route files than this means the walk looked at the wrong tree. */
export const MIN_SCANNED_FILES = 100;

/** Path of the doors inventory, relative to the repository root. */
export const DOORS_INVENTORY_PATH = 'scripts/guards/listing-delete-doors.json';

const LISTING_ROUTE_DIR =
    /^apps\/api\/src\/routes\/(?:accommodation|gastronomy|experience)\/(?:admin|protected)\/[^/]+\.ts$/;
const USER_ADMIN_ROUTE_DIR = /^apps\/api\/src\/routes\/user\/admin\/[^/]+\.ts$/;
const SOURCE_FILE = /^(?:apps|packages)\/[^/]+\/src\/.+\.tsx?$/;
const TEST_FILE = /(?:\.(?:test|spec)\.tsx?$)|(?:^|\/)(?:test|tests|__tests__)\//;
const ROUTE_FACTORY = /^create\w*Route$/;
const LISTING_RECEIVERS: ReadonlySet<string> = new Set([
    'accommodationservice',
    'gastronomyservice',
    'experienceservice',
    'accommodationmodel',
    'gastronomymodel',
    'venuemodel',
    'experiencemodel'
]);
const LISTING_CLASS = /^(?:Accommodation|Gastronomy|Experience)(?:Service|Model)$|^VenueModel$/;
const USER_RECEIVERS: ReadonlySet<string> = new Set(['userservice', 'usermodel']);
const USER_CLASS = /^User(?:Service|Model)$/;
const LISTING_METHODS: ReadonlySet<string> = new Set([
    'softDelete',
    'hardDelete',
    'restore',
    'softDeleteOwnDraft'
]);
const CALL_HINT = /softDelete|hardDelete|restore/;

/** One row of the doors inventory. */
export type DoorRow = {
    readonly file: string;
    readonly method: string;
    readonly path: string;
    readonly door: string;
    readonly source: string;
    readonly spec: readonly string[];
};

/** The doors inventory: retired doors, the six that stay, and the account doors out of scope. */
export type DoorsInventory = {
    readonly retired: readonly DoorRow[];
    readonly kept: readonly DoorRow[];
    readonly outOfScope: readonly DoorRow[];
};

/** A finding of one predicate. */
export type DoorFinding = { readonly file: string; readonly line: number; readonly what: string };

function literalText(node: ts.Node | undefined): string | null {
    if (!node) return null;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    return null;
}

function unwrap(node: ts.Expression): ts.Expression {
    let current = node;
    while (
        ts.isParenthesizedExpression(current) ||
        ts.isAsExpression(current) ||
        ts.isNonNullExpression(current) ||
        ts.isSatisfiesExpression(current)
    ) {
        current = current.expression;
    }
    return current;
}

function lineOf(sourceFile: ts.SourceFile, node: ts.Node): number {
    return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function propertyText(config: ts.ObjectLiteralExpression, name: string): string | null {
    for (const prop of config.properties) {
        if (!ts.isPropertyAssignment(prop)) continue;
        const key = ts.isIdentifier(prop.name) ? prop.name.text : literalText(prop.name);
        if (key === name) return literalText(unwrap(prop.initializer));
    }
    return null;
}

/** A route config found in a file: the first object argument of a `create*Route(...)` call. */
export type RouteConfig = {
    readonly method: string | null;
    readonly path: string | null;
    readonly line: number;
};

/**
 * Returns the route configs of one file, read with the TypeScript AST.
 *
 * @param args.file - repository-relative path (used only to name the source file)
 * @param args.source - the file's source text
 * @returns each `create*Route({...})` config with its literal `method`, `path` and line
 */
export function findRouteConfigs(args: {
    readonly file: string;
    readonly source: string;
}): readonly RouteConfig[] {
    const sourceFile = ts.createSourceFile(args.file, args.source, ts.ScriptTarget.Latest, true);
    const configs: RouteConfig[] = [];
    function visit(node: ts.Node): void {
        if (ts.isCallExpression(node)) {
            const callee = node.expression;
            const name = ts.isIdentifier(callee)
                ? callee.text
                : ts.isPropertyAccessExpression(callee)
                  ? callee.name.text
                  : null;
            const first = node.arguments[0] ? unwrap(node.arguments[0]) : undefined;
            if (name && ROUTE_FACTORY.test(name) && first && ts.isObjectLiteralExpression(first)) {
                configs.push({
                    method: propertyText(first, 'method')?.toLowerCase() ?? null,
                    path: propertyText(first, 'path'),
                    line: lineOf(sourceFile, node)
                });
            }
        }
        ts.forEachChild(node, visit);
    }
    visit(sourceFile);
    return configs;
}

function receiverKind(node: ts.Expression): 'listing' | 'user' | null {
    const receiver = unwrap(node);
    let name: string | null = null;
    if (ts.isIdentifier(receiver)) name = receiver.text;
    else if (
        ts.isPropertyAccessExpression(receiver) &&
        receiver.expression.kind === ts.SyntaxKind.ThisKeyword
    ) {
        name = receiver.name.text;
    } else if (ts.isNewExpression(receiver) && ts.isIdentifier(receiver.expression)) {
        if (LISTING_CLASS.test(receiver.expression.text)) return 'listing';
        if (USER_CLASS.test(receiver.expression.text)) return 'user';
        return null;
    }
    if (!name) return null;
    if (LISTING_RECEIVERS.has(name.toLowerCase())) return 'listing';
    if (USER_RECEIVERS.has(name.toLowerCase())) return 'user';
    return null;
}

/**
 * Returns the listing delete or restore calls of one source file (p4), and every declaration of
 * a `softDeleteOwnDraft` method.
 *
 * @param args.file - repository-relative path, used in the result
 * @param args.source - the file's source text
 * @returns the forbidden calls and declarations, with their line
 */
export function findForbiddenCalls(args: {
    readonly file: string;
    readonly source: string;
}): readonly DoorFinding[] {
    const sourceFile = ts.createSourceFile(args.file, args.source, ts.ScriptTarget.Latest, true);
    const found: DoorFinding[] = [];
    function visit(node: ts.Node): void {
        if (ts.isCallExpression(node)) {
            const callee = unwrap(node.expression);
            if (ts.isPropertyAccessExpression(callee)) {
                const method = callee.name.text;
                const kind = receiverKind(callee.expression);
                const forbidden =
                    (kind === 'listing' && LISTING_METHODS.has(method)) ||
                    (kind === 'user' && method === 'hardDelete');
                if (forbidden) {
                    found.push({
                        file: args.file,
                        line: lineOf(sourceFile, node),
                        what: `calls ${callee.expression.getText(sourceFile)}.${method}(...)`
                    });
                }
            }
        }
        if (
            (ts.isMethodDeclaration(node) || ts.isPropertyDeclaration(node)) &&
            ts.isClassLike(node.parent) &&
            (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) &&
            node.name.text === 'softDeleteOwnDraft'
        ) {
            found.push({
                file: args.file,
                line: lineOf(sourceFile, node),
                what: 'declares a softDeleteOwnDraft method'
            });
        }
        ts.forEachChild(node, visit);
    }
    visit(sourceFile);
    return found;
}

function loadInventory(path: string): {
    readonly inventory?: DoorsInventory;
    readonly error?: string;
} {
    let parsed: unknown;
    try {
        parsed = JSON.parse(readFileSync(path, 'utf8'));
    } catch (error) {
        return { error: `cannot load ${DOORS_INVENTORY_PATH}: ${(error as Error).message}` };
    }
    const lists: Record<string, DoorRow[]> = { retired: [], kept: [], outOfScope: [] };
    const seen = new Set<string>();
    for (const listName of Object.keys(lists)) {
        const raw = (parsed as Partial<Record<string, unknown>> | null)?.[listName];
        if (!Array.isArray(raw))
            return { error: `${DOORS_INVENTORY_PATH} has no ${listName} array` };
        for (const [index, entry] of raw.entries()) {
            const row = entry as Partial<Record<string, unknown>> | null;
            const text = (key: string) =>
                typeof row?.[key] === 'string' ? (row[key] as string).trim() : '';
            const spec = Array.isArray(row?.spec)
                ? row.spec.filter(
                      (cite): cite is string => typeof cite === 'string' && cite.trim() !== ''
                  )
                : [];
            const file = text('file');
            if (!file || !text('method') || !text('path') || spec.length === 0) {
                return {
                    error: `${DOORS_INVENTORY_PATH} ${listName}[${index}] has no file, method, path or spec`
                };
            }
            if (seen.has(file)) return { error: `${DOORS_INVENTORY_PATH} repeats file ${file}` };
            seen.add(file);
            lists[listName]?.push({
                file,
                method: text('method'),
                path: text('path'),
                door: text('door'),
                source: text('source'),
                spec
            });
        }
    }
    return {
        inventory: {
            retired: lists.retired ?? [],
            kept: lists.kept ?? [],
            outOfScope: lists.outOfScope ?? []
        }
    };
}

function listTree(root: string): readonly string[] {
    const output = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024
    });
    return output
        .split('\0')
        .filter(Boolean)
        .filter((file) => existsSync(join(root, file)));
}

function routeFindings(file: string, source: string): readonly DoorFinding[] {
    const isUserAdmin = USER_ADMIN_ROUTE_DIR.test(file);
    return findRouteConfigs({ file, source }).flatMap((config) => {
        const label = `${config.method ?? '?'} ${config.path ?? '?'}`;
        const forbidden = isUserAdmin
            ? config.path === '/{id}/hard'
            : config.path === '/{id}/restore' ||
              (config.method === 'delete' &&
                  (config.path === '/{id}' || config.path === '/{id}/hard'));
        return forbidden ? [{ file, line: config.line, what: `registers ${label}` }] : [];
    });
}

function fail(predicate: string, finding: DoorFinding): string {
    return `FAIL AC:V6:25 (${predicate}): ${finding.file}:${finding.line} ${finding.what}`;
}

/**
 * Runs the AC:V6:25 guard over a repository tree.
 *
 * @param args.root - repository root (defaults to this repository)
 * @param args.inventoryPath - absolute path of the doors inventory (defaults to `<root>/scripts/guards/...`)
 * @param args.minScannedFiles - minimum number of route files the walk must see
 * @returns the exit code and the text to print
 */
export function run(
    args: {
        readonly root?: string;
        readonly inventoryPath?: string;
        readonly minScannedFiles?: number;
    } = {}
): { readonly exitCode: number; readonly output: string } {
    const root = args.root ?? resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
    const minScannedFiles = args.minScannedFiles ?? MIN_SCANNED_FILES;
    const loaded = loadInventory(args.inventoryPath ?? join(root, DOORS_INVENTORY_PATH));
    if (!loaded.inventory)
        return { exitCode: 1, output: `FAIL AC:V6:25 (inventory): ${loaded.error}` };
    const inventory = loaded.inventory;
    const tree = listTree(root);
    const present = new Set(tree);
    const routeFiles = tree.filter(
        (file) =>
            (LISTING_ROUTE_DIR.test(file) || USER_ADMIN_ROUTE_DIR.test(file)) &&
            !TEST_FILE.test(file)
    );
    if (routeFiles.length < minScannedFiles) {
        return {
            exitCode: 1,
            output: `FAIL AC:V6:25 (scan): scanned ${routeFiles.length} route files; expected at least ${minScannedFiles}`
        };
    }
    const read = (file: string) => readFileSync(join(root, file), 'utf8');
    const failures: string[] = [];
    for (const row of inventory.retired) {
        if (present.has(row.file)) {
            failures.push(
                fail('p1', {
                    file: row.file,
                    line: 1,
                    what: `retired door ${row.method} ${row.path} exists again`
                })
            );
        }
    }
    for (const file of routeFiles) {
        for (const finding of routeFindings(file, read(file))) failures.push(fail('p2', finding));
    }
    for (const row of inventory.kept) {
        const declared =
            present.has(row.file) &&
            findRouteConfigs({ file: row.file, source: read(row.file) }).some(
                (config) => config.method === 'post' && config.path === '/{id}/purge'
            );
        if (!declared) {
            failures.push(
                fail('p3', {
                    file: row.file,
                    line: 1,
                    what: `kept door ${row.method} ${row.path} is missing or no longer declares post /{id}/purge`
                })
            );
        }
    }
    const sourceFiles = tree.filter((file) => SOURCE_FILE.test(file) && !TEST_FILE.test(file));
    for (const file of sourceFiles) {
        const source = read(file);
        if (!CALL_HINT.test(source)) continue;
        for (const finding of findForbiddenCalls({ file, source }))
            failures.push(fail('p4', finding));
    }
    if (failures.length > 0) return { exitCode: 1, output: failures.join('\n') };
    const pb12 = inventory.kept.filter((row) => row.file.includes('/protected/')).length;
    const acc23 = inventory.kept.length - pb12;
    return {
        exitCode: 0,
        output: `OK AC:V6:25: ${routeFiles.length} route files scanned, ${inventory.retired.length} retired doors absent, ${inventory.kept.length} kept doors (PB12 x${pb12}, ACC:23 x${acc23}), ${sourceFiles.length} source files scanned for listing delete or restore calls`
    };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const result = run();
    (result.exitCode === 0 ? console.log : console.error)(result.output);
    process.exit(result.exitCode);
}
