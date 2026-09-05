/**
 * @file start-url.test.ts
 * @description HOS-810 — the destination of "Empezar ahora" on the two commerce
 * vertical landings.
 *
 * ## What is actually asserted here
 *
 * The bug was never "the link is missing"; the link was there and went to
 * `/auth/signup/`, which bounced a signed-in visitor to `/mi-cuenta/` — a page
 * with no route onward to the commerce create form. So the assertion that
 * matters is the DESTINATION, split by whether a session exists, and both
 * halves are covered here:
 *
 * - The signed-out half is `buildCommerceStartUrl`'s own output: it must still
 *   land on the signup form, because the landing is top-of-funnel and turning
 *   that into a sign-in prompt would be a regression for the visitor who has no
 *   account yet.
 * - The signed-in half is the `returnUrl` it carries, resolved by
 *   `resolveSafeReturnPath` exactly as `signup.astro` resolves it before
 *   redirecting an authenticated visitor. Composing the two functions here is
 *   what proves the round trip — `buildCommerceStartUrl` alone could emit a
 *   `returnUrl` the guard would throw away, and the test would still pass on a
 *   string comparison.
 *
 * Astro pages cannot be rendered in vitest, so the wiring between these
 * functions and the three `.astro` files that call them is asserted separately
 * by `test/pages/commerce-landing-cta.guard.test.ts`.
 *
 * @module test/lib/commerce/start-url
 */

import { describe, expect, it } from 'vitest';

import { resolveSafeReturnPath } from '@/lib/auth-redirect';
import type { CommerceVertical } from '@/lib/commerce/owner-listings';
import { buildCommerceCreateUrl, buildCommerceStartUrl } from '@/lib/commerce/start-url';
import type { SupportedLocale } from '@/lib/i18n';

const LOCALES: readonly SupportedLocale[] = ['es', 'en', 'pt'];
const VERTICALS: readonly CommerceVertical[] = ['gastronomy', 'experience'];

/** Read the `returnUrl` a start URL carries, decoded. */
function readReturnUrl(startUrl: string): string {
    const query = startUrl.slice(startUrl.indexOf('?'));
    return new URLSearchParams(query).get('returnUrl') ?? '';
}

describe('buildCommerceCreateUrl', () => {
    it("points at the vertical's PUBLISH page, not at the 301 that replaced its old URL", () => {
        // HOS-1156 moved the create form to `/publicar/{vertical}/` and left
        // `/mi-cuenta/comercio/nuevo/{vertical}/` as a 301 to it. This value
        // travels through sign-up as a `returnUrl`, so pointing it at the
        // redirect would make a brand-new account's destination a URL somebody
        // else can move — the exact mechanism that produced HOS-1156.
        expect(buildCommerceCreateUrl({ locale: 'es', vertical: 'experience' })).toBe(
            '/es/publicar/experiencias/'
        );
        expect(buildCommerceCreateUrl({ locale: 'es', vertical: 'gastronomy' })).toBe(
            '/es/publicar/gastronomia/'
        );
    });

    it('keeps the caller locale in the prefix', () => {
        expect(buildCommerceCreateUrl({ locale: 'pt', vertical: 'experience' })).toBe(
            '/pt/publicar/experiencias/'
        );
    });
});

describe('buildCommerceStartUrl', () => {
    describe('no session — the CTA still leads to creating the account', () => {
        it('lands on the signup page, not sign-in', () => {
            const url = buildCommerceStartUrl({ locale: 'es', vertical: 'experience' });
            expect(url.startsWith('/es/auth/signup/')).toBe(true);
            expect(url).not.toContain('/auth/signin/');
        });

        it('does so in every locale, for both verticals', () => {
            for (const locale of LOCALES) {
                for (const vertical of VERTICALS) {
                    const url = buildCommerceStartUrl({ locale, vertical });
                    expect(url.startsWith(`/${locale}/auth/signup/`)).toBe(true);
                }
            }
        });
    });

    describe('session present — the CTA resolves to the create form', () => {
        it('carries the vertical publish page as returnUrl (experience)', () => {
            const url = buildCommerceStartUrl({ locale: 'es', vertical: 'experience' });
            expect(url).toBe('/es/auth/signup/?returnUrl=%2Fes%2Fpublicar%2Fexperiencias%2F');
        });

        it('carries the vertical publish page as returnUrl (gastronomy)', () => {
            const url = buildCommerceStartUrl({ locale: 'es', vertical: 'gastronomy' });
            expect(url).toBe('/es/auth/signup/?returnUrl=%2Fes%2Fpublicar%2Fgastronomia%2F');
        });

        it('survives signup.astro s open-redirect guard, per locale and vertical', () => {
            // The composition IS the assertion: a returnUrl the guard rejects
            // would silently resolve to /mi-cuenta/ — the original bug — and a
            // test that only compared the encoded string would not notice.
            for (const locale of LOCALES) {
                for (const vertical of VERTICALS) {
                    const raw = readReturnUrl(buildCommerceStartUrl({ locale, vertical }));
                    expect(resolveSafeReturnPath({ rawReturn: raw, locale })).toBe(
                        buildCommerceCreateUrl({ locale, vertical })
                    );
                }
            }
        });

        it('never resolves to the dead end the loop used to hit', () => {
            for (const locale of LOCALES) {
                for (const vertical of VERTICALS) {
                    const raw = readReturnUrl(buildCommerceStartUrl({ locale, vertical }));
                    expect(resolveSafeReturnPath({ rawReturn: raw, locale })).not.toBe(
                        `/${locale}/mi-cuenta/`
                    );
                }
            }
        });
    });

    it('url-encodes the returnUrl rather than embedding raw slashes', () => {
        const url = buildCommerceStartUrl({ locale: 'en', vertical: 'gastronomy' });
        const rawQuery = url.slice(url.indexOf('returnUrl=') + 'returnUrl='.length);
        expect(rawQuery).not.toContain('/');
        expect(rawQuery).toContain('%2F');
    });
});
