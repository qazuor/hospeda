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
        // HOS-689 item 2: the island receives `visibleAddons` (the catalog
        // filtered per-domain), never the raw `availableAddons` — a
        // commerce-only owner must not be offered accommodation-only addons
        // (and vice versa).
        expect(source).toMatch(/addons={visibleAddons}/);
        expect(source).toMatch(/ownedAddonSlugs={ownedAddonSlugs}/);
        expect(source).toMatch(/accommodations={accommodations}/);
    });

    it('reads the ?status= and ?addon= query params for the result banner', () => {
        expect(source).toContain("Astro.url.searchParams.get('status')");
        expect(source).toContain("Astro.url.searchParams.get('addon')");
    });

    it('gates the purchase panel on an entitlement-granting subscription per domain (HOS-224/HOS-594/HOS-689)', () => {
        // HOS-224 / HOS-594: the "usable subscription" predicate must route
        // through the canonical isEntitlementGrantingStatus (active/trialing/
        // comp), never a hand-rolled status list that silently omits comp.
        // This exact requirement is ALSO pinned by the dedicated static guard
        // `addons-status-gate-canonical-predicate.guard.test.ts`, which
        // requires the import + call to live in THIS page's own source (not
        // delegated to a helper) — so this test only re-affirms the same
        // shape rather than duplicating that guard's stricter regex checks.
        // HOS-689 item 2 additionally scopes the gate per product domain via
        // `filterAddonsByHeldDomains` (`@/lib/billing/addon-domain`), so a
        // commerce-only owner sees gastronomy/experience addons without an
        // accommodation subscription.
        expect(source).toContain("from '@repo/billing'");
        expect(source).toContain('isEntitlementGrantingStatus');
        expect(source).toContain("from '@/lib/billing/addon-domain'");
        expect(source).toContain('filterAddonsByHeldDomains');
        expect(source).toContain('hasUsableSubscription');
        expect(source).not.toContain('USABLE_SUBSCRIPTION_STATUSES');
        // No hand-rolled status comparison at this call site either.
        expect(source).not.toMatch(/subscription\.status\s*===\s*['"]active['"]/);
    });

    it('resolves the gate per product domain, not one accommodation-only boolean (HOS-689 item 2)', () => {
        // A commerce-only owner (who is exactly who buys
        // extra-gastronomies-1/extra-experiences-1) must see those addons
        // offered — the gate can no longer be a single subscription lookup
        // scoped to accommodation by default.
        expect(source).toContain('ProductDomainEnum.GASTRONOMY');
        expect(source).toContain('ProductDomainEnum.EXPERIENCE');
        expect(source).toContain('productDomain');
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
