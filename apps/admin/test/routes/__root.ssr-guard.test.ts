/**
 * @file SSR instantiation guard — Admin Root
 *
 * SPEC-209 traced a per-request QZPayBilling construction to a memory leak in
 * the admin root. HOS-1416 removed QZPay from admin, so a library-name needle
 * became vacuous. This guard checks the underlying risk: arbitrary `new X()`
 * and `createX()` instantiations in the SSR root. A lazy useState initializer
 * is safe for QueryClient because it gives each SSR request an isolated cache;
 * it was not safe for the old QZPayBilling construction, which logged and
 * accumulated a fresh billing client on every healthcheck.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const ROOT_PATH = resolve(__dirname, '../../src/routes/__root.tsx');
// Module-scope route factories are intentionally evaluated once at module load.
const MODULE_SCOPE_ALLOWLIST = new Set(['createRootRoute', 'createRootRouteWithContext']);

type Finding = { name: string; line: number };

/** Checks whether an expression is the supported browser or Vite SSR guard. */
function isServerGuard(expression: ts.Expression): boolean {
    const text = expression.getText();
    return (
        /typeof\s+window\s*!==?\s*['"]undefined['"]/.test(text) ||
        /import\.meta\.env\.SSR/.test(text)
    );
}

/** Scans root source for unsafe constructor and factory calls. */
function findUnsafeInstantiations(source: string): Finding[] {
    const file = ts.createSourceFile(
        ROOT_PATH,
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX
    );
    const findings: Finding[] = [];
    const isWithin = (outer: ts.Node, inner: ts.Node) =>
        outer.pos <= inner.pos && outer.end >= inner.end;

    function safeByCallback(node: ts.Node, names: Set<string>): boolean {
        for (let parent = node.parent; parent; parent = parent.parent) {
            if (
                ts.isCallExpression(parent) &&
                ts.isIdentifier(parent.expression) &&
                names.has(parent.expression.text)
            ) {
                const callback = parent.arguments[0];
                if (
                    callback &&
                    (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) &&
                    isWithin(callback, node)
                ) {
                    return true;
                }
            }
        }
        return false;
    }

    function safeByBranch(node: ts.Node): boolean {
        for (let parent = node.parent; parent; parent = parent.parent) {
            if (
                ts.isIfStatement(parent) &&
                isWithin(parent.thenStatement, node) &&
                isServerGuard(parent.expression)
            )
                return true;
            if (
                ts.isConditionalExpression(parent) &&
                isWithin(parent.whenTrue, node) &&
                isServerGuard(parent.condition)
            )
                return true;
        }
        return false;
    }

    function isModuleScope(node: ts.Node): boolean {
        for (let parent = node.parent; parent; parent = parent.parent) {
            if (ts.isFunctionLike(parent) || ts.isClassLike(parent)) return false;
        }
        return true;
    }

    function visit(node: ts.Node): void {
        let name: string | undefined;
        if (ts.isNewExpression(node) && ts.isIdentifier(node.expression))
            name = `new ${node.expression.text}`;
        if (
            ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            /^create[A-Z0-9_]/.test(node.expression.text)
        )
            name = node.expression.text;
        if (name) {
            const callName = name.startsWith('new ') ? name.slice(4) : name;
            const safe =
                (MODULE_SCOPE_ALLOWLIST.has(callName) && isModuleScope(node)) ||
                safeByCallback(node, new Set(['useState'])) ||
                safeByCallback(node, new Set(['useEffect', 'useLayoutEffect'])) ||
                safeByBranch(node);
            if (!safe) {
                const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));
                findings.push({ name, line: line + 1 });
            }
        }
        ts.forEachChild(node, visit);
    }
    visit(file);
    return findings;
}

describe('Admin __root.tsx — SSR per-request instantiation guard', () => {
    it('allows only intentional SSR-safe instantiations in the real root', () => {
        const source = readFileSync(ROOT_PATH, 'utf-8');
        const findings = findUnsafeInstantiations(source);
        expect(source).toContain('createRootRoute(');
        expect(source).toContain('new QueryClient(');
        expect(
            findings,
            `Unsafe SSR instantiations in __root.tsx at ${findings.map((item) => `${item.line} (${item.name})`).join(', ')}. Move construction into useEffect, a lazy useState initializer, or behind typeof window / the Vite SSR check.`
        ).toHaveLength(0);
    });

    it('detects unsafe instantiations in representative source samples', () => {
        const samples = [
            'new QueryClient();',
            'function RootDocument() { const qc = new QueryClient(); }',
            'function RootDocument() { useState(new QueryClient()); }',
            'function RootDocument() { useRef(createX()); }',
            'function RootDocument() { useMemo(() => new X()); }',
            'createFoo();'
        ];
        for (const sample of samples)
            expect(findUnsafeInstantiations(sample).length, sample).toBeGreaterThan(0);
    });

    it('accepts safe positions and ignores comments, strings, and ordinary calls', () => {
        // Member calls such as `foo.createX()` are deliberately excluded: the
        // guard targets constructors and unqualified factory functions only.
        const source = [
            'function Root() { useState(() => new QueryClient()); }',
            'function Root() { useEffect(() => { new X(); }, []); }',
            "if (typeof window !== 'undefined') { new X(); }",
            'createRootRoute({});',
            '// new X(); createFoo();',
            '/* new X(); createFoo(); */',
            'const text = "new X(); createFoo();";',
            'validateAdminEnv();'
        ].join('\n');
        expect(findUnsafeInstantiations(source)).toEqual([]);
    });
});
