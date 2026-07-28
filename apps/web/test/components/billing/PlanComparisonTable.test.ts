/**
 * @file PlanComparisonTable.test.ts
 * @description Template-level assertions for the comparison table: markup,
 * accessibility and styling. The ROW MODEL is no longer asserted here by
 * grepping the component source — it lives in `plan-comparison-rows.ts` and is
 * covered behaviourally by `plan-comparison-rows.test.ts` (HOS-329).
 *
 * Grepping the `.astro` for row constants is what allowed the component to keep
 * a private inline copy of the row model that drifted from the module the
 * catalog-veracity guard validates. The assertions below therefore pin the
 * OPPOSITE: that this component imports the shared model and declares none of
 * its own.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/billing/PlanComparisonTable.astro'),
    'utf8'
);

describe('PlanComparisonTable.astro — single source of truth (HOS-329)', () => {
    it('imports the row model instead of declaring it inline', () => {
        expect(src).toContain("from '@/components/billing/plan-comparison-rows'");
        expect(src).toContain('OWNER_GROUPS');
        expect(src).toContain('TOURIST_GROUPS');
    });

    it('does not re-declare any row constant locally', () => {
        for (const constant of [
            'TOURIST_EXPERIENCE_ROWS',
            'TOURIST_AI_ROWS',
            'OWNER_ROWS',
            'OWNER_AI_ROWS',
            'OWNER_AS_TOURIST_ROWS'
        ]) {
            expect(src).not.toContain(`const ${constant}`);
        }
        expect(src).not.toContain('const OWNER_GROUPS');
        expect(src).not.toContain('const TOURIST_GROUPS');
    });

    it('does not re-declare the row model types locally', () => {
        expect(src).not.toContain('interface RowConfig');
        expect(src).not.toContain('interface GroupConfig');
        expect(src).not.toContain('interface EntitlementCell');
        expect(src).not.toContain('type RowCellDef');
    });

    it('resolves cells through the shared plan-driven resolver, not by index', () => {
        expect(src).toMatch(/resolveCell\(\s*\{[^}]*cell:\s*row\.cell/);
        // The old positional renderer and its column index must be gone.
        expect(src).not.toContain('getCellRendered');
        expect(src).not.toContain('planIndex');
        expect(src).not.toContain('activePlans.map((plan, idx)');
    });

    it('builds its columns with the shared active+sorted plan filter', () => {
        expect(src).toContain('filterPlansByCategory');
        expect(src).not.toContain("plans.filter((p) => p.category === 'owner')");
    });

    it('filters by the audience it was given, not a hardcoded category', () => {
        // `filterPlansByCategory(plans, 'owner')` written unconditionally would
        // render the tourist comparison page with zero columns, on a live
        // public URL, with the rest of this suite still green.
        expect(src).toContain('filterPlansByCategory(plans, audience)');
        expect(src).not.toContain("filterPlansByCategory(plans, 'owner')");
        expect(src).not.toContain("filterPlansByCategory(plans, 'tourist')");
    });
});

describe('PlanComparisonTable.astro — rendering', () => {
    it('renders an upcoming badge for rows with status upcoming', () => {
        expect(src).toContain('comparison-table__badge--upcoming');
        expect(src).toContain("status === 'upcoming'");
        expect(src).toContain('upcomingLabel');
    });

    it('renders the optional note under the row label when noteKey is set', () => {
        expect(src).toContain('comparison-table__row-note');
        expect(src).toContain('row.noteKey');
    });

    it('renders the per-row description when one exists', () => {
        expect(src).toContain('billing.comparison.rowDesc.');
        expect(src).toContain('comparison-table__row-desc');
    });

    it('renders the complex teaser for the owner audience only', () => {
        expect(src).toContain('comparison-table__complex-teaser');
        expect(src).toContain("audience === 'owner'");
        expect(src).toContain('billing.comparison.complexTeaser');
    });

    it('renders unlimited cells with the unlimited label', () => {
        expect(src).toContain('unlimitedLabel');
        expect(src).toContain("result === 'unlimited'");
    });

    it('renders a per-column purchase CTA in each plan header', () => {
        expect(src).toContain('PlanPurchaseButton');
        expect(src).toContain('comparison-table__plan-cta');
    });
});

describe('PlanComparisonTable.astro — accessibility', () => {
    it('uses CheckIcon for included cells and MinusIcon for excluded ones', () => {
        expect(src).toContain('CheckIcon');
        expect(src).toContain('MinusIcon');
    });

    it('labels icon cells for screen readers', () => {
        expect(src).toContain('aria-label');
        expect(src).toContain('role="img"');
        expect(src).toContain('includedLabel');
        expect(src).toContain('notIncludedLabel');
    });

    it('scopes every header cell', () => {
        expect(src).toContain('scope="col"');
        expect(src).toContain('scope="row"');
        expect(src).toContain('scope="rowgroup"');
    });

    it('keeps the scrollable wrapper keyboard reachable', () => {
        expect(src).toContain('tabindex="0"');
    });

    it('uses getComparisonGroupLabel for group headers', () => {
        expect(src).toContain('getComparisonGroupLabel');
    });
});

describe('PlanComparisonTable.astro — styling', () => {
    it('uses CSS custom properties instead of hardcoded colors', () => {
        expect(src).toContain('var(--');
        expect(src).not.toContain('#000');
        expect(src).not.toContain('#fff');
    });

    it('keeps the first column sticky and the table horizontally scrollable', () => {
        expect(src).toContain('sticky');
        expect(src).toContain('comparison-table__label-col');
        expect(src).toContain('overflow-x');
    });

    it('uses the project font tokens', () => {
        expect(src).toContain('font-heading');
        expect(src).toContain('font-sans');
    });

    it('does not contain the dead hover rule on group-header', () => {
        expect(src).not.toContain('.comparison-table__group-header:hover th');
    });

    it('styles the upcoming badge and complex teaser with CSS vars', () => {
        expect(src).toContain('.comparison-table__badge--upcoming');
        expect(src).toContain('var(--brand-accent');
        expect(src).toContain('.comparison-table__complex-teaser');
        expect(src).toContain('var(--core-muted-foreground)');
    });
});
