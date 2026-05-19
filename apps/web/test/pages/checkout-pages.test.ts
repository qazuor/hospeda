/**
 * @file checkout-pages.test.ts
 * @description Source-reading tests for the MercadoPago return pages
 * `/{lang}/suscriptores/checkout/{success,failure,pending,index}.astro`.
 *
 * SPEC-143 T-143-44 part 2 — sub-flows D1 (success-redirect),
 * D2 (failure-redirect), D3 (pending-redirect), plus the supporting
 * `index.astro` redirect to `/planes/`.
 *
 * Astro components cannot be rendered in Vitest/jsdom (sealed pattern,
 * see apps/web/CLAUDE.md "Testing"), so these tests assert on the source
 * text of each page. Each describe captures the contract that file would
 * break if a future refactor regresses it:
 *
 *   - SSR is required (the pages must read query params server-side).
 *   - Each variant flips on the documented MP-side parameter.
 *   - No sensitive payment identifiers leak into the HTML.
 *   - The CTAs route to the correct locale-aware URLs.
 *
 * The companion API-side suite for T-143-44 lives at
 * `apps/api/test/e2e/flows/billing/auth-redirect-cancel-flows.test.ts`
 * and covers D4/D6/D7/D8. D5 (browser-back) is Workstream B manual
 * smoke (`docs/staging-smoke-checklist.md`).
 *
 * Bug pin attached at the end of this file: the MP back_url configured
 * by `apps/api/src/routes/billing/start-paid.ts` resolves to
 * `${HOSPEDA_SITE_URL}/billing/return`, which does NOT exist in
 * apps/web. The real pages tested here live at
 * `/{lang}/suscriptores/checkout/*`. Engram topic:
 * `bug/back-url-orphan-billing-return`.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const successSrc = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/suscriptores/checkout/success.astro'),
    'utf8'
);

const failureSrc = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/suscriptores/checkout/failure.astro'),
    'utf8'
);

const pendingSrc = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/suscriptores/checkout/pending.astro'),
    'utf8'
);

const indexSrc = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/suscriptores/checkout/index.astro'),
    'utf8'
);

/**
 * Split an Astro file into its frontmatter (between the first pair of
 * `---` fences, JS/TS code) and its template body (everything after).
 * Used to scope sensitivity asserts at the rendered surface — comments
 * mentioning `payment_id` in the frontmatter JSDoc are legitimate
 * documentation; the same string in the template would leak it into
 * the HTML.
 */
function splitAstroSrc(src: string): { readonly frontmatter: string; readonly body: string } {
    const open = src.indexOf('---');
    if (open === -1) return { frontmatter: '', body: src };
    const close = src.indexOf('---', open + 3);
    if (close === -1) return { frontmatter: '', body: src };
    return {
        frontmatter: src.slice(open + 3, close),
        body: src.slice(close + 3)
    };
}

const SENSITIVE_TOKENS = ['payment_id', 'preference_id', 'paymentId', 'preferenceId'] as const;

const successParts = splitAstroSrc(successSrc);
const failureParts = splitAstroSrc(failureSrc);
const pendingParts = splitAstroSrc(pendingSrc);

describe('SPEC-143 T-143-44 — checkout return pages (D1, D2, D3, index)', () => {
    // -----------------------------------------------------------------------
    // D1 — success.astro
    // -----------------------------------------------------------------------

    describe('D1 — success.astro (MercadoPago approved-payment landing)', () => {
        it('disables prerender so query params can be read server-side', () => {
            expect(successSrc).toContain('export const prerender = false');
        });

        it('reads collection_status from the URL search params', () => {
            expect(successSrc).toContain("Astro.url.searchParams.get('collection_status')");
        });

        it("branches on collectionStatus === 'approved' to pick the variant", () => {
            expect(successSrc).toContain("collectionStatus === 'approved'");
            // The CheckoutResult variant is approved → 'success', anything
            // else → 'pending'. Pin both branches so a regression to
            // a single-variant render fails this test.
            expect(successSrc).toContain("variant={isApproved ? 'success' : 'pending'}");
        });

        it('routes the primary CTA to /mi-cuenta via buildUrl with the page locale', () => {
            expect(successSrc).toContain("path: 'mi-cuenta'");
            expect(successSrc).toContain('href: miCuentaUrl');
        });

        it('renders inside MarketingLayout (no auth required — MP may redirect anonymously)', () => {
            expect(successSrc).toContain('MarketingLayout');
            expect(successSrc).toContain('No auth required');
        });

        it('does not render any sensitive MP identifier in the template body', () => {
            // The page only consumes collection_status. payment_id,
            // preference_id, and other identifiers MP appends to the
            // return URL must never appear in the rendered HTML.
            // Frontmatter comments documenting the contract are
            // legitimate; the template body must stay clean.
            for (const token of SENSITIVE_TOKENS) {
                expect(successParts.body).not.toContain(token);
            }
        });

        it('does not read any sensitive MP identifier from search params', () => {
            // The frontmatter must not call searchParams.get with
            // any sensitive key — that is the upstream gate before
            // the value can leak into the template via interpolation.
            for (const token of SENSITIVE_TOKENS) {
                expect(successParts.frontmatter).not.toMatch(
                    new RegExp(`searchParams\\.get\\(['"\`]${token}['"\`]\\)`)
                );
            }
        });
    });

    // -----------------------------------------------------------------------
    // D2 — failure.astro
    // -----------------------------------------------------------------------

    describe('D2 — failure.astro (MercadoPago rejected-payment landing)', () => {
        it('disables prerender so query params can be read server-side', () => {
            expect(failureSrc).toContain('export const prerender = false');
        });

        it('reads only status_detail (the documented non-sensitive MP failure reason)', () => {
            expect(failureSrc).toContain("Astro.url.searchParams.get('status_detail')");
        });

        it('maps status_detail through resolveReasonI18nKey for a friendly message', () => {
            expect(failureSrc).toContain('resolveReasonI18nKey(statusDetail)');
            // Generic fallback when MP did not provide a recognisable
            // status_detail. This branch carries the user-facing message
            // for an unmapped MP error code; if the fallback is removed
            // the page renders an empty body.
            expect(failureSrc).toContain('billing.checkout.failure.genericMessage');
        });

        it('routes the retry CTA to /suscriptores/planes', () => {
            expect(failureSrc).toContain("path: 'suscriptores/planes'");
            expect(failureSrc).toContain('href: planesUrl');
        });

        it('routes the support CTA to /contacto', () => {
            expect(failureSrc).toContain("path: 'contacto'");
            expect(failureSrc).toContain('href: supportUrl');
        });

        it('declares the no-sensitive-data invariant in the header comment', () => {
            // The page header documents this contract explicitly. Anchor
            // on the wording so a stripped/refactored comment is caught
            // — the invariant must remain visible to future editors.
            expect(failureParts.frontmatter).toContain('Sensitive data');
        });

        it('does not leak sensitive payment identifiers in the template body', () => {
            for (const token of SENSITIVE_TOKENS) {
                expect(failureParts.body).not.toContain(token);
            }
            expect(failureParts.body).not.toContain('collection_id');
            expect(failureParts.body).not.toContain('collectionId');
        });

        it('reads only status_detail from search params (no other sensitive key)', () => {
            for (const token of [...SENSITIVE_TOKENS, 'collection_id']) {
                expect(failureParts.frontmatter).not.toMatch(
                    new RegExp(`searchParams\\.get\\(['"\`]${token}['"\`]\\)`)
                );
            }
        });
    });

    // -----------------------------------------------------------------------
    // D3 — pending.astro
    // -----------------------------------------------------------------------

    describe('D3 — pending.astro (MercadoPago in-process-payment landing)', () => {
        it('disables prerender for parity with success/failure siblings', () => {
            // The page comment justifies the prerender=false as
            // "consistent with success/failure siblings". Pinning this
            // makes it visible if the file ever gets prerendered by
            // mistake.
            expect(pendingSrc).toContain('export const prerender = false');
        });

        it('uses MarketingLayout with no auth requirement', () => {
            expect(pendingSrc).toContain('MarketingLayout');
            expect(pendingSrc).toContain('No auth required');
        });

        it('routes the primary CTA to /mi-cuenta so the user can poll status', () => {
            expect(pendingSrc).toContain("path: 'mi-cuenta'");
            expect(pendingSrc).toContain('href: miCuentaUrl');
        });

        it('passes the pending variant to CheckoutResult', () => {
            expect(pendingSrc).toContain('variant="pending"');
        });

        it('mentions the 24h confirmation expectation in the body i18n key default', () => {
            // The hardcoded fallback inside the t() call is what ships
            // when the locale file is missing the key; the user-facing
            // contract that "this can take up to 24h" must survive a
            // locale-file regression.
            expect(pendingSrc).toMatch(/24\s*horas/i);
        });

        it('does not render sensitive payment identifiers in the template body', () => {
            for (const token of SENSITIVE_TOKENS) {
                expect(pendingParts.body).not.toContain(token);
            }
        });
    });

    // -----------------------------------------------------------------------
    // index.astro — direct navigation guard
    // -----------------------------------------------------------------------

    describe('index.astro (no-meaning landing redirects to /planes/)', () => {
        it('disables prerender because Astro.redirect needs SSR', () => {
            expect(indexSrc).toContain('export const prerender = false');
        });

        it('redirects to /suscriptores/planes with HTTP 302', () => {
            expect(indexSrc).toContain('Astro.redirect');
            expect(indexSrc).toContain("path: 'suscriptores/planes'");
            expect(indexSrc).toContain('302');
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
