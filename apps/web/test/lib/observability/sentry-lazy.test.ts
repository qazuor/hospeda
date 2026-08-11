/**
 * @file sentry-lazy.test.ts
 * @description Tests for the lazy Sentry facade plus the static guard that
 * keeps the SDK off the browser critical path (HOS-369).
 *
 * The guard matters more than the unit tests. Removing the SDK from the
 * critical path is a whole-graph property: ONE static
 * `import * as Sentry from '@sentry/astro'` anywhere in a browser module's
 * import graph pulls all ~236 KB back into the eagerly-fetched bundle, with no
 * test failure, no type error, and no visible symptom other than a slower LCP.
 * That is precisely the shape of regression a per-call-site unit test cannot
 * catch, so it is asserted statically over the source tree.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    captureException,
    captureFeedback,
    getLastEventId,
    isSentryLoaded,
    registerSentry,
    resetSentryLazyForTests
} from '@/lib/observability/sentry-lazy';

const APP_ROOT = resolve(__dirname, '../../..');
const SRC_ROOT = join(APP_ROOT, 'src');

/**
 * Modules that legitimately import the SDK statically because they only ever
 * run on the server (SSR / middleware) and never ship to the browser.
 * Adding an entry here is a deliberate act: it must be a server-only module.
 */
const SERVER_ONLY_ALLOWLIST = new Set([
    'lib/middleware-helpers.ts',
    'lib/internal-bypass-report.ts',
    // HOS-427. Reached only from `src/middleware.ts`, which is SSR-only, so it
    // cannot pull the SDK into a browser bundle. It cannot use the lazy facade
    // either: that is a BROWSER facade (`SentryBrowserApi`, populated by
    // `sentry.client.config.ts`), so on the server it would silently no-op —
    // and this is the alert that says a deploy left the edge cache stale.
    'lib/cache/purge-on-deploy.ts'
]);

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            collectSourceFiles(full, acc);
        } else if (/\.(ts|tsx|astro)$/.test(entry)) {
            acc.push(full);
        }
    }
    return acc;
}

describe('sentry-lazy — static guard against re-eagerising the SDK', () => {
    it('no browser module under src/ statically imports @sentry/*', () => {
        // Matches a real static import statement, not a mention in prose: the
        // facade's own JSDoc quotes the forbidden line verbatim as a warning.
        const staticImport = /^\s*import[\s\S]{0,120}?from\s*['"]@sentry\/[^'"]+['"]/m;

        const offenders = collectSourceFiles(SRC_ROOT)
            .filter((file) => staticImport.test(readFileSync(file, 'utf8')))
            .map((file) => relative(SRC_ROOT, file))
            .filter((rel) => !SERVER_ONLY_ALLOWLIST.has(rel));

        expect(
            offenders,
            'These modules statically import the Sentry SDK. If any of them reaches a browser ' +
                'bundle, ~236 KB of SDK + Session Replay returns to the eagerly-fetched critical ' +
                'path and HOS-369 silently regresses. Use `@/lib/observability/sentry-lazy` ' +
                'instead. Only add to SERVER_ONLY_ALLOWLIST if the module never runs in the browser.'
        ).toEqual([]);
    });

    it('sentry.client.config.ts loads the SDK dynamically, never statically', () => {
        const config = readFileSync(join(APP_ROOT, 'sentry.client.config.ts'), 'utf8');

        expect(
            config,
            'sentry.client.config.ts is emitted as a <script type="module"> in every page head. ' +
                'A static import there is fetched at high priority on every page load, for every ' +
                'visitor, including those who never consent to crash reporting.'
        ).not.toMatch(/^\s*import[\s\S]{0,120}?from\s*['"]@sentry\/[^'"]+['"]/m);

        expect(config).toMatch(/await\s+import\(\s*['"]@sentry\/astro['"]\s*\)/);
    });

    it('the SDK load is scheduled outside the LCP window', () => {
        const config = readFileSync(join(APP_ROOT, 'sentry.client.config.ts'), 'utf8');
        expect(config).toContain('requestIdleCallback');
        expect(config).toMatch(/addEventListener\(\s*['"]load['"]/);
    });
});

describe('sentry-lazy — facade behaviour', () => {
    beforeEach(() => {
        resetSentryLazyForTests();
    });

    afterEach(() => {
        resetSentryLazyForTests();
    });

    it('buffers exceptions raised before the SDK loads and replays them on register', () => {
        const first = new Error('before load');
        const second = new Error('also before load');

        captureException(first, { contexts: { react: { componentStack: 'x' } } });
        captureException(second);

        const sdk = { captureException: vi.fn(() => 'event-id') };
        expect(isSentryLoaded()).toBe(false);

        registerSentry(sdk);

        expect(isSentryLoaded()).toBe(true);
        expect(sdk.captureException).toHaveBeenCalledTimes(2);
        expect(sdk.captureException).toHaveBeenNthCalledWith(1, first, {
            contexts: { react: { componentStack: 'x' } }
        });
        expect(sdk.captureException).toHaveBeenNthCalledWith(2, second, undefined);
    });

    it('reports straight through once the SDK is registered', () => {
        const sdk = { captureException: vi.fn(() => 'event-id') };
        registerSentry(sdk);

        const error = new Error('after load');
        captureException(error);

        expect(sdk.captureException).toHaveBeenCalledTimes(1);
        expect(sdk.captureException).toHaveBeenCalledWith(error, undefined);
    });

    it('does not replay the buffer twice', () => {
        captureException(new Error('once'));

        const sdk = { captureException: vi.fn(() => 'id') };
        registerSentry(sdk);
        registerSentry(sdk);

        expect(sdk.captureException).toHaveBeenCalledTimes(1);
    });

    it('caps the buffer so an error loop cannot grow it without limit', () => {
        for (let i = 0; i < 50; i++) {
            captureException(new Error(`loop ${i}`));
        }

        const sdk = { captureException: vi.fn(() => 'id') };
        registerSentry(sdk);

        expect(sdk.captureException).toHaveBeenCalledTimes(10);
    });

    it('drops buffered exceptions when the SDK never loads (no consent)', () => {
        // No registerSentry() — the visitor declined crash reporting, so nothing
        // must ever be sent. Reaching this state must not throw.
        expect(() => captureException(new Error('never sent'))).not.toThrow();
        expect(isSentryLoaded()).toBe(false);
    });

    it('swallows an SDK that throws on capture', () => {
        registerSentry({
            captureException: () => {
                throw new Error('sdk exploded');
            }
        });

        expect(() => captureException(new Error('boom'))).not.toThrow();
    });

    it('returns undefined from getLastEventId until the SDK is registered', () => {
        expect(getLastEventId()).toBeUndefined();

        registerSentry({
            captureException: vi.fn(() => 'id'),
            lastEventId: () => 'abc123'
        });

        expect(getLastEventId()).toBe('abc123');
    });

    it('no-ops captureFeedback until the SDK is registered, then forwards', () => {
        expect(() => captureFeedback({ message: 'hi' })).not.toThrow();

        const captureFeedbackSpy = vi.fn();
        registerSentry({
            captureException: vi.fn(() => 'id'),
            captureFeedback: captureFeedbackSpy
        });

        captureFeedback({ message: 'hi' });
        expect(captureFeedbackSpy).toHaveBeenCalledWith({ message: 'hi' });
    });
});
