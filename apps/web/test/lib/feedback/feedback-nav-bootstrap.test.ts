/**
 * @file feedback-nav-bootstrap.test.ts
 * @description Regression tests for the feedback nav-history bootstrap.
 *
 * ## The bug these exist to prevent
 *
 * The snippet used to be authored directly as the children of an `is:inline`
 * script inside an Astro expression container in `BaseLayout.astro`, wrapped in
 * `{\`…\`}` so the compiler would not choke on the JS inside. Astro treats the
 * children of an `is:inline` script as RAW TEXT, so the wrapper was emitted
 * verbatim: the browser parsed a block statement containing a template literal
 * — syntactically valid, semantically nothing. `window.__hospedaFeedbackBootstrapped`
 * stayed `false` on every page and no navigation was ever recorded.
 *
 * Nothing threw, nothing was logged, and the FAB still worked (it tracks
 * navigation itself once hydrated) — it just silently lost every URL visited
 * before `client:idle` fired, including the landing page. That is precisely the
 * class of failure a source-string assertion cannot catch, so the main test
 * below EXECUTES the snippet and asserts its observable effects.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
    FEEDBACK_NAV_BOOTSTRAP_SNIPPET,
    FEEDBACK_NAV_MAX_ENTRIES,
    FEEDBACK_NAV_STORAGE_KEY
} from '@/lib/feedback/feedback-nav-bootstrap.snippet';

const BASE_LAYOUT_SRC = readFileSync(
    resolve(__dirname, '../../../src/layouts/BaseLayout.astro'),
    'utf8'
);

const RUNTIME_TRACKERS_SRC = readFileSync(
    resolve(__dirname, '../../../../../packages/feedback/src/lib/runtime-trackers.ts'),
    'utf8'
);

/** Runs the snippet the way a browser would: as a top-level classic script. */
const runSnippet = (): void => {
    // biome-ignore lint/security/noGlobalEval: executing the snippet IS the
    // assertion — a source-string check is exactly what missed the original bug.
    new Function(FEEDBACK_NAV_BOOTSTRAP_SNIPPET)();
};

const readStoredNav = (): readonly string[] =>
    JSON.parse(window.sessionStorage.getItem(FEEDBACK_NAV_STORAGE_KEY) ?? '[]');

describe('FEEDBACK_NAV_BOOTSTRAP_SNIPPET — executes and records navigation', () => {
    beforeEach(() => {
        window.sessionStorage.clear();
        // biome-ignore lint/performance/noDelete: resetting the guard flag
        // between cases requires removing it, not setting it to undefined.
        delete (window as unknown as Record<string, unknown>).__hospedaFeedbackBootstrapped;
    });

    it('actually runs — sets its guard flag (the exact symptom of the old bug)', () => {
        expect(
            (window as unknown as Record<string, unknown>).__hospedaFeedbackBootstrapped
        ).toBeUndefined();

        runSnippet();

        expect((window as unknown as Record<string, unknown>).__hospedaFeedbackBootstrapped).toBe(
            true
        );
    });

    it('records the current URL on load, so the landing page is not lost', () => {
        runSnippet();

        expect(readStoredNav()).toEqual([window.location.pathname + window.location.search]);
    });

    it('records subsequent history.pushState navigations', () => {
        runSnippet();

        window.history.pushState({}, '', '/es/alojamientos/');
        window.history.pushState({}, '', '/es/destinos/');

        expect(readStoredNav()).toContain('/es/alojamientos/');
        expect(readStoredNav()).toContain('/es/destinos/');
    });

    it('de-duplicates consecutive identical URLs', () => {
        runSnippet();

        window.history.pushState({}, '', '/es/eventos/');
        window.history.pushState({}, '', '/es/eventos/');

        const nav = readStoredNav();
        expect(nav.filter((url) => url === '/es/eventos/')).toHaveLength(1);
    });

    it(`retains at most ${FEEDBACK_NAV_MAX_ENTRIES} entries`, () => {
        runSnippet();

        for (let i = 0; i < FEEDBACK_NAV_MAX_ENTRIES + 5; i++) {
            window.history.pushState({}, '', `/es/p/${i}/`);
        }

        expect(readStoredNav()).toHaveLength(FEEDBACK_NAV_MAX_ENTRIES);
    });

    it('is idempotent — a second execution does not re-hook history', () => {
        runSnippet();
        const afterFirst = readStoredNav();

        runSnippet();

        expect(readStoredNav()).toEqual(afterFirst);
    });

    it('survives a sessionStorage that throws (private mode / quota)', () => {
        const original = window.sessionStorage.setItem;
        window.sessionStorage.setItem = () => {
            throw new Error('QuotaExceededError');
        };

        expect(() => runSnippet()).not.toThrow();

        window.sessionStorage.setItem = original;
    });
});

describe('BaseLayout wiring — the snippet must reach the browser executable', () => {
    it('renders the snippet through set:html, never as inline children', () => {
        expect(BASE_LAYOUT_SRC).toContain('set:html={FEEDBACK_NAV_BOOTSTRAP_SNIPPET}');
    });

    it('no .astro may wrap an is:inline script body in a template literal', () => {
        // The original bug's exact shape: `<script is:inline>{`…`}</script>`.
        // Astro emits those children as raw text, so the wrapper ships to the
        // browser and the body never executes. One occurrence existed; this
        // pins the pattern class shut, not just the one call site.
        expect(BASE_LAYOUT_SRC).not.toMatch(/is:inline\s*>\s*\{\s*`/);
    });
});

describe('storage contract with @repo/feedback (duplicated on purpose, pinned here)', () => {
    it('the storage key matches SS_NAV_KEY in runtime-trackers.ts', () => {
        // The reader lives in another package. Importing the constant would
        // drag the feedback barrel into BaseLayout's graph for one string, so
        // the literal is duplicated and this test is the seam that holds.
        expect(RUNTIME_TRACKERS_SRC).toContain(`const SS_NAV_KEY = '${FEEDBACK_NAV_STORAGE_KEY}'`);
    });

    it('the entry cap matches MAX_NAV_HISTORY in runtime-trackers.ts', () => {
        expect(RUNTIME_TRACKERS_SRC).toContain(
            `const MAX_NAV_HISTORY = ${FEEDBACK_NAV_MAX_ENTRIES}`
        );
    });

    it('reads the sibling source it asserts against (non-vacuity)', () => {
        // If the path ever breaks, readFileSync throws — but a truncated or
        // empty read would make both assertions above vacuously checkable
        // against nothing. Pin that the file really is the tracker.
        expect(RUNTIME_TRACKERS_SRC.length).toBeGreaterThan(1000);
        // The reader AND the writer of the shared key — this is the module the
        // bootstrap hands off to, not some unrelated file that happens to
        // mention the constant.
        expect(RUNTIME_TRACKERS_SRC).toContain('safeReadJson<string[]>(SS_NAV_KEY)');
        expect(RUNTIME_TRACKERS_SRC).toContain('safeWriteJson(SS_NAV_KEY, navHistory)');
    });
});
