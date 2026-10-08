/**
 * @file checkout-pages.test.ts
 * @description Source-reading tests for `/{lang}/suscriptores/checkout/index.astro`,
 * the role-aware redirect to the owner/tourist pricing page (BETA-201).
 *
 * The three MercadoPago return pages this file also used to cover
 * (`success`, `failure`, `pending` — SPEC-143 T-143-44 D1-D3) were removed with
 * the old billing (HOS-1637, AC:B13a:21), together with their no-store guard.
 *
 * Astro components cannot be rendered in Vitest/jsdom (sealed pattern,
 * see apps/web/CLAUDE.md "Testing"), so these tests assert on the source
 * text of the page.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const indexSrc = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/suscriptores/checkout/index.astro'),
    'utf8'
);

describe('SPEC-143 T-143-44 — checkout index redirect', () => {
    describe('index.astro (no-meaning landing redirects to /planes/)', () => {
        it('disables prerender because Astro.redirect needs SSR', () => {
            expect(indexSrc).toContain('export const prerender = false');
        });

        it('redirects role-aware (planes vs turistas) with HTTP 302 (BETA-201)', () => {
            // A bookmarked hit on the bare checkout root now redirects an owner
            // to the owner plans page and a tourist/anonymous visitor to the
            // tourist page, resolved via the shared helper (unit-tested in
            // src/lib/__tests__/account-roles.test.ts) — no longer a hardcoded
            // owner link. Emitted as an explicit Response (not Astro.redirect) so
            // the Cache-Control header rides along with the 302.
            expect(indexSrc).toContain('requestHasSessionCookie');
            expect(indexSrc).toContain('resolveSubscriptionPlansPath({ roles:');
            expect(indexSrc).toContain('status: 302');
            expect(indexSrc).toContain('Location:');
            expect(indexSrc).not.toContain("path: 'suscriptores/planes'");
        });

        it('opts the per-visitor redirect out of any CDN edge cache', () => {
            expect(indexSrc).toContain("'Cache-Control': 'private, no-store'");
        });

        it('uses the request locale via Astro.locals.locale, not Astro.params.lang', () => {
            // apps/web/CLAUDE.md sealed convention — the middleware
            // validates the lang and exposes it on locals. Accessing
            // Astro.params.lang skips the validation.
            expect(indexSrc).toContain('Astro.locals.locale');
            expect(indexSrc).not.toContain('Astro.params.lang');
        });
    });

    // -----------------------------------------------------------------------
    // Bug pin — orphan back_url
    //
    // The companion API-side test file documents in detail. Here we
    // pin the filesystem state: `/billing/return.astro` does NOT exist
    // in apps/web/src/pages. When the bug lands a fix, one of two
    // things will be true and the failure mode of this test points to
    // either:
    //
    //   (a) A new file exists at `apps/web/src/pages/[lang]/billing/return.astro`
    //       (or `apps/web/src/pages/billing/return.astro` without locale
    //       prefix) → flip this assertion to expect(true).
    //   (b) The API was changed to point back_url at one of the
    //       existing /suscriptores/checkout/* pages → delete this
    //       describe block entirely; the API-side test header already
    //       documents the fix.
    //
    // Engram topic_key: bug/back-url-orphan-billing-return.
    // -----------------------------------------------------------------------

    describe('PIN — back_url orphan: /billing/return.astro does not exist', () => {
        it('confirms no /[lang]/billing/return.astro page is mounted', () => {
            const localized = resolve(__dirname, '../../src/pages/[lang]/billing/return.astro');
            expect(existsSync(localized)).toBe(false);
        });

        it('confirms no unlocalized /billing/return.astro page is mounted either', () => {
            const unlocalized = resolve(__dirname, '../../src/pages/billing/return.astro');
            expect(existsSync(unlocalized)).toBe(false);
        });
    });
});
