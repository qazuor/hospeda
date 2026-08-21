/**
 * @file propiedades-index.test.ts
 * @description Integration tests for the propiedades index page — verifies
 * plan/limit awareness badge was added (SPEC-205 Phase 4) and that admin
 * redirects were removed from the page.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const propiedadesIndexSource = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/propiedades/index.astro'),
    'utf8'
);

describe('propiedades/index.astro — SPEC-205 Phase 4 funnel polish', () => {
    describe('plan/limit awareness badge', () => {
        it('should fetch usage data from the billing usage endpoint via the SSOT limit-key constant', () => {
            // The URL must use the imported MAX_ACCOMMODATIONS_LIMIT_KEY constant
            // (= the lowercase enum VALUE 'max_accommodations'), NOT the uppercase
            // enum key name, which z.nativeEnum(LimitKey) rejects with HTTP 400.
            expect(propiedadesIndexSource).toContain(
                'billing/usage/${MAX_ACCOMMODATIONS_LIMIT_KEY}'
            );
            // Bug-2 regression: the old uppercase literal must NOT reappear.
            expect(propiedadesIndexSource).not.toContain('billing/usage/MAX_ACCOMMODATIONS');
        });

        it('should render a usage badge when usageData is available', () => {
            expect(propiedadesIndexSource).toContain('props-page__usage');
            expect(propiedadesIndexSource).toContain('host.properties.usage.label');
        });

        it('should show upgrade link when threshold is not ok', () => {
            expect(propiedadesIndexSource).toContain('props-page__usage-upgrade');
            expect(propiedadesIndexSource).toContain('host.properties.usage.upgrade');
        });

        // ── HOS-727: the add-on offer next to the quota ──────────────────
        //
        // What these can and cannot prove: vitest cannot render `.astro` in
        // this repo (no Astro vite plugin in the test pipeline — see
        // `PartnerMentionsSection.test.ts`), so they read the SOURCE and can
        // only show the wiring is declared. The BEHAVIOUR they stand in for —
        // that a sellable limit yields a focus URL and the other 15 yield
        // nothing at all — executes for real in
        // `test/lib/billing/limit-addon-offer.test.ts`, which is where the
        // no-false-promise rule is actually pinned.

        it('should resolve the add-on offer from the limit key, not from a hardcoded link', () => {
            expect(propiedadesIndexSource).toContain(
                "import { resolveLimitAddonOffer } from '@/lib/billing/limit-addon-offer'"
            );
            expect(propiedadesIndexSource).toContain(
                'resolveLimitAddonOffer({\n    locale,\n    limitKey: MAX_ACCOMMODATIONS_LIMIT_KEY\n})'
            );
        });

        it('should render the add-on CTA from the resolved offer href', () => {
            expect(propiedadesIndexSource).toContain('href={accommodationsAddonOffer.href}');
            expect(propiedadesIndexSource).toContain('props-page__usage-addon');
            expect(propiedadesIndexSource).toContain('account.subscription.usage.buyAddon');
        });

        it('should gate the add-on CTA on BOTH a non-ok threshold and a resolved offer', () => {
            // `accommodationsAddonOffer !== null` is the half that keeps the
            // link off a cap with nothing to sell; dropping it would turn the
            // badge into the false promise the issue forbids.
            expect(propiedadesIndexSource).toContain(
                "{usageData.threshold !== 'ok' && accommodationsAddonOffer !== null && ("
            );
        });

        it('should NOT hardcode an add-on slug or the add-ons path in the page', () => {
            expect(propiedadesIndexSource).not.toContain('extra-accommodations-5');
            expect(propiedadesIndexSource).not.toContain('mi-cuenta/addons');
        });

        it('should keep the plan-upgrade route offered alongside the add-on', () => {
            // The add-on is an addition, not a replacement: a host whose real
            // problem is the plan must still find the upgrade here.
            expect(propiedadesIndexSource).toContain('props-page__usage-upgrade');
            expect(propiedadesIndexSource).toContain("path: 'suscriptores/planes'");
        });

        it('should include CSS classes for all threshold variants', () => {
            expect(propiedadesIndexSource).toContain('props-page__usage--ok');
            expect(propiedadesIndexSource).toContain('props-page__usage--warning');
            expect(propiedadesIndexSource).toContain('props-page__usage--critical');
            expect(propiedadesIndexSource).toContain('props-page__usage--exceeded');
        });
    });

    describe('admin redirect removal', () => {
        it('should NOT contain admin panel URLs in the page', () => {
            // The propiedades page should not redirect to admin
            // (admin URLs are only in PropertyCard for publish action)
            expect(propiedadesIndexSource).not.toContain('adminBase');
            expect(propiedadesIndexSource).not.toContain('/admin/');
        });

        it('should use parallel fetch for performance', () => {
            // The page should fetch accommodations and usage data in parallel
            expect(propiedadesIndexSource).toContain('Promise.all');
        });
    });
});
