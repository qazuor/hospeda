/**
 * @file feedback-lazy-css.test.ts
 * @description Guards for the @repo/feedback widget's stylesheets being off
 * the critical path (HOS-369 W3-5).
 *
 * ## The regression this exists to prevent
 *
 * `BaseLayout.astro` used to statically import both `@repo/feedback/styles.css`
 * and `@/styles/feedback-overrides.css`. That put 18,611 B of CSS
 * render-blocking on every page, even though `FeedbackHeadlessHost` — the only
 * consumer — hydrates with `client:idle` and cannot be interacted with before
 * that. The fix moved both imports into `load-feedback-styles.ts`, attached at
 * runtime via `ensureStylesheet` from the island's mount effect. Nothing at
 * runtime complains if someone re-adds a static import to "simplify" the
 * layout — this guard is the only thing that would.
 *
 * ## The order regression this exists to prevent
 *
 * `feedback-overrides.css` maps the package's neutral tokens onto the Hospeda
 * brand palette. It wins the cascade purely by loading AFTER
 * `@repo/feedback/styles.css` (same specificity, later wins) — not via higher
 * specificity or `!important`. If the two `ensureStylesheet` calls ever race
 * (e.g. someone "simplifies" `attachFeedbackStylesInOrder` into a
 * `Promise.all`), the FAB can render with the package's raw neutral colors
 * instead of the Hospeda brand palette, depending on network timing. This is
 * a visual bug with no test-visible symptom other than the one below.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const BASE_LAYOUT_PATH = resolve(__dirname, '../../src/layouts/BaseLayout.astro');

/**
 * Strips comments so the guard below sees code, not prose. This file's own
 * header (and BaseLayout's explanatory comment) necessarily quotes the
 * forbidden specifiers verbatim — a guard that flagged comments would force
 * deleting the documentation that makes the invariant understandable.
 *
 * Mirrors the identically-named helper in `lazy-vendor-css.test.ts`.
 */
function stripComments(source: string): string {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .filter((line) => {
            const t = line.trimStart();
            return !t.startsWith('//') && !t.startsWith('*');
        })
        .join('\n');
}

describe('BaseLayout.astro does not statically import the feedback stylesheets', () => {
    const rawSource = readFileSync(BASE_LAYOUT_PATH, 'utf8');
    const code = stripComments(rawSource);

    it.each([
        '@repo/feedback/styles.css',
        '@/styles/feedback-overrides.css'
    ] as const)('has no bare import of %s', (specifier) => {
        const escaped = specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // A bare static import — `import '<specifier>'` — is what makes
        // Astro hoist the stylesheet into every page's <head>. `?url`
        // suffixed imports (used by the runtime loader) are fine and are
        // NOT what this pattern matches.
        const bareImport = new RegExp(`\\bimport\\s*["']${escaped}["']`);

        expect(
            bareImport.test(code),
            `BaseLayout.astro statically imports ${specifier} again — this puts it back ` +
                'render-blocking on every page. Load it at runtime via ' +
                '`loadFeedbackStyles()` (components/feedback/load-feedback-styles.ts) instead.'
        ).toBe(false);
    });
});

describe('load-feedback-styles attaches the two sheets in order', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    /**
     * Mocks `ensureStylesheet` and records the `href` of each call, in call
     * order. The two real `?url` imports (`load-feedback-styles.ts`'s only
     * other dependency) are left un-mocked — they resolve to real, distinct
     * asset URLs via Vite's `?url` transform, which is exactly what lets this
     * test tell the two hrefs apart without hardcoding either one.
     */
    function mockEnsureStylesheet(): { order: string[] } {
        const order: string[] = [];
        vi.doMock('@/lib/ensure-stylesheet', () => ({
            ensureStylesheet: vi.fn(async ({ href }: { href: string }) => {
                order.push(href);
            })
        }));
        return { order };
    }

    it('attaches the @repo/feedback package sheet before the Hospeda overrides sheet', async () => {
        const { order } = mockEnsureStylesheet();

        const { loadFeedbackStyles } = await import('@/components/feedback/load-feedback-styles');
        await loadFeedbackStyles();

        expect(order).toHaveLength(2);
        expect(
            order[0],
            'the package sheet must attach before the overrides sheet — the override ' +
                'selectors win the cascade by load order, not specificity'
        ).not.toEqual(order[1]);
        expect(order[0]).toContain('packages/feedback/src/styles.css');
        expect(order[1]).toContain('feedback-overrides.css');
    });

    it('re-attaches both sheets, in the same order, on astro:after-swap', async () => {
        const { order } = mockEnsureStylesheet();

        const { loadFeedbackStyles } = await import('@/components/feedback/load-feedback-styles');
        await loadFeedbackStyles();
        const firstRun = [...order];
        order.length = 0;

        document.dispatchEvent(new Event('astro:after-swap'));
        // The re-attachment fires an async IIFE off the event listener; flush
        // the microtask queue so it has a chance to run before asserting.
        await Promise.resolve();
        await Promise.resolve();

        expect(
            order,
            'FeedbackHeadlessHost is transition:persist-ed and never remounts, so its ' +
                'mount effect only fires once per session. Astro drops the runtime-injected ' +
                '<link> on every navigation regardless — loadFeedbackStyles must re-attach ' +
                'both sheets on astro:after-swap or the FAB renders unstyled after one soft nav.'
        ).toEqual(firstRun);
    });
});
