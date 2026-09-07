/**
 * Unit tests for the native-dialog guard (HOS-957).
 *
 * These pin the guard's PREDICATE, not the repository's current state: each one
 * feeds a synthetic source string (or a synthetic tree) to the matcher and
 * asserts the verdict. The repo-wide run is the CI step; this is what stops the
 * predicate from silently becoming unable to fail — including the three ways it
 * is most likely to:
 *
 *  - prose about `window.confirm()` being read as code (there is a lot of it,
 *    in the very files the guard protects);
 *  - an anchor that lets `confirmDelete(` or `promise.confirm(` through, or
 *    that misses the bare `confirm(` form `apps/admin` uses;
 *  - a scan that quietly matches nothing and reports a clean tree.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
    collectSourceFiles,
    EXEMPTIONS,
    findNativeDialogCalls,
    MIN_SCANNED_FILES,
    maskCommentsAndStrings,
    NATIVE_DIALOGS,
    REPO_ROOT,
    run,
    scanRepo,
    scanRoots
} from '../check-no-native-dialogs.js';

// ---------------------------------------------------------------------------
// Throwaway trees, so fixtures cannot be confused with the real repo
// ---------------------------------------------------------------------------

const dirs: string[] = [];

afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** Writes `files` (repo-relative paths) into a throwaway repo root. */
function makeTree(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), 'nnd-'));
    dirs.push(root);
    for (const [rel, content] of Object.entries(files)) {
        const full = join(root, rel);
        mkdirSync(join(full, '..'), { recursive: true });
        writeFileSync(full, content, 'utf8');
    }
    return root;
}

/** A minimal repo shaped like the real one: a web app and one workspace package. */
function makeRepo(extra: Record<string, string> = {}): string {
    return makeTree({
        'apps/web/package.json': JSON.stringify({
            name: 'web',
            dependencies: { '@repo/feedback': 'workspace:*' }
        }),
        'packages/feedback/package.json': JSON.stringify({ name: '@repo/feedback' }),
        'packages/feedback/src/index.ts': 'export const ok = 1;\n',
        'apps/web/src/Clean.tsx': 'export const Clean = () => null;\n',
        ...extra
    });
}

/** The single line numbers of every call found in `source`. */
const linesOf = (source: string): number[] => findNativeDialogCalls(source).map((c) => c.line);

// ---------------------------------------------------------------------------
// Masking
// ---------------------------------------------------------------------------

describe('maskCommentsAndStrings', () => {
    it('preserves every offset', () => {
        const src = "// window.confirm(x)\nconst a = 'alert(1)';\n/* prompt(y) */\n";
        expect(maskCommentsAndStrings(src)).toHaveLength(src.length);
    });

    it('blanks a line comment', () => {
        expect(maskCommentsAndStrings('const a = 1; // window.confirm(x)')).not.toContain(
            'confirm'
        );
    });

    it('blanks a block comment', () => {
        expect(maskCommentsAndStrings('/**\n * window.confirm()\n */\nconst a = 1;')).not.toContain(
            'confirm'
        );
    });

    it('blanks an HTML comment, which .astro templates carry', () => {
        expect(maskCommentsAndStrings('<!-- window.confirm(x) -->\n<p>hi</p>')).not.toContain(
            'confirm'
        );
    });

    it('blanks the body of a single-quoted string', () => {
        expect(maskCommentsAndStrings("const u = 'javascript:alert(1)';")).not.toContain('alert');
    });

    it('keeps the quotes themselves so offsets stay readable', () => {
        const masked = maskCommentsAndStrings("const u = 'x';");
        expect(masked).toContain("' '");
    });

    it('does not let an escaped quote end the string early', () => {
        expect(maskCommentsAndStrings("const u = 'a\\'alert(1)';")).not.toContain('alert');
    });

    it('leaves a template literal interpolation as CODE', () => {
        // Assembled rather than written literally: a `${` inside a quoted string
        // is what `lint/suspicious/noTemplateCurlyInString` exists to flag.
        const dollar = '$';
        const src = `const s = \`before ${dollar}{confirm(x)} after\`;`;
        const masked = maskCommentsAndStrings(src);
        expect(masked).toContain('confirm(x)');
        expect(masked).not.toContain('before');
    });

    it('skips a regex literal whole', () => {
        expect(maskCommentsAndStrings('const re = /confirm\\(/;')).toContain('/confirm');
    });

    it('does not treat a division as a regex', () => {
        const masked = maskCommentsAndStrings("const a = b / c; const s = 'alert(1)';");
        expect(masked).not.toContain('alert');
    });
});

// ---------------------------------------------------------------------------
// The predicate: what counts as a call
// ---------------------------------------------------------------------------

describe('findNativeDialogCalls — what it catches', () => {
    it.each(NATIVE_DIALOGS)('catches a qualified window.%s()', (kind) => {
        const calls = findNativeDialogCalls(`if (window.${kind}('x')) return;`);
        expect(calls.map((c) => c.kind)).toEqual([kind]);
    });

    it.each(NATIVE_DIALOGS)('catches a BARE %s(), the form apps/admin uses', (kind) => {
        const calls = findNativeDialogCalls(`if (${kind}('x')) return;`);
        expect(calls.map((c) => c.kind)).toEqual([kind]);
    });

    it('catches globalThis and self, not just window', () => {
        expect(linesOf('globalThis.confirm(a);\nself.prompt(b);')).toEqual([1, 2]);
    });

    it('catches optional chaining', () => {
        expect(linesOf('window?.confirm(a);')).toEqual([1]);
    });

    it('catches whitespace between the parts', () => {
        expect(linesOf('window . confirm ( a );')).toEqual([1]);
    });

    it('catches bracket access, the evasion someone reaches for by accident', () => {
        const calls = findNativeDialogCalls("window['confirm']('x');");
        expect(calls.map((c) => c.kind)).toEqual(['confirm']);
    });

    it('reports the right line for a call deep in a file', () => {
        expect(linesOf(`${'const a = 1;\n'.repeat(9)}window.prompt('u');`)).toEqual([10]);
    });

    it('does not report the same call twice through two rules', () => {
        expect(findNativeDialogCalls("window.confirm('x');")).toHaveLength(1);
    });
});

describe('findNativeDialogCalls — what it must NOT catch', () => {
    it('ignores a JSDoc explaining why window.confirm() is wrong', () => {
        const src = [
            '/**',
            ' * - `window.confirm()` — shows the domain and cannot be styled.',
            ' * Replaces window.prompt(previous) and alert(msg).',
            ' */',
            'export const X = 1;'
        ].join('\n');
        expect(findNativeDialogCalls(src)).toEqual([]);
    });

    it('ignores an XSS fixture living inside a string', () => {
        expect(findNativeDialogCalls("const bad = 'javascript:alert(1)';")).toEqual([]);
    });

    it('ignores a longer identifier that merely starts with the name', () => {
        expect(findNativeDialogCalls('confirmDelete(id);\npromptForLink();')).toEqual([]);
    });

    it('ignores a longer identifier that merely ends with the name', () => {
        expect(findNativeDialogCalls('showConfirm(x);\ndoAlert(y);')).toEqual([]);
    });

    it("ignores a method on somebody else's object", () => {
        expect(findNativeDialogCalls('promise.confirm(x);\nthis.alert(y);')).toEqual([]);
    });

    it('ignores a global-looking receiver that is not the global', () => {
        expect(findNativeDialogCalls('myWindow.confirm(x);\nfakeSelf.prompt(y);')).toEqual([]);
    });

    it('ignores a MENTION that is not a call', () => {
        expect(findNativeDialogCalls('const has = typeof window.confirm === "function";')).toEqual(
            []
        );
    });

    it('ignores an unrelated bracket access', () => {
        expect(findNativeDialogCalls("styles['alert'](x);")).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// Scanning a tree
// ---------------------------------------------------------------------------

describe('collectSourceFiles', () => {
    it('skips test files, which legitimately name these dialogs', () => {
        const root = makeTree({
            'src/A.tsx': '',
            'src/A.test.tsx': '',
            'src/B.spec.ts': '',
            'src/__tests__/C.ts': '',
            'src/test/D.ts': '',
            'src/types.d.ts': ''
        });
        const found = collectSourceFiles(join(root, 'src')).map((f) => f.split('/').pop());
        expect(found).toEqual(['A.tsx']);
    });

    it('reads .astro as well as .ts/.tsx', () => {
        const root = makeTree({ 'src/A.astro': '', 'src/B.tsx': '', 'src/C.css': '' });
        const found = collectSourceFiles(join(root, 'src')).map((f) => f.split('/').pop());
        expect(found).toEqual(['A.astro', 'B.tsx']);
    });
});

describe('scanRoots', () => {
    it('includes the web app and every workspace package it depends on', () => {
        const root = makeRepo();
        expect(scanRoots(root).map((d) => d.replace(`${root}/`, ''))).toEqual([
            'apps/web/src',
            'packages/feedback/src'
        ]);
    });

    it('excludes a package the web app does NOT depend on', () => {
        const root = makeRepo({
            'packages/apionly/package.json': JSON.stringify({ name: '@repo/apionly' }),
            'packages/apionly/src/index.ts': 'window.confirm(1);\n'
        });
        expect(scanRoots(root).some((d) => d.includes('apionly'))).toBe(false);
    });
});

describe('scanRepo', () => {
    it('is clean on a tree with no native dialogs', () => {
        const scan = scanRepo(makeRepo());
        expect(scan.violations).toEqual([]);
        expect(scan.scanned).toBe(2);
    });

    it('reports a violation in the web app', () => {
        const scan = scanRepo(makeRepo({ 'apps/web/src/Bad.tsx': "window.confirm('x');\n" }));
        expect(scan.violations).toHaveLength(1);
        expect(scan.violations[0]).toContain('apps/web/src/Bad.tsx:1');
    });

    it('reports a violation inside a workspace package — the HOS-958 blind spot', () => {
        const scan = scanRepo(makeRepo({ 'packages/feedback/src/Bad.ts': "\nconfirm('x');\n" }));
        expect(scan.violations).toHaveLength(1);
        expect(scan.violations[0]).toContain('packages/feedback/src/Bad.ts:2');
    });

    it('records a root that yields no files instead of passing silently', () => {
        const root = makeRepo();
        rmSync(join(root, 'apps/web/src'), { recursive: true, force: true });
        const scan = scanRepo(root);
        expect(scan.roots.find((r) => r.root === 'apps/web/src')?.files).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// The exemption is exact, in both directions
// ---------------------------------------------------------------------------

describe('EXEMPTIONS', () => {
    const EXEMPT = 'apps/web/src/lib/forms/show-confirmation-dialog.tsx';

    it("names the replacement's own last-resort fallback, and nothing else", () => {
        expect([...EXEMPTIONS]).toEqual([[EXEMPT, 1]]);
    });

    it('lets the exempted file make exactly its budgeted call', () => {
        const scan = scanRepo(makeRepo({ [EXEMPT]: 'resolve(window.confirm(message));\n' }));
        expect(scan.violations).toEqual([]);
        expect(scan.exemptionErrors).toEqual([]);
    });

    it('fails when the exempted file makes a SECOND call — a budget, not a licence', () => {
        const scan = scanRepo(
            makeRepo({ [EXEMPT]: 'resolve(window.confirm(a));\nwindow.alert(b);\n' })
        );
        expect(scan.violations).toEqual([]);
        expect(scan.exemptionErrors.join('\n')).toContain('found 2');
    });

    it('fails when the exempted file no longer calls anything — a stale hole', () => {
        const scan = scanRepo(makeRepo({ [EXEMPT]: 'export const x = 1;\n' }));
        expect(scan.exemptionErrors.join('\n')).toContain('outlived its subject');
    });
});

// ---------------------------------------------------------------------------
// The real repository
// ---------------------------------------------------------------------------

describe('the repository itself', () => {
    it('passes the guard', () => {
        expect(run(REPO_ROOT)).toBe(0);
    });

    it('scans meaningfully more files than its own floor', () => {
        expect(scanRepo(REPO_ROOT).scanned).toBeGreaterThan(MIN_SCANNED_FILES);
    });

    it('has a floor that is not zero — a guard scanning nothing must not pass', () => {
        expect(MIN_SCANNED_FILES).toBeGreaterThan(0);
    });
});
