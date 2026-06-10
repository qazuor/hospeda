/**
 * @file PlanUsageSection.test.tsx
 * @description Source-based tests for the Section 2 component of Mi
 * facturación (SPEC-156 T-036). The full render path is exercised by the
 * account smoke test; these tests pin the wiring + i18n key surface so
 * regressions during refactors are caught early.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sectionSrc = readFileSync(
    resolve(__dirname, '../../../src/components/billing/PlanUsageSection.tsx'),
    'utf8'
);

describe('PlanUsageSection.tsx (T-036)', () => {
    it('wires to GET /api/v1/protected/billing/usage via useMyUsage', () => {
        expect(sectionSrc).toContain('useMyUsage');
        expect(sectionSrc).toContain("from '@/hooks/use-my-billing'");
    });

    it('renders the UsageProgressBar primitive from T-035', () => {
        expect(sectionSrc).toContain('UsageProgressBar');
        expect(sectionSrc).toContain("from '@/components/billing/UsageProgressBar'");
    });

    describe('render branches', () => {
        it('shows a loading skeleton when the query is in flight', () => {
            expect(sectionSrc).toContain('data-testid="usage-loading"');
        });

        it('shows an error message when the query fails', () => {
            expect(sectionSrc).toContain("'admin-pages.billing.usage.errorLoading'");
        });

        it('shows the noActive empty state when usage is null', () => {
            expect(sectionSrc).toContain('data-testid="usage-empty"');
            expect(sectionSrc).toContain("'admin-pages.billing.usage.noActive'");
        });

        it('renders the accommodations bar when usage is present', () => {
            expect(sectionSrc).toContain('data-testid="usage-bars"');
            expect(sectionSrc).toContain("'admin-pages.billing.usage.accommodations'");
        });
    });

    describe('unlimited handling', () => {
        it('detects unlimited via accommodationsLimit === null', () => {
            expect(sectionSrc).toContain('accommodationsLimit === null');
        });

        it('passes the unlimitedLabel through to UsageProgressBar', () => {
            expect(sectionSrc).toContain('unlimitedLabel');
            expect(sectionSrc).toContain("'admin-pages.billing.usage.unlimited'");
        });

        it('interpolates {used} and {limit} into the unitOfLimit label', () => {
            expect(sectionSrc).toContain("'admin-pages.billing.usage.unitOfLimit'");
            expect(sectionSrc).toMatch(/used:\s*usage\.accommodationsUsed/);
            expect(sectionSrc).toMatch(/limit:\s*usage\.accommodationsLimit/);
        });
    });
});
