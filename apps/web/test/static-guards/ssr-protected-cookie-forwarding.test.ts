/**
 * @file ssr-protected-cookie-forwarding.test.ts
 * @description Static guard for SSR calls into protected web API routes.
 *
 * HOS-786 exposed the failure mode: on the server, `credentials: 'include'`
 * does NOT conjure a cookie jar. If a page or server helper reads a
 * `/api/v1/protected/*` endpoint without explicitly forwarding the incoming
 * session cookie, the API resolves a guest actor and the UI silently degrades
 * to empty/private data.
 *
 * This guard enforces the two server-side patterns that are allowed:
 * 1. Calls through `@/lib/api/endpoints-protected` must pass `cookieHeader`.
 * 2. Direct `fetch()` calls to `/api/v1/protected/*` must pass `headers`
 *    containing a `cookie` field.
 *
 * The detector is anchored on the unavoidable tokens themselves — the import
 * source `endpoints-protected` and the literal route segment `/api/v1/protected/`
 * — not on individual helper names that a rename could invalidate.
 */

import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const WEB_ROOT = path.resolve(__dirname, '../../src');
const LIB_ROOT = path.join(WEB_ROOT, 'lib');
const SCANNED_EXTENSIONS = new Set(['.astro', '.ts', '.tsx']);
const SCAN_DIRS = [path.join(WEB_ROOT, 'pages'), path.join(WEB_ROOT, 'components'), LIB_ROOT];
/** The unavoidable token: every protected endpoint's path carries it. */
const PROTECTED_ROUTE_SEGMENT = '/api/v1/protected';

interface Offense {
    readonly file: string;
    readonly line: number;
    readonly kind: 'protected-wrapper' | 'protected-fetch';
    readonly expression: string;
}

function collectFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) {
        return [];
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...collectFiles(fullPath));
            continue;
        }
        if (SCANNED_EXTENSIONS.has(path.extname(entry.name))) {
            files.push(fullPath);
        }
    }

    return files;
}

/**
 * Resolves an import specifier to a file on disk.
 *
 * Only `@/…` and relative specifiers are resolvable; anything else is a package
 * and out of scope.
 *
 * @param params - The importing file and the raw specifier it declared.
 * @returns The absolute path of the imported module, or null.
 */
function resolveImport({
    fromFile,
    specifier
}: {
    readonly fromFile: string;
    readonly specifier: string;
}): string | null {
    let base: string;
    if (specifier.startsWith('@/')) {
        base = path.join(WEB_ROOT, specifier.slice(2));
    } else if (specifier.startsWith('.')) {
        base = path.resolve(path.dirname(fromFile), specifier);
    } else {
        return null;
    }

    const candidates = [
        base,
        `${base}.ts`,
        `${base}.tsx`,
        path.join(base, 'index.ts'),
        path.join(base, 'index.tsx')
    ];

    return candidates.find((c) => fs.existsSync(c) && fs.statSync(c).isFile()) ?? null;
}

/**
 * Reads every import specifier declared by a module (or an `.astro`
 * frontmatter).
 *
 * @param file - Absolute path of the module.
 * @returns The raw specifiers, in source order.
 */
function readImportSpecifiers(file: string): readonly string[] {
    const source = readParseableSource(file);
    if (!source.trim()) return [];

    const sourceFile = ts.createSourceFile(
        file,
        source,
        ts.ScriptTarget.Latest,
        true,
        file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );

    const specifiers: string[] = [];
    sourceFile.forEachChild((node) => {
        if (
            (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
            node.moduleSpecifier &&
            ts.isStringLiteral(node.moduleSpecifier)
        ) {
            specifiers.push(node.moduleSpecifier.text);
        }
    });

    return specifiers;
}

/**
 * Computes the set of `.ts`/`.tsx` modules that actually execute on the server,
 * by walking the import graph out of every `.astro` frontmatter.
 *
 * This replaces the earlier path-shape heuristic ("under `src/lib`, no
 * `.client.` in the name"), which misfiled browser-only helpers — the streaming
 * chat clients and the entitlements cache — as server code. Reachability is the
 * property the guard actually cares about, and it survives a file move.
 *
 * The walk deliberately stops at React modules (`.tsx`, or a `.client.` entry
 * point): an island's module body is evaluated during SSR, but the requests it
 * makes happen after hydration, in a browser that does have a cookie jar. Only
 * plain `.ts` modules run inside an Astro frontmatter. Note that `.client.` is
 * NOT a reliable island marker on its own — it names only the top-level entry
 * point, so `AiChatWidget.tsx` (a React component with no suffix) would
 * otherwise drag its whole runtime subtree into the server set.
 *
 * @returns Absolute paths of every server-reachable module.
 */
function collectServerReachableModules(): ReadonlySet<string> {
    const reachable = new Set<string>();
    const queue: string[] = [];

    for (const dir of [WEB_ROOT]) {
        for (const file of collectFiles(dir)) {
            if (file.endsWith('.astro')) queue.push(file);
        }
    }

    const seen = new Set<string>(queue);

    while (queue.length > 0) {
        const current = queue.shift() as string;

        for (const specifier of readImportSpecifiers(current)) {
            const resolved = resolveImport({ fromFile: current, specifier });
            if (!resolved || seen.has(resolved)) continue;
            seen.add(resolved);

            // An island's own network calls run post-hydration; do not pull its
            // dependency subtree into the server set.
            if (resolved.endsWith('.tsx') || resolved.includes('.client.')) continue;

            reachable.add(resolved);
            queue.push(resolved);
        }
    }

    return reachable;
}

const SERVER_REACHABLE_MODULES = collectServerReachableModules();

function isServerFile(file: string): boolean {
    if (file.endsWith('.astro')) {
        return true;
    }
    return SERVER_REACHABLE_MODULES.has(file);
}

function readParseableSource(file: string): string {
    const source = fs.readFileSync(file, 'utf8');
    if (!file.endsWith('.astro')) {
        return source;
    }
    if (!source.startsWith('---')) {
        return '';
    }
    const end = source.indexOf('\n---', 3);
    return end === -1 ? '' : source.slice(3, end);
}

function isCookieHeaderProperty(property: ts.ObjectLiteralElementLike): boolean {
    if (ts.isShorthandPropertyAssignment(property)) {
        return property.name.text === 'cookieHeader';
    }
    if (ts.isPropertyAssignment(property)) {
        return (
            (ts.isIdentifier(property.name) && property.name.text === 'cookieHeader') ||
            (ts.isStringLiteral(property.name) && property.name.text === 'cookieHeader')
        );
    }
    return false;
}

function hasCookieHeaderArgument(argument: ts.Node | undefined): boolean {
    return (
        argument !== undefined &&
        ts.isObjectLiteralExpression(argument) &&
        argument.properties.some((property) => isCookieHeaderProperty(property))
    );
}

/**
 * Collects module-level `const x = 'literal'` bindings so a URL assembled from
 * a constant (`fetch(`${PROTECTED}/accommodations/...`)`) can still be matched
 * against the route segment. Anchoring on the segment rather than on the
 * constant's NAME keeps the detector alive through a rename.
 *
 * @param sourceFile - Parsed module.
 * @returns Map of binding name to its literal string value.
 */
function collectStringConstants(sourceFile: ts.SourceFile): ReadonlyMap<string, string> {
    const constants = new Map<string, string>();

    function visit(node: ts.Node): void {
        if (
            ts.isVariableDeclaration(node) &&
            ts.isIdentifier(node.name) &&
            node.initializer &&
            (ts.isStringLiteral(node.initializer) ||
                ts.isNoSubstitutionTemplateLiteral(node.initializer))
        ) {
            constants.set(node.name.text, node.initializer.text);
        }
        ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    return constants;
}

/**
 * Renders a URL argument to the most complete string the module can prove,
 * expanding identifiers that resolve to string constants.
 *
 * @param node - The first argument of the `fetch()` call.
 * @param constants - Literal string bindings collected from the module.
 * @returns The expanded text, used only for segment matching.
 */
function expandUrlArgument(node: ts.Node, constants: ReadonlyMap<string, string>): string {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        return node.text;
    }

    if (ts.isIdentifier(node)) {
        return constants.get(node.text) ?? '';
    }

    if (ts.isTemplateExpression(node)) {
        return (
            node.head.text +
            node.templateSpans
                .map((span) => expandUrlArgument(span.expression, constants) + span.literal.text)
                .join('')
        );
    }

    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        return expandUrlArgument(node.left, constants) + expandUrlArgument(node.right, constants);
    }

    return '';
}

function collectObjectLiterals(
    sourceFile: ts.SourceFile
): ReadonlyMap<string, ts.ObjectLiteralExpression> {
    const objects = new Map<string, ts.ObjectLiteralExpression>();

    function visit(node: ts.Node): void {
        if (
            ts.isVariableDeclaration(node) &&
            ts.isIdentifier(node.name) &&
            node.initializer &&
            ts.isObjectLiteralExpression(node.initializer)
        ) {
            objects.set(node.name.text, node.initializer);
        }
        ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    return objects;
}

function hasCookieHeaderInHeaders(
    node: ts.Expression,
    objects: ReadonlyMap<string, ts.ObjectLiteralExpression>,
    visited = new Set<string>()
): boolean {
    if (ts.isParenthesizedExpression(node)) {
        return hasCookieHeaderInHeaders(node.expression, objects, visited);
    }

    if (ts.isConditionalExpression(node)) {
        return (
            hasCookieHeaderInHeaders(node.whenTrue, objects, visited) ||
            hasCookieHeaderInHeaders(node.whenFalse, objects, visited)
        );
    }

    if (ts.isObjectLiteralExpression(node)) {
        return node.properties.some((property) => {
            if (ts.isSpreadAssignment(property)) {
                return hasCookieHeaderInHeaders(property.expression, objects, visited);
            }
            if (ts.isShorthandPropertyAssignment(property)) {
                return hasCookieHeaderInHeaders(property.name, objects, visited);
            }
            if (!ts.isPropertyAssignment(property)) {
                return false;
            }
            const name = ts.isIdentifier(property.name)
                ? property.name.text
                : ts.isStringLiteral(property.name)
                  ? property.name.text
                  : '';
            if (name.toLowerCase() === 'cookie') {
                return true;
            }
            return false;
        });
    }

    if (ts.isIdentifier(node)) {
        if (visited.has(node.text)) {
            return false;
        }
        visited.add(node.text);
        const resolved = objects.get(node.text);
        return resolved ? hasCookieHeaderInHeaders(resolved, objects, visited) : false;
    }

    return false;
}

function fetchOptionsForwardCookie(
    argument: ts.Node | undefined,
    objects: ReadonlyMap<string, ts.ObjectLiteralExpression>
): boolean {
    if (!argument || !ts.isObjectLiteralExpression(argument)) {
        return false;
    }

    // NOTE: `credentials: 'include'` is deliberately NOT an exemption. It is the
    // failure mode this guard exists to catch — on the server there is no cookie
    // jar for it to include, so it reads as "authenticated" while sending
    // nothing. Browser-only callers are excluded earlier, by `isServerFile`.

    return argument.properties.some((property) => {
        if (ts.isShorthandPropertyAssignment(property)) {
            return property.name.text === 'headers'
                ? hasCookieHeaderInHeaders(property.name, objects)
                : false;
        }
        if (!ts.isPropertyAssignment(property)) {
            return false;
        }

        const name = ts.isIdentifier(property.name)
            ? property.name.text
            : ts.isStringLiteral(property.name)
              ? property.name.text
              : '';

        if (name === 'headers') {
            return hasCookieHeaderInHeaders(property.initializer, objects);
        }
        return false;
    });
}

function collectProtectedBindings(sourceFile: ts.SourceFile): ReadonlySet<string> {
    const bindings = new Set<string>();

    sourceFile.forEachChild((node) => {
        if (
            !ts.isImportDeclaration(node) ||
            !ts.isStringLiteral(node.moduleSpecifier) ||
            !node.moduleSpecifier.text.includes('endpoints-protected')
        ) {
            return;
        }

        const clause = node.importClause;
        if (!clause?.namedBindings || !ts.isNamedImports(clause.namedBindings)) {
            return;
        }

        for (const element of clause.namedBindings.elements) {
            bindings.add(element.name.text);
        }
    });

    return bindings;
}

function inspectFile(file: string): readonly Offense[] {
    const source = readParseableSource(file);
    if (!source.trim()) {
        return [];
    }

    const sourceFile = ts.createSourceFile(
        file,
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS
    );
    const protectedBindings = collectProtectedBindings(sourceFile);
    const objects = collectObjectLiterals(sourceFile);
    const stringConstants = collectStringConstants(sourceFile);
    const offenses: Offense[] = [];

    function push(node: ts.CallExpression, kind: Offense['kind'], expression: string): void {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        offenses.push({
            file: path.relative(WEB_ROOT, file),
            line: line + 1,
            kind,
            expression
        });
    }

    function visit(node: ts.Node): void {
        if (ts.isCallExpression(node)) {
            const expression = node.expression;

            if (
                ts.isPropertyAccessExpression(expression) &&
                ts.isIdentifier(expression.expression) &&
                protectedBindings.has(expression.expression.text) &&
                !hasCookieHeaderArgument(node.arguments[0])
            ) {
                push(node, 'protected-wrapper', expression.getText(sourceFile));
            }

            const urlArgument = node.arguments[0];
            if (
                ts.isIdentifier(expression) &&
                expression.text === 'fetch' &&
                urlArgument &&
                (urlArgument.getText(sourceFile).includes(PROTECTED_ROUTE_SEGMENT) ||
                    expandUrlArgument(urlArgument, stringConstants).includes(
                        PROTECTED_ROUTE_SEGMENT
                    )) &&
                !fetchOptionsForwardCookie(node.arguments[1], objects)
            ) {
                push(node, 'protected-fetch', 'fetch');
            }
        }

        ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    return offenses;
}

describe('HOS-786 static guard — SSR protected reads must forward the session cookie', () => {
    const files = SCAN_DIRS.flatMap((dir) => collectFiles(dir)).filter((file) =>
        isServerFile(file)
    );

    it('scans at least one server file', () => {
        expect(files.length).toBeGreaterThan(0);
    });

    // Positive control. If import resolution silently breaks, every module falls
    // out of the server set and the guard below passes while checking nothing.
    // These two are the exact SSR path HOS-786 was reported on.
    it.each([
        'lib/editor/resolve-editor-page.ts',
        'lib/api/accommodation-editor-data.ts'
    ])('classifies %s as server-reachable', (relative) => {
        expect(files).toContain(path.join(WEB_ROOT, relative));
    });

    it('requires cookie forwarding on server calls to protected web endpoints', () => {
        const offenses = files.flatMap((file) => inspectFile(file));

        expect(
            offenses,
            offenses
                .map(
                    (offense) =>
                        `${offense.file}:${offense.line} ${offense.kind} ${offense.expression}`
                )
                .join('\n')
        ).toEqual([]);
    });
});
