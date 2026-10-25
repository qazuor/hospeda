/**
 * @file SSR instantiation guard for Astro root layouts.
 *
 * SPEC-209 exposed a per-request construction leak in the admin root. HOS-1416
 * removed QZPay, leaving both old name-based guards vacuous. This guard checks
 * the class of risk in the three root web layouts: constructors and createX
 * factories in frontmatter or server-rendered template expressions. Astro
 * frontmatter runs per request; `<script>` and `<style>` bodies are browser
 * content and are intentionally excluded. Short-lived value constructors such
 * as URL are explicitly allowed because their results are request-local and
 * collectible. Add names to the allowlist only as a conscious decision.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const LAYOUTS_DIR = resolve(__dirname, '../../src/layouts');
const ROOT_LAYOUT_FILES = [
    'BaseLayout.astro',
    'DefaultLayout.astro',
    'DetailLayout.astro'
] as const;
// These constructors create disposable values rather than retained clients or registries.
const ALLOWED_THROWAWAY_CONSTRUCTORS = new Set(['URL', 'URLSearchParams', 'Date', 'Headers']);

type Finding = { name: string; line: number };
type ScanResult = { findings: Finding[]; seen: number };

function mask(source: string): string {
    return source.replace(/[^\n]/g, ' ');
}

function isClientGuard({ condition }: { readonly condition: ts.Expression }): boolean | undefined {
    const text = condition.getText().replace(/\s+/g, '');
    const ssr = /^(?:!?)import\.meta\.env\.SSR$/.test(text);
    if (ssr) return text.startsWith('!');
    const windowCheck = /^typeofwindow(!==|!=|===|==)['"]undefined['"]$/.exec(text);
    if (!windowCheck) return undefined;
    return windowCheck[1].startsWith('!');
}

function findInTs({
    source,
    lineOffset
}: {
    readonly source: string;
    readonly lineOffset: number;
}): ScanResult {
    const file = ts.createSourceFile(
        'layout-frontmatter.ts',
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS
    );
    const findings: Finding[] = [];
    let seen = 0;
    const contains = (outer: ts.Node, inner: ts.Node) =>
        outer.pos <= inner.pos && outer.end >= inner.end;

    function safeBranch(node: ts.Node): boolean {
        for (let parent = node.parent; parent; parent = parent.parent) {
            if (ts.isIfStatement(parent)) {
                const polarity = isClientGuard({ condition: parent.expression });
                if (polarity === undefined) continue;
                if (polarity && contains(parent.thenStatement, node)) return true;
                if (!polarity && parent.elseStatement && contains(parent.elseStatement, node))
                    return true;
            }
            if (ts.isConditionalExpression(parent)) {
                const polarity = isClientGuard({ condition: parent.condition });
                if (polarity !== undefined && polarity && contains(parent.whenTrue, node))
                    return true;
            }
        }
        return false;
    }

    function visit(node: ts.Node): void {
        let name: string | undefined;
        if (ts.isNewExpression(node)) {
            if (ts.isIdentifier(node.expression)) name = node.expression.text;
            else if (ts.isPropertyAccessExpression(node.expression))
                name = node.expression.name.text;
            if (name) {
                seen++;
                if (!ALLOWED_THROWAWAY_CONSTRUCTORS.has(name) && !safeBranch(node)) {
                    const line =
                        file.getLineAndCharacterOfPosition(node.getStart(file)).line +
                        1 +
                        lineOffset;
                    findings.push({ name: `new ${name}`, line });
                }
            }
        } else if (
            ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            /^create[A-Z0-9_]/.test(node.expression.text)
        ) {
            seen++;
            if (!safeBranch(node)) {
                const line =
                    file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1 + lineOffset;
                findings.push({ name: node.expression.text, line });
            }
        }
        ts.forEachChild(node, visit);
    }
    visit(file);
    return { findings, seen };
}

function extractFrontmatter({ source }: { readonly source: string }): {
    code: string;
    lineOffset: number;
} {
    const match = /^---\s*\n([\s\S]*?)\n---/m.exec(source);
    if (!match || match.index === undefined) return { code: '', lineOffset: 0 };
    return { code: match[1], lineOffset: source.slice(0, match.index).split('\n').length };
}

function maskClientAndComments(source: string): string {
    let clean = source;
    clean = clean.replace(/<!--[\s\S]*?-->/g, (part) => mask(part));
    clean = clean.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, (part) => mask(part));
    return clean;
}

function templateExpressions({ source }: { readonly source: string }): Array<{
    code: string;
    offset: number;
}> {
    let clean = maskClientAndComments(source);
    const fm = /^---\s*\n[\s\S]*?\n---/m.exec(clean);
    if (fm?.index !== undefined)
        clean = clean.slice(0, fm.index) + mask(fm[0]) + clean.slice(fm.index + fm[0].length);
    // Mask quoted text and comments before pairing Astro expression braces.
    const neutral = clean.replace(
        /\/\*[\s\S]*?\*\/|\/\/[^\n]*|`(?:\\.|[^`])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,
        mask
    );
    const expressions: Array<{ code: string; offset: number }> = [];
    for (let i = 0; i < neutral.length; i++) {
        if (neutral[i] !== '{') continue;
        let depth = 1;
        let end = i + 1;
        for (; end < neutral.length && depth > 0; end++) {
            if (neutral[end] === '{') depth++;
            if (neutral[end] === '}') depth--;
        }
        if (depth === 0) {
            expressions.push({ code: clean.slice(i + 1, end - 1), offset: i });
            i = end - 1;
        }
    }
    return expressions;
}

function scanLayout({ source }: { readonly source: string }): ScanResult {
    const frontmatter = extractFrontmatter({ source });
    const front = findInTs({
        source: frontmatter.code,
        lineOffset: frontmatter.lineOffset
    });
    const findings = [...front.findings];
    let seen = front.seen;
    for (const expression of templateExpressions({ source })) {
        const result = findInTs({
            source: expression.code,
            lineOffset: source.slice(0, expression.offset).split('\n').length - 1
        });
        findings.push(...result.findings);
        seen += result.seen;
    }
    return { findings, seen };
}

function failureMessage({
    filename,
    findings
}: {
    readonly filename: string;
    readonly findings: Finding[];
}): string {
    return `${filename}: unsafe SSR instantiation(s) at ${findings.map((item) => `${item.line} (${item.name})`).join(', ')}. Allow only disposable constructors or move code into the client-only branch.`;
}

describe('Web root layouts — Astro SSR instantiation guard', () => {
    it.each(
        ROOT_LAYOUT_FILES
    )('%s has no unsafe request-scoped instantiations and scanner sees real constructs', (filename) => {
        const source = readFileSync(resolve(LAYOUTS_DIR, filename), 'utf8');
        const result = scanLayout({ source });
        expect(
            result.seen,
            `${filename}: scanner must see at least one instantiation`
        ).toBeGreaterThan(0);
        expect(result.findings, failureMessage({ filename, findings: result.findings })).toEqual(
            []
        );
    });

    it('detects unsafe frontmatter and template instantiations, including server-side Vite branches', () => {
        const samples = [
            '---\ncreateFoo();\n---',
            '---\nconst qc = new QueryClient();\n---',
            '<main>{new Foo()}</main>',
            '---\nif (import.meta.env.SSR) { createX(); }\n---',
            '---\nconst leak = new Payloads.Client();\n---'
        ];
        for (const sample of samples)
            expect(scanLayout({ source: sample }).findings.length, sample).toBeGreaterThan(0);
    });

    it('allows disposable values and client branches while ignoring non-code and client content', () => {
        const safe = [
            '---\nconst url = new URL(path);\n---',
            "---\nif (typeof window !== 'undefined') { new X(); }\n---",
            '---\nif (!import.meta.env.SSR) { createX(); }\n---',
            '---\nif (import.meta.env.SSR) {} else { createX(); }\n---',
            '---\n// new X(); createFoo();\n/* new X(); */\nconst a = "createFoo()"; const b = `new X()`;\ngetApiUrl();\nbuildUrl();\ntoRegionalLocaleTag();\nfoo.createX();\n---',
            '<!-- new Foo(); createX() -->\n<div>{/* new Foo() */}</div>',
            '<script>new IntersectionObserver(() => {}); createBrowserOnly();</script><style>.x { color: red }</style>'
        ];
        for (const sample of safe)
            expect(scanLayout({ source: sample }).findings, sample).toEqual([]);
    });

    it('reports the source file, line, and remediation in the real-layout failure message', () => {
        const filename = 'SyntheticLayout.astro';
        const finding: Finding = { name: 'createLeak', line: 9 };
        const message = failureMessage({ filename, findings: [finding] });
        expect(message).toContain(filename);
        expect(message).toContain('9 (createLeak)');
        expect(message).toContain('move code');
    });
});
