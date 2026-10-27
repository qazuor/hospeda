/**
 * The scanner behind GUARD:G-R6-B (HOS-1476, AC:V6:15): every place in production code that
 * writes or reads `listing.inactive_since` (Drizzle `inactiveSince`) or writes
 * `listing.deadlines_version` (`deadlinesVersion`) on the three listing tables.
 *
 * It walks, with the TypeScript AST, the production `.ts` of `apps/*\/src/**` and `packages/*\/src/**`
 * (tests excluded, as GUARD:G5) and the `.sql` of `packages/db/src/migrations/`. Writes: W1/W3 an
 * object property `inactiveSince` (not in `insertStatusChangedEvent`/`retentionClockStart` arguments,
 * not a model's transport mapping, not the schema column unless it has a default); W2 a
 * `stampInactiveSince` call; W3' `deadlinesVersion` in `.set`/`.values` on a listing table; W4 a SQL
 * assignment before any top-level `WHERE` or an `INSERT INTO <listing>` column; W5 the same inside
 * a migration's `UPDATE <listing> ... SET`. Reads: R1 a `.inactiveSince` access (not a type, an
 * `oldInactiveSince` value, an event argument or a transport mapping); R2 SQL `inactive_since` after
 * `WHERE`/`ON`/`ORDER BY`/`HAVING` or next to an operator (a `SELECT` list is transport).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

/** The two listing columns the guard follows. */
export type ClockColumn = 'inactive_since' | 'deadlines_version';

/** How a read reaches the retention clock (only meaningful for reads). */
export type ClockUse =
    /** Inside the object argument of `retentionClockStart({ inactiveSince, pauseEndedAt })`. */
    | 'later-of-both'
    /** Inside `retentionClockStart(...)` but with `pauseEndedAt` missing or the literal `null`. */
    | 'without-pause'
    /** Anywhere else. */
    | 'bare';

/** One write or read of the listing clock. */
export type ClockSite = {
    readonly file: string;
    readonly symbol: string;
    readonly line: number;
    readonly kind: 'write' | 'read';
    readonly column: ClockColumn;
    /** Whether the same object, call or literal also writes `inactive_since`. */
    readonly writesClockToo: boolean;
    /** Which syntactic form produced the site (W1..W5, R1, R2). */
    readonly context: string;
    /** For reads: whether it is counted from the later of the clock and the pause end. */
    readonly clockUse: ClockUse;
};

/** What one file contributes. */
export type FileScan = {
    readonly sites: readonly ClockSite[];
    /** Symbols of this file that call `retentionStopped(...)`. */
    readonly retentionStoppedSymbols: readonly string[];
};

/** What the whole tree contributes. */
export type TreeScan = FileScan & {
    readonly scannedFiles: number;
    /** `file|symbol` keys of every symbol calling `retentionStopped(...)`. */
    readonly retentionStoppedKeys: readonly string[];
};

const LISTING_TABLES = new Set(['accommodations', 'venues', 'experiences']);
const LISTING_TABLE_RE = /\b(?:accommodations|venues|experiences)\b/;
const CODE = /\.ts$/;
const DECLARATION = /\.d\.ts$/;
const TEST = /(?:\.(?:test|spec)\.[cm]?[jt]sx?$)|(?:^|\/)(?:test|tests|__tests__|e2e)\//;
const PRODUCTION = /^(?:apps|packages)\/[^/]+\/src\//;
const MIGRATIONS = /^packages\/db\/src\/migrations\/.*\.sql$/;
const MODELS = /^packages\/db\/src\/models\//;
const LISTING_MODELS = /^packages\/db\/src\/models\/listing\//;
const SCHEMAS = /^packages\/db\/src\/schemas\//;
const COLUMN_DEFAULT = /\.(?:default|defaultNow|\$defaultFn)\(/;
const MODULE = '<module>';
const RELEVANT =
    /inactiveSince|inactive_since|deadlinesVersion|deadlines_version|InactiveSince|retentionStopped/;

function calleeName(node: ts.CallExpression): string {
    const callee = node.expression;
    if (ts.isPropertyAccessExpression(callee)) return callee.name.text;
    if (ts.isIdentifier(callee)) return callee.text;
    return '';
}

function propertyName(name: ts.PropertyName | undefined): string | null {
    if (!name) return null;
    if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
    return null;
}

function isFunctionLike(node: ts.Node | undefined): boolean {
    return !!node && (ts.isArrowFunction(node) || ts.isFunctionExpression(node));
}

/** The enclosing call `name(...)` when `node` sits inside one of its arguments. */
function enclosingCallArgument(node: ts.Node, name: string): ts.CallExpression | null {
    let child: ts.Node = node;
    let current: ts.Node | undefined = node.parent;
    while (current) {
        if (
            ts.isCallExpression(current) &&
            calleeName(current) === name &&
            current.arguments.some((arg) => arg === child)
        )
            return current;
        child = current;
        current = current.parent;
    }
    return null;
}

function insideType(node: ts.Node): boolean {
    for (let current = node.parent; current; current = current.parent) {
        if (ts.isTypeNode(current)) return true;
        if (ts.isStatement(current) || ts.isSourceFile(current)) return false;
    }
    return false;
}

function readsInactiveSince(node: ts.Node): boolean {
    let found = false;
    const visit = (current: ts.Node): void => {
        if (found) return;
        if (ts.isPropertyAccessExpression(current) && current.name.text === 'inactiveSince') {
            found = true;
            return;
        }
        ts.forEachChild(current, visit);
    };
    visit(node);
    return found;
}

/** The nearest property assignment named `name` whose initializer contains `node`. */
function enclosingPropertyNamed(node: ts.Node, name: string): ts.PropertyAssignment | null {
    let child: ts.Node = node;
    for (let current = node.parent; current; current = current.parent) {
        if (
            ts.isPropertyAssignment(current) &&
            current.initializer === child &&
            propertyName(current.name) === name
        )
            return current;
        if (ts.isStatement(current)) return null;
        child = current;
    }
    return null;
}

function objectHasProperty(object: ts.ObjectLiteralExpression, name: string): boolean {
    return object.properties.some(
        (p) =>
            (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) &&
            propertyName(p.name) === name
    );
}

/** The listing table of the `.update(X)`/`.insert(X)` link of a call chain, if any. */
function chainTable(node: ts.Expression): string | null {
    let current: ts.Expression = node;
    while (ts.isCallExpression(current) || ts.isPropertyAccessExpression(current)) {
        if (ts.isCallExpression(current)) {
            const name = calleeName(current);
            const arg = current.arguments[0];
            if ((name === 'update' || name === 'insert') && arg && ts.isIdentifier(arg))
                return LISTING_TABLES.has(arg.text) ? arg.text : null;
        }
        current = current.expression;
    }
    return null;
}

/** Text of a string/template literal with `${...}` substitutions blanked (offsets kept). */
function literalText(node: ts.Node, sf: ts.SourceFile): string | null {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
        return node.getText(sf);
    if (!ts.isTemplateExpression(node)) return null;
    const start = node.getStart(sf);
    const chars = node.getText(sf).split('');
    for (const span of node.templateSpans) {
        const from = span.expression.getFullStart() - start;
        const to = span.expression.getEnd() - start;
        for (let i = from; i < to; i++) chars[i] = '?';
    }
    return chars.join('');
}

/** Index of the first top-level (paren depth 0) occurrence of `re` in `text`, or -1. */
function topLevelIndex(text: string, re: RegExp): number {
    let depth = 0;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === '(') depth++;
        else if (c === ')') depth = Math.max(0, depth - 1);
        else if (depth === 0 && re.test(text.slice(i, i + 12)) && !/\w/.test(text[i - 1] ?? ''))
            return i;
    }
    return -1;
}

type TextHit = {
    readonly index: number;
    readonly column: ClockColumn;
    readonly kind: 'write' | 'read';
};

const ASSIGN = /^(inactive_since|deadlines_version)\s*=(?!=)/;
const WHERE_AT = /^WHERE\b/i;

/** Writes in a SQL text: assignments before the first top-level WHERE, and INSERT column lists. */
function sqlWrites(text: string): TextHit[] {
    const hits: TextHit[] = [];
    const where = topLevelIndex(text, WHERE_AT);
    const name = /\b(inactive_since|deadlines_version)\b/g;
    for (let m = name.exec(text); m; m = name.exec(text)) {
        if (where !== -1 && m.index > where) continue;
        if (ASSIGN.test(text.slice(m.index))) {
            hits.push({ index: m.index, column: m[1] as ClockColumn, kind: 'write' });
        }
    }
    const insert = /INSERT\s+INTO\s+(accommodations|venues|experiences)\s*\(([^)]*)\)/gi;
    for (let m = insert.exec(text); m; m = insert.exec(text)) {
        const listStart = m.index + m[0].indexOf('(') + 1;
        const cols = /\b(inactive_since|deadlines_version)\b/g;
        const list = m[2] ?? '';
        for (let c = cols.exec(list); c; c = cols.exec(list))
            hits.push({ index: listStart + c.index, column: c[1] as ClockColumn, kind: 'write' });
    }
    return hits;
}

const READ_KEYWORD = /\b(?:WHERE|ON|ORDER\s+BY|HAVING)\b/i;
const OPERATOR_BEFORE = /(?:[+\-<>]|<=|>=)\s*$/;
const OPERATOR_AFTER = /^\s*[+\-<>]/;

/** Reads of `inactive_since` in a SQL text (R2). */
function sqlReads(text: string, writes: readonly TextHit[]): TextHit[] {
    const hits: TextHit[] = [];
    const name = /\binactive_since\b/g;
    for (let m = name.exec(text); m; m = name.exec(text)) {
        if (writes.some((w) => w.index === m?.index)) continue;
        const before = text.slice(0, m.index);
        const after = text.slice(m.index + m[0].length);
        if (READ_KEYWORD.test(before) || OPERATOR_BEFORE.test(before) || OPERATOR_AFTER.test(after))
            hits.push({ index: m.index, column: 'inactive_since', kind: 'read' });
    }
    return hits;
}

function lineAt(source: string, index: number): number {
    let line = 1;
    for (let i = 0; i < index; i++) if (source.charCodeAt(i) === 10) line++;
    return line;
}

/** W5 over one migration: assignments inside `UPDATE <listing> ... SET`. */
function scanMigration(file: string, source: string): FileScan {
    const sites: ClockSite[] = [];
    let offset = 0;
    for (const statement of source.split(';')) {
        const update = /\bUPDATE\s+(?:accommodations|venues|experiences)\b[^;]*?\bSET\b/i.exec(
            statement
        );
        if (update) {
            const setStart = update.index + update[0].length;
            const writes = sqlWrites(statement.slice(setStart)).filter((w) => w.kind === 'write');
            const clock = writes.some((w) => w.column === 'inactive_since');
            for (const w of writes)
                sites.push({
                    file,
                    symbol: MODULE,
                    line: lineAt(source, offset + setStart + w.index),
                    kind: 'write',
                    column: w.column,
                    writesClockToo: clock,
                    context: 'W5',
                    clockUse: 'bare'
                });
        }
        offset += statement.length + 1;
    }
    return { sites, retentionStoppedSymbols: [] };
}

/**
 * Scans one file (pure: no I/O). `.sql` files get W5 only; `.ts` files get every other form.
 */
export function scanFile(args: { readonly file: string; readonly source: string }): FileScan {
    const { file, source } = args;
    // Every form above names one of these tokens; a file without them has no site to find.
    if (!RELEVANT.test(source)) return { sites: [], retentionStoppedSymbols: [] };
    if (file.endsWith('.sql')) return scanMigration(file, source);
    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    const sites: ClockSite[] = [];
    const stopped = new Set<string>();
    const at = (node: ts.Node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
    const push = (site: Omit<ClockSite, 'file' | 'clockUse'> & { clockUse?: ClockUse }) =>
        sites.push({ file, clockUse: 'bare', ...site });

    function visit(node: ts.Node, scope: string): void {
        let next = scope;
        if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) && node.name)
            next = node.name.getText(sf);
        else if (
            scope === MODULE &&
            (ts.isPropertyAssignment(node) || ts.isVariableDeclaration(node)) &&
            isFunctionLike(node.initializer)
        )
            next = node.name.getText(sf);

        if (ts.isCallExpression(node)) {
            const name = calleeName(node);
            if (name === 'retentionStopped') stopped.add(next);
            if (name === 'stampInactiveSince' && ts.isPropertyAccessExpression(node.expression))
                push({
                    symbol: next,
                    line: at(node),
                    kind: 'write',
                    column: 'inactive_since',
                    writesClockToo: true,
                    context: 'W2 stampInactiveSince'
                });
            if (
                (name === 'set' || name === 'values') &&
                ts.isPropertyAccessExpression(node.expression)
            ) {
                const table = chainTable(node.expression.expression);
                const arg = node.arguments[0];
                const objects = arg
                    ? ts.isObjectLiteralExpression(arg)
                        ? [arg]
                        : ts.isArrayLiteralExpression(arg)
                          ? arg.elements.filter(ts.isObjectLiteralExpression)
                          : []
                    : [];
                if (table)
                    for (const object of objects)
                        for (const p of object.properties)
                            if (
                                (ts.isPropertyAssignment(p) ||
                                    ts.isShorthandPropertyAssignment(p)) &&
                                propertyName(p.name) === 'deadlinesVersion'
                            )
                                push({
                                    symbol: next,
                                    line: at(p),
                                    kind: 'write',
                                    column: 'deadlines_version',
                                    writesClockToo: objectHasProperty(object, 'inactiveSince'),
                                    context: `W3' .${name}(${table})`
                                });
            }
        }

        if (
            (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) &&
            propertyName(node.name) === 'inactiveSince' &&
            ts.isObjectLiteralExpression(node.parent)
        ) {
            const initializer = ts.isPropertyAssignment(node) ? node.initializer : null;
            const excluded =
                enclosingCallArgument(node, 'insertStatusChangedEvent') !== null ||
                enclosingCallArgument(node, 'retentionClockStart') !== null ||
                (MODELS.test(file) && initializer !== null && readsInactiveSince(initializer)) ||
                (SCHEMAS.test(file) &&
                    initializer !== null &&
                    !COLUMN_DEFAULT.test(initializer.getText(sf)));
            if (!excluded) {
                const owner = node.parent.parent;
                const viaStatus =
                    owner &&
                    ts.isCallExpression(owner) &&
                    calleeName(owner) === 'setPublicationStatus';
                push({
                    symbol: next,
                    line: at(node),
                    kind: 'write',
                    column: 'inactive_since',
                    writesClockToo: true,
                    context: viaStatus ? 'W1 setPublicationStatus' : 'W3 object property'
                });
            }
        }

        const isAccess =
            (ts.isPropertyAccessExpression(node) && node.name.text === 'inactiveSince') ||
            (ts.isElementAccessExpression(node) &&
                ts.isStringLiteralLike(node.argumentExpression) &&
                node.argumentExpression.text === 'inactiveSince');
        if (isAccess && !insideType(node)) {
            const oldValue =
                ts.isPropertyAssignment(node.parent) &&
                node.parent.initializer === node &&
                propertyName(node.parent.name) === 'oldInactiveSince';
            const transport =
                MODELS.test(file) && enclosingPropertyNamed(node, 'inactiveSince') !== null;
            if (
                !oldValue &&
                !transport &&
                !enclosingCallArgument(node, 'insertStatusChangedEvent')
            ) {
                const property = enclosingPropertyNamed(node, 'inactiveSince');
                const clockCall = property
                    ? enclosingCallArgument(property.parent, 'retentionClockStart')
                    : null;
                let clockUse: ClockUse = 'bare';
                if (property && clockCall && ts.isObjectLiteralExpression(property.parent)) {
                    const pause = property.parent.properties.find(
                        (p) =>
                            (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) &&
                            propertyName(p.name) === 'pauseEndedAt'
                    );
                    const nullPause =
                        pause !== undefined &&
                        ts.isPropertyAssignment(pause) &&
                        pause.initializer.kind === ts.SyntaxKind.NullKeyword;
                    clockUse = pause && !nullPause ? 'later-of-both' : 'without-pause';
                }
                push({
                    symbol: next,
                    line: at(node),
                    kind: 'read',
                    column: 'inactive_since',
                    writesClockToo: false,
                    context: 'R1 .inactiveSince',
                    clockUse
                });
            }
        }

        const text = literalText(node, sf);
        if (text !== null && /\b(?:inactive_since|deadlines_version)\b/.test(text)) {
            const start = node.getStart(sf);
            const eligible = LISTING_TABLE_RE.test(text) || LISTING_MODELS.test(file);
            const writes = eligible ? sqlWrites(text) : [];
            const clock = writes.some((w) => w.column === 'inactive_since');
            for (const w of writes)
                push({
                    symbol: next,
                    line: lineAt(source, start + w.index),
                    kind: 'write',
                    column: w.column,
                    writesClockToo: clock,
                    context: 'W4 SQL literal'
                });
            for (const r of sqlReads(text, writes))
                push({
                    symbol: next,
                    line: lineAt(source, start + r.index),
                    kind: 'read',
                    column: 'inactive_since',
                    writesClockToo: false,
                    context: 'R2 SQL literal'
                });
        }
        ts.forEachChild(node, (child) => visit(child, next));
    }
    visit(sf, MODULE);
    return { sites, retentionStoppedSymbols: [...stopped] };
}

/** The files the guard scans, listed by git (tracked and untracked, ignores honoured). */
export function listScannedFiles(args: { readonly root: string }): readonly string[] {
    return execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
        cwd: args.root,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024
    })
        .split('\0')
        .filter(Boolean)
        .filter(
            (f) =>
                MIGRATIONS.test(f) ||
                (PRODUCTION.test(f) && CODE.test(f) && !DECLARATION.test(f) && !TEST.test(f))
        )
        .filter((f) => existsSync(join(args.root, f)));
}

/** Scans every file of the tree rooted at `root`. */
export function scanTree(args: { readonly root: string }): TreeScan {
    const files = listScannedFiles({ root: args.root });
    const sites: ClockSite[] = [];
    const stoppedSymbols: string[] = [];
    const stoppedKeys: string[] = [];
    for (const file of files) {
        const scan = scanFile({ file, source: readFileSync(join(args.root, file), 'utf8') });
        sites.push(...scan.sites);
        stoppedSymbols.push(...scan.retentionStoppedSymbols);
        stoppedKeys.push(...scan.retentionStoppedSymbols.map((s) => `${file}|${s}`));
    }
    return {
        scannedFiles: files.length,
        sites,
        retentionStoppedSymbols: stoppedSymbols,
        retentionStoppedKeys: stoppedKeys
    };
}
