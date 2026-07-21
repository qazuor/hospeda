/**
 * @file mi-cuenta-addons.astro.test.ts
 * @description Source-level assertions for the add-ons self-service purchase
 * page (HOS-224). Astro pages cannot be rendered via Vitest, so we lean on
 * string-level assertions on the .astro source — same pattern used by
 * `mi-cuenta-ofertas-exclusivas.astro.test.ts`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/addons/index.astro'),
    'utf8'
);

describe('mi-cuenta/addons/index.astro (HOS-224)', () => {
    it('redirects unauthenticated visitors to signin (safety-net guard)', () => {
        expect(source).toContain('Astro.locals.user');
        expect(source).toMatch(/if\s*\(\s*!user\s*\)/);
        expect(source).toContain("path: 'auth/signin'");
    });

    it('resolves locale from Astro.locals', () => {
        expect(source).toContain('Astro.locals.locale as SupportedLocale');
    });

    it('uses the account.pages.addons i18n keys for title/description', () => {
        expect(source).toContain("'account.pages.addons.title'");
        expect(source).toContain("'account.pages.addons.description'");
    });

    it('is rendered server-side (prerender = false)', () => {
        expect(source).toContain('export const prerender = false');
    });

    it('mounts the AddonsPurchasePanel island with client:load', () => {
        expect(source).toContain('<AddonsPurchasePanel');
        expect(source).toContain('client:load');
    });

    it('forwards locale, addons, ownedAddonSlugs, and accommodations to the island', () => {
        expect(source).toMatch(/locale={locale}/);
        expect(source).toMatch(/addons={availableAddons}/);
        expect(source).toMatch(/ownedAddonSlugs={ownedAddonSlugs}/);
        expect(source).toMatch(/accommodations={accommodations}/);
    });

    it('reads the ?status= and ?addon= query params for the result banner', () => {
        expect(source).toContain("Astro.url.searchParams.get('status')");
        expect(source).toContain("Astro.url.searchParams.get('addon')");
    });

    it('gates the purchase panel on an active or trialing subscription', () => {
        // HOS-224: the gate accepts active, trial AND trialing — the web
        // SubscriptionStatus type says 'trial' but the runtime MP-derived value
        // is 'trialing', and the issue's repro is a trialing owner who must not
        // be wrongly blocked. Assert the set includes all three.
        expect(source).toContain("'active'");
        expect(source).toContain("'trial'");
        expect(source).toContain("'trialing'");
        expect(source).toContain('USABLE_SUBSCRIPTION_STATUSES');
        expect(source).toContain('hasUsableSubscription');
    });

    it('forwards the SSR cookie header to the protected API wrappers', () => {
        expect(source).toContain("Astro.request.headers.get('cookie')");
        expect(source).toContain('cookieHeader');
    });

    it('wraps content in AccountLayout with the addons active section', () => {
        // AccountLayout.astro renders <SEOHead noindex /> internally for every
        // /mi-cuenta/* page (see AccountLayout.astro) — this page relies on
        // that instead of duplicating its own SEOHead, matching every other
        // /mi-cuenta/* page (e.g. suscripcion/index.astro).
        expect(source).toContain('<AccountLayout');
        expect(source).toContain('activeSection="addons"');
    });
});
