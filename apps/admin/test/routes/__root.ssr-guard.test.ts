/**
 * @file SSR Memory Leak Guard — Admin Root
 *
 * Static-analysis test for SPEC-209 AC-3.1 / T-007.
 *
 * The admin root component (apps/admin/src/routes/__root.tsx) previously
 * constructed a `createQZPayBilling(` instance inside `useState(() => ...)`
 * at the top level of `RootDocument`. On TanStack Start SSR the root component
 * mounts once PER REQUEST, so `useState` lazy-initializers run server-side
 * and every healthcheck hit produces a fresh QZPayBilling instance (~990
 * "QZPayBilling initialized" log lines / 48h).
 *
 * The ONLY safe guards for client-only code in an SSR root are:
 *   - Inside a `useEffect(` callback (never runs on server)
 *   - Behind `typeof window !== 'undefined'`
 *   - Behind `import.meta.env.SSR` checks
 *
 * `useState(` is NOT a guard: its lazy initializer executes on the server
 * for every request.
 *
 * EXPECTED STATE: this test FAILS on the current (unfixed) __root.tsx because
 * `createQZPayBilling(` appears inside a `useState(` lazy initializer without
 * any client-only guard. The failing test is the TDD regression evidence.
 * Task T-009 applies the fix; that turns this test green.
 *
 * DO NOT add `.skip` / `.fails` / `.only` — the red must be visible in CI.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolves the admin root route source file relative to this test file.
 * Path: <repo>/apps/admin/src/routes/__root.tsx
 */
function readRootSource(): string {
    const rootPath = resolve(__dirname, '../../src/routes/__root.tsx');
    return readFileSync(rootPath, 'utf-8');
}

/**
 * Returns the 1-based line number for a 0-based character offset within
 * `source`.
 */
function lineAtOffset(source: string, offset: number): number {
    return source.slice(0, offset).split('\n').length;
}

/**
 * Given a source string and an offset pointing to the `(` after `useEffect`,
 * returns true if the given target offset falls within the body of that
 * useEffect call.
 *
 * Strategy: scan forward from the `useEffect(` opener, tracking brace/paren
 * depth, until we find the matching closing `)` that ends the call. If the
 * target offset is between the opener and the closer, it's inside.
 */
function isInsideUseEffect(source: string, useEffectOffset: number, targetOffset: number): boolean {
    if (targetOffset <= useEffectOffset) return false;

    let depth = 0;
    let i = useEffectOffset;

    // Walk forward from `useEffect(` — the character AT useEffectOffset is `(`
    for (; i < source.length; i++) {
        const ch = source[i];
        if (ch === '(' || ch === '{' || ch === '[') {
            depth++;
        } else if (ch === ')' || ch === '}' || ch === ']') {
            depth--;
            if (depth === 0) {
                // i is now at the closing `)` of the useEffect() call
                return targetOffset < i;
            }
        }
    }
    return false;
}

/**
 * Returns true when the `createQZPayBilling(` at `targetOffset` is protected
 * by at least one of the accepted client-only guards anywhere in the source
 * text that wraps it:
 *
 *   1. Inside a `useEffect(` callback.
 *   2. After a `typeof window` guard on the same logical block.
 *   3. After an `import.meta.env.SSR` guard.
 *
 * For the simpler guards (2 & 3) we check whether the string appears
 * in the 500-character window before the target offset, which is sufficient
 * for the conditional patterns we expect (`if (typeof window !== 'undefined')`,
 * `if (!import.meta.env.SSR)`, etc.).
 */
function isClientOnlyGuarded(source: string, targetOffset: number): boolean {
    // Guard 1: inside a useEffect callback
    let searchFrom = 0;
    while (searchFrom < targetOffset) {
        const useEffectIdx = source.indexOf('useEffect(', searchFrom);
        if (useEffectIdx === -1 || useEffectIdx >= targetOffset) break;
        if (isInsideUseEffect(source, useEffectIdx, targetOffset)) {
            return true;
        }
        searchFrom = useEffectIdx + 1;
    }

    // Guard 2 & 3: `typeof window` or `import.meta.env.SSR` in the 500-char
    // window preceding the call (covers if/ternary patterns).
    const lookback = source.slice(Math.max(0, targetOffset - 500), targetOffset);
    if (lookback.includes('typeof window') || lookback.includes('import.meta.env.SSR')) {
        return true;
    }

    return false;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Admin __root.tsx — SSR memory-leak guard (SPEC-209 AC-3.1)', () => {
    it('createQZPayBilling( must not appear in __root.tsx at all when unguarded (file existence check)', () => {
        // Arrange
        const source = readRootSource();

        // Act: collect every occurrence of the dangerous call
        const NEEDLE = 'createQZPayBilling(';
        const occurrences: Array<{ line: number; offset: number }> = [];
        let searchFrom = 0;
        while (true) {
            const idx = source.indexOf(NEEDLE, searchFrom);
            if (idx === -1) break;
            occurrences.push({ line: lineAtOffset(source, idx), offset: idx });
            searchFrom = idx + NEEDLE.length;
        }

        // If there are no occurrences at all the file is already clean.
        // (Future: if the call is removed entirely the guard still passes.)
        if (occurrences.length === 0) return;

        // Assert: every occurrence must be inside a client-only guard
        const unguarded = occurrences.filter(({ offset }) => !isClientOnlyGuarded(source, offset));

        expect(
            unguarded,
            [
                `Found ${unguarded.length} unguarded createQZPayBilling( call(s) in __root.tsx.`,
                'This call executes on every SSR request because useState() lazy-initializers',
                'run server-side, causing a new QZPayBilling instance per healthcheck hit.',
                '',
                `Unguarded occurrence(s) at line(s): ${unguarded.map((o) => o.line).join(', ')}`,
                '',
                'Fix: move the call inside a useEffect() callback (client-only) or behind',
                'a typeof window !== "undefined" / import.meta.env.SSR guard.'
            ].join('\n')
        ).toHaveLength(0);
    });
});
