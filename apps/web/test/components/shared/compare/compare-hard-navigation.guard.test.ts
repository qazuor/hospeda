/**
 * @file compare-hard-navigation.guard.test.ts
 * @description Static guard (HOS-566): every navigation to the accommodation
 * comparison page MUST force a full page load.
 *
 * Why a guard instead of per-component tests: the bug is a *missing attribute*
 * spread across N call sites, and the failure is invisible in unit tests — the
 * anchor renders fine either way. What breaks only shows up in a real browser
 * (the page's `client:only` islands never hydrate after a View Transition, so
 * the comparison renders blank). A guard is the only thing that catches the
 * fifth call site somebody adds next month.
 *
 * The rule: wherever `comparePageHref` is used as a navigation target, the same
 * call site must opt into a hard navigation —
 *   - JSX anchors  → the `data-astro-reload` attribute
 *   - toast actions → `reload: true` (rendered as the attribute by ToastViewport)
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Repo-relative paths that navigate to the comparison page. */
const CALL_SITES = [
    'src/components/shared/compare/CompareBar.client.tsx',
    'src/components/shared/compare/CompareButton.client.tsx',
    'src/components/shared/compare/CompareCardSelect.client.tsx',
    'src/components/accommodation/DetailCompareButton.client.tsx'
] as const;

/** The literal every call site builds to reach the comparison page. */
const COMPARE_PATH = 'alojamientos/comparar/';

/**
 * How many CODE lines after the `href` may carry the opt-in.
 *
 * Deliberately counted after stripping comments: an earlier version counted raw
 * lines, and adding a three-line explanatory comment above the attribute pushed
 * it out of the window — the guard then reported a missing opt-in that was
 * right there. A guard that a comment can flip is worse than no guard.
 */
const LOOKAHEAD_CODE_LINES = 8;

const WEB_ROOT = join(__dirname, '../../../..');

function readSource(relativePath: string): string {
    return readFileSync(join(WEB_ROOT, relativePath), 'utf8');
}

/**
 * Collect every line index where `comparePageHref` is handed to an `href`,
 * in either the JSX (`href={...}`) or object-literal (`href: ...`) form.
 */
function findHrefUsages(source: string): ReadonlyArray<number> {
    const lines = source.split('\n');
    const hits: number[] = [];
    lines.forEach((line, index) => {
        if (/href[={:\s]+comparePageHref/.test(line)) {
            hits.push(index);
        }
    });
    return hits;
}

/**
 * Whether the opt-in appears within the call site's own attribute/property
 * block. Scoped to a window so an unrelated opt-in elsewhere in the file
 * cannot vouch for this one.
 */
function hasHardNavOptIn(source: string, hrefLineIndex: number): boolean {
    // Drop comment lines FIRST, then take the window. A comment mentioning the
    // attribute must never satisfy the guard (that is how a fail-open sneaks
    // in), and it must not consume the budget either (that is how a false
    // alarm sneaks in).
    const codeLines = source
        .split('\n')
        .slice(hrefLineIndex)
        .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line));
    const window = codeLines.slice(0, LOOKAHEAD_CODE_LINES).join('\n');
    // Both patterns are anchored on purpose. An unanchored /data-astro-reload/
    // is satisfied by `data-astro-reloadX` — a typo that ships a broken page
    // while the guard stays green. Verified by mutation: renaming the attribute
    // must fail this test, not just deleting it.
    return /data-astro-reload(?![\w-])/.test(window) || /(?<![\w-])reload:\s*true\b/.test(window);
}

describe('HOS-566 — navigation to the comparison page forces a full page load', () => {
    it('knows about every file that links to the comparison page', () => {
        // Fails when a new call site appears outside CALL_SITES, so the list
        // cannot silently go stale.
        for (const relativePath of CALL_SITES) {
            const source = readSource(relativePath);
            expect(
                source.includes(COMPARE_PATH),
                `${relativePath} no longer references ${COMPARE_PATH} — update CALL_SITES`
            ).toBe(true);
        }
    });

    it.each(CALL_SITES)('%s opts into a hard navigation at every href', (relativePath) => {
        const source = readSource(relativePath);
        const usages = findHrefUsages(source);

        expect(
            usages.length,
            `${relativePath}: expected at least one \`href\` fed by comparePageHref — ` +
                'if the variable was renamed, this guard is now blind and must be updated'
        ).toBeGreaterThan(0);

        for (const lineIndex of usages) {
            expect(
                hasHardNavOptIn(source, lineIndex),
                `${relativePath}:${lineIndex + 1} navigates to the comparison page without ` +
                    'a hard-navigation opt-in (`data-astro-reload` on an anchor, or ' +
                    '`reload: true` on a toast action). Without it the page renders blank: ' +
                    'its client:only islands do not hydrate through a View Transition (HOS-566).'
            ).toBe(true);
        }
    });

    it('ToastViewport renders the attribute only when the action asks for it', () => {
        const source = readSource('src/components/ui/ToastViewport.client.tsx');
        // Presence-based attribute: it must be spread conditionally, never set
        // to a boolean/string value that would make it always present.
        expect(source).toMatch(/action\.reload\s*\?\s*\{\s*'data-astro-reload':\s*''\s*\}/);
    });
});
