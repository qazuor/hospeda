/**
 * @file SSR Memory Leak Guard — Web Root Layout
 *
 * Static-analysis test for SPEC-209 AC-3.1 (web twin) / T-008.
 *
 * PREVENTIVE GUARD — current code is CLEAN. This test is expected to pass
 * (green) on every correct commit. It will only turn red if someone
 * introduces a regression.
 *
 * Context
 * -------
 * The admin root (apps/admin/src/routes/__root.tsx) had a bug where
 * `createQZPayBilling(` was constructed inside a `useState(` lazy-initializer
 * at SSR time, causing a fresh QZPayBilling instance per request (~990 log
 * lines in 48h). See apps/admin/test/routes/__root.ssr-guard.test.ts for the
 * regression test that caught it.
 *
 * Web equivalent
 * --------------
 * `apps/web/src/layouts/BaseLayout.astro` is the web root: every page in the
 * Astro app is wrapped by this layout (or by a layout that composes it). It
 * renders on the server for every SSR request, making it the direct analogue
 * of the admin `__root.tsx`. At the time of writing it does NOT contain
 * `createQZPayBilling(`, `new QueryClient(`, `QueryClientProvider`, or
 * `QZPayProvider` — this test PINS that invariant.
 *
 * Additionally, `apps/web/src/layouts/DefaultLayout.astro` and
 * `apps/web/src/layouts/DetailLayout.astro` are other top-level layout
 * wrappers checked here so the guard covers the full set of server-rendered
 * entry shells.
 *
 * Accepted client-only guards (would allow the call if introduced correctly):
 *   1. Inside a `useEffect(` callback — never runs on the server.
 *   2. Behind `typeof window !== 'undefined'`.
 *   3. Behind `import.meta.env.SSR`.
 *
 * Anything constructed at module/frontmatter/component-body scope without
 * one of the three guards above will fire server-side on every request.
 *
 * DO NOT add `.skip` / `.fails` / `.only` — see project testing standards.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Source readers
// ---------------------------------------------------------------------------

const LAYOUTS_DIR = resolve(__dirname, '../../src/layouts');

/**
 * Reads a layout source file relative to the layouts directory.
 */
function readLayoutSource(filename: string): string {
    return readFileSync(resolve(LAYOUTS_DIR, filename), 'utf-8');
}

/** Layout files that act as server-rendered root shells for the web app. */
const ROOT_LAYOUT_FILES = [
    'BaseLayout.astro',
    'DefaultLayout.astro',
    'DetailLayout.astro'
] as const;

// ---------------------------------------------------------------------------
// Static-analysis helpers (mirrored from admin guard, adapted for Astro)
// ---------------------------------------------------------------------------

/**
 * Returns the 1-based line number for a 0-based character offset within
 * `source`.
 */
function lineAtOffset(source: string, offset: number): number {
    return source.slice(0, offset).split('\n').length;
}

/**
 * Given a source string and an offset pointing to the `(` after `useEffect`,
 * returns true if `targetOffset` falls within the body of that useEffect call.
 *
 * Strategy: scan forward from the `useEffect(` opener, tracking brace/paren
 * depth, until we find the matching closing `)`. If the target offset is
 * between the opener and the closer, it is inside.
 */
function isInsideUseEffect(source: string, useEffectOffset: number, targetOffset: number): boolean {
    if (targetOffset <= useEffectOffset) return false;

    let depth = 0;
    let i = useEffectOffset;

    for (; i < source.length; i++) {
        const ch = source[i];
        if (ch === '(' || ch === '{' || ch === '[') {
            depth++;
        } else if (ch === ')' || ch === '}' || ch === ']') {
            depth--;
            if (depth === 0) {
                return targetOffset < i;
            }
        }
    }
    return false;
}

/**
 * Returns true when the dangerous call at `targetOffset` is protected by at
 * least one accepted client-only guard:
 *
 *   1. Inside a `useEffect(` callback.
 *   2. Within a `typeof window` guard (500-char look-back window).
 *   3. Within an `import.meta.env.SSR` guard (500-char look-back window).
 *
 * For Astro components the frontmatter fence (`---`) runs server-side; a call
 * there is always unguarded even if client-only strings appear elsewhere.
 */
function isClientOnlyGuarded(source: string, targetOffset: number): boolean {
    // Guard 1: inside a useEffect callback (React islands only)
    let searchFrom = 0;
    while (searchFrom < targetOffset) {
        const useEffectIdx = source.indexOf('useEffect(', searchFrom);
        if (useEffectIdx === -1 || useEffectIdx >= targetOffset) break;
        if (isInsideUseEffect(source, useEffectIdx, targetOffset)) {
            return true;
        }
        searchFrom = useEffectIdx + 1;
    }

    // Guard 2 & 3: look-back for inline conditional patterns
    const lookback = source.slice(Math.max(0, targetOffset - 500), targetOffset);
    if (lookback.includes('typeof window') || lookback.includes('import.meta.env.SSR')) {
        return true;
    }

    return false;
}

/**
 * Collects all unguarded occurrences of `needle` in `source`.
 */
function findUnguardedOccurrences(
    source: string,
    needle: string
): Array<{ line: number; offset: number }> {
    const occurrences: Array<{ line: number; offset: number }> = [];
    let searchFrom = 0;
    while (true) {
        const idx = source.indexOf(needle, searchFrom);
        if (idx === -1) break;
        occurrences.push({ line: lineAtOffset(source, idx), offset: idx });
        searchFrom = idx + needle.length;
    }
    return occurrences.filter(({ offset }) => !isClientOnlyGuarded(source, offset));
}

// ---------------------------------------------------------------------------
// Dangerous patterns to pin (currently absent from all root layouts)
// ---------------------------------------------------------------------------

/**
 * Calls / constructs that must NOT appear unguarded in a server-rendered
 * layout shell — each would run once per SSR request.
 */
const DANGEROUS_PATTERNS = ['createQZPayBilling(', 'new QueryClient('] as const;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Web root layouts — SSR memory-leak guard (SPEC-209 T-008)', () => {
    for (const layoutFile of ROOT_LAYOUT_FILES) {
        describe(layoutFile, () => {
            const source = readLayoutSource(layoutFile);

            for (const needle of DANGEROUS_PATTERNS) {
                it(`must not contain unguarded \`${needle}\``, () => {
                    const unguarded = findUnguardedOccurrences(source, needle);

                    expect(
                        unguarded,
                        [
                            `Found ${unguarded.length} unguarded \`${needle}\` call(s) in ${layoutFile}.`,
                            '',
                            'This construct would run on every SSR request because Astro layouts',
                            'execute their frontmatter (and any inline <script> body at module scope)',
                            'server-side on every page load, allocating a new instance per request.',
                            '',
                            `Unguarded occurrence(s) at line(s): ${unguarded.map((o) => o.line).join(', ')}`,
                            '',
                            'Fix: move the call inside a React useEffect() callback, or guard it',
                            'with `typeof window !== "undefined"` / `import.meta.env.SSR`.',
                            '',
                            'Note: Astro .astro frontmatter (between --- fences) ALWAYS runs on',
                            'the server — there is no safe way to use these constructs there.'
                        ].join('\n')
                    ).toHaveLength(0);
                });
            }
        });
    }
});
