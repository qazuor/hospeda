/**
 * @file strip-checkout-return-params.test.ts
 * @description Regression tests for the HOS-209 checkout-return URL scrubber.
 *
 * The core test EXECUTES the exact inline snippet string that ships
 * (`STRIP_CHECKOUT_RETURN_PARAMS_SNIPPET`) against a jsdom `window`, proving the
 * visible URL no longer carries `preapproval_id` after it runs — no separate
 * reimplementation, so the test and the runtime can never drift.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
    CHECKOUT_RETURN_PARAMS_TO_STRIP,
    STRIP_CHECKOUT_RETURN_PARAMS_SNIPPET
} from '../../../src/components/billing/strip-checkout-return-params.snippet';

/**
 * Run the shipped inline snippet exactly as the browser would. The argument is
 * a STATIC module constant (never any untrusted input), so this is not code
 * injection — executing the exact shipped string is precisely what makes this a
 * drift-proof regression of the runtime behavior.
 */
function runSnippet(): void {
    const execute = new Function(STRIP_CHECKOUT_RETURN_PARAMS_SNIPPET);
    execute();
}

/** Point jsdom's location at the given same-origin path+query+hash. */
function setUrl(pathWithQuery: string): void {
    window.history.replaceState({}, '', pathWithQuery);
}

const SUCCESS_PATH = '/es/suscriptores/checkout/success/';

// Hermetic teardown: these tests mutate the shared jsdom `window.location` /
// `history`. Restore the default URL so nothing leaks into sibling test files
// that may share the worker's jsdom (guards against cross-file pollution under
// `--no-isolate`).
afterAll(() => {
    window.history.replaceState(null, '', '/');
});

describe('STRIP_CHECKOUT_RETURN_PARAMS_SNIPPET', () => {
    beforeEach(() => {
        setUrl(SUCCESS_PATH);
    });

    it('removes preapproval_id from the visible URL', () => {
        setUrl(`${SUCCESS_PATH}?preapproval_id=abc123`);

        runSnippet();

        expect(window.location.search).not.toContain('preapproval_id');
        expect(window.location.pathname).toBe(SUCCESS_PATH);
    });

    it('preserves every other query parameter and the hash', () => {
        setUrl(`${SUCCESS_PATH}?preapproval_id=abc123&foo=bar&baz=1#section`);

        runSnippet();

        expect(window.location.search).not.toContain('preapproval_id');
        expect(window.location.search).toContain('foo=bar');
        expect(window.location.search).toContain('baz=1');
        expect(window.location.hash).toBe('#section');
        expect(window.location.pathname).toBe(SUCCESS_PATH);
    });

    it('leaves an empty query string when preapproval_id was the only param', () => {
        setUrl(`${SUCCESS_PATH}?preapproval_id=abc123`);

        runSnippet();

        expect(window.location.search).toBe('');
        expect(window.location.pathname).toBe(SUCCESS_PATH);
    });

    it('is a no-op when no stripped param is present', () => {
        setUrl(`${SUCCESS_PATH}?collection_status=approved`);

        runSnippet();

        expect(window.location.search).toContain('collection_status=approved');
        expect(window.location.pathname).toBe(SUCCESS_PATH);
    });

    it('does not throw on a bare URL with no query string', () => {
        setUrl(SUCCESS_PATH);

        expect(() => runSnippet()).not.toThrow();
        expect(window.location.pathname).toBe(SUCCESS_PATH);
    });

    it('embeds the stripped-key list from CHECKOUT_RETURN_PARAMS_TO_STRIP (no drift)', () => {
        for (const key of CHECKOUT_RETURN_PARAMS_TO_STRIP) {
            expect(STRIP_CHECKOUT_RETURN_PARAMS_SNIPPET).toContain(key);
        }
        expect(CHECKOUT_RETURN_PARAMS_TO_STRIP).toContain('preapproval_id');
    });
});

describe('StripCheckoutReturnParams.astro', () => {
    const src = readFileSync(
        resolve(__dirname, '../../../src/components/billing/StripCheckoutReturnParams.astro'),
        'utf8'
    );

    it('renders an inline, nonce-guarded script that embeds the snippet', () => {
        expect(src).toContain('is:inline');
        expect(src).toContain('nonce={cspNonce}');
        expect(src).toContain('set:html={STRIP_CHECKOUT_RETURN_PARAMS_SNIPPET}');
    });
});

describe('checkout success.astro wiring', () => {
    const src = readFileSync(
        resolve(__dirname, '../../../src/pages/[lang]/suscriptores/checkout/success.astro'),
        'utf8'
    );

    it('mounts the scrubber first in the head via the head-early slot with the CSP nonce', () => {
        expect(src).toContain('StripCheckoutReturnParams');
        expect(src).toContain('slot="head-early"');
        expect(src).toContain('cspNonce={cspNonce}');
        expect(src).toContain('Astro.locals.cspNonce');
    });
});

describe('head-early slot plumbing', () => {
    const baseLayout = readFileSync(
        resolve(__dirname, '../../../src/layouts/BaseLayout.astro'),
        'utf8'
    );
    const marketingLayout = readFileSync(
        resolve(__dirname, '../../../src/layouts/MarketingLayout.astro'),
        'utf8'
    );

    it('BaseLayout renders the head-early slot before the PostHog snippet', () => {
        expect(baseLayout).toContain('name="head-early"');
        // Ordering guarantee: the scrubber must run before PostHog captures the
        // URL. Compare against the component USAGE (`<PostHogScript`), not the
        // top-of-file import, which naturally precedes everything in <head>.
        expect(baseLayout.indexOf('name="head-early"')).toBeLessThan(
            baseLayout.indexOf('<PostHogScript')
        );
    });

    it('MarketingLayout forwards head-early into BaseLayout head-early (not head)', () => {
        expect(marketingLayout).toContain('name="head-early" slot="head-early"');
    });
});
