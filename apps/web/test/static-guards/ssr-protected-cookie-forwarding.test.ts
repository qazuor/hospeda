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
const SCANNED_EXTENSIONS = new Set(['.astro', '.ts']);
const SCAN_DIRS = [path.join(WEB_ROOT, 'pages'), path.join(WEB_ROOT, 'components'), LIB_ROOT];

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

function isServerFile(file: string): boolean {
    if (file.endsWith('.astro')) {
        return true;
    }
    if (!file.startsWith(LIB_ROOT)) {
        return false;
    }
    return !file.includes('.client.') && !file.includes('/hooks/') && !file.includes('/store/');
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
    objects: ReadonlyMap<string, ts.ObjectLiteralExpression>,
    sourceFile: ts.SourceFile
): boolean {
    if (!argument || !ts.isObjectLiteralExpression(argument)) {
        return false;
    }

    // Browser-only helpers correctly rely on `credentials: 'include'`; they are
    // out of scope for this SSR guard. Server-side callers must forward the raw
    // cookie header explicitly instead.
    if (
        argument.getText(sourceFile).includes("credentials: 'include'") &&
        !sourceFile.text.includes('cookieHeader')
    ) {
        return true;
    }

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

            if (
                ts.isIdentifier(expression) &&
                expression.text === 'fetch' &&
                node.arguments[0] &&
                node.arguments[0].getText(sourceFile).includes('/api/v1/protected/') &&
                !fetchOptionsForwardCookie(node.arguments[1], objects, sourceFile)
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
