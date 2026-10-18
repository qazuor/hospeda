/** B3 UI (B3.md:1045-1053); source tests for the protected checkout route. */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const indexSrc = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/suscriptores/checkout/index.astro'),
    'utf8'
);

describe('signup checkout page — B3 UI (B3.md:1045-1053)', () => {
    it('keeps the role-aware redirect for a missing or invalid option', () => {
        expect(indexSrc).toContain('parseSignupOptionId({ search: Astro.url.search })');
        expect(indexSrc).toContain('if (!optionId)');
        expect(indexSrc).toContain('resolveSubscriptionPlansPath({ roles: user?.roles ?? null })');
        expect(indexSrc).toContain('status: 302');
    });

    it('sets private no-store on the redirect, login, and rendered page responses', () => {
        expect(indexSrc.match(/'Cache-Control': 'private, no-store'/g)).toHaveLength(2);
        expect(indexSrc).toContain(
            "Astro.response.headers.set('Cache-Control', 'private, no-store')"
        );
    });

    it('requires a session for a valid option and preserves the full return URL', () => {
        expect(indexSrc).toContain('requestHasSessionCookie(cookieHeader)');
        expect(indexSrc).toContain('parseSessionUser({ cookieHeader })');
        expect(indexSrc).toContain('if (!user)');
        expect(indexSrc).toContain(
            'buildLoginRedirect({ locale, currentUrl: Astro.url.pathname + Astro.url.search })'
        );
    });

    it('renders the checkout island on load with request locale and noindex metadata', () => {
        expect(indexSrc).toContain('Astro.locals.locale');
        expect(indexSrc).not.toContain('Astro.params.lang');
        expect(indexSrc).toContain('<SignupCheckout');
        expect(indexSrc).toContain('trialNotice={trialNotice}');
        expect(indexSrc).toContain('touristVipNotice={touristVipNotice}');
        expect(indexSrc).toContain('billingSubscriptionApi.signupNotice');
        expect(indexSrc).toContain('noindex={true}');
        expect(indexSrc).toContain('canonical={canonicalUrl}');
        expect(indexSrc).toContain("t('billing.checkout.signup.title')");
    });
});

// -----------------------------------------------------------------------
// Bug pin — orphan back_url
//
// The companion API-side test file documents in detail. Here we
// pin the filesystem state: `/billing/return.astro` does NOT exist in
// apps/web/src/pages. When the bug lands a fix, one of two
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
