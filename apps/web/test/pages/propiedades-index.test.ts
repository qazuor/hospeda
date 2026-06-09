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
