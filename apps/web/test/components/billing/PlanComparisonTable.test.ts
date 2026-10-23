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

// The pure helpers live in their own module (HOS-1753) so the `.astro` stays
// inside the project's file-size budget; the source assertions that pin the
// shared row model and the active+sorted filter follow the code there.
const helperSrc = readFileSync(
    resolve(__dirname, '../../../src/components/billing/plan-comparison-table.helpers.ts'),
    'utf8'
);

describe('PlanComparisonTable.astro — single source of truth (HOS-329)', () => {
    it('imports the row model instead of declaring it inline', () => {
        expect(src).toContain("from '@/components/billing/plan-comparison-rows'");
        expect(helperSrc).toContain("from '@/components/billing/plan-comparison-rows'");
        expect(helperSrc).toContain('OWNER_GROUPS');
        expect(helperSrc).toContain('TOURIST_GROUPS');
        expect(src).toContain("from '@/components/billing/plan-comparison-table.helpers'");
    });

    it('only renders row groups that the i18n sweep also walks', () => {
        // If you add an audience to the table, add its group to the sweep in
        // `plan-comparison-rows.test.ts` too — otherwise its rows escape the
        // label/description/icon guard. (HOS-1750)
        const groups = [...new Set(src.match(/\b[A-Z]+_GROUPS\b/g) ?? [])].sort();
        expect(groups).toEqual([
            'EXPERIENCE_GROUPS',
            'GASTRONOMY_GROUPS',
            'OWNER_GROUPS',
            'TOURIST_GROUPS'
        ]);
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
        expect(src).toContain('getActivePlans({ plans, audience })');
        expect(helperSrc).toContain('filterPlansByCategory');
        expect(helperSrc).not.toContain("plans.filter((p) => p.category === 'owner')");
    });

    it('filters by the audience it was given, not a hardcoded category', () => {
        // `filterPlansByCategory(plans, 'owner')` written unconditionally would
        // render the tourist comparison page with zero columns, on a live
        // public URL, with the rest of this suite still green.
        expect(helperSrc).toContain('filterPlansByCategory(plans, audience)');
        expect(helperSrc).not.toContain("filterPlansByCategory(plans, 'owner')");
        expect(helperSrc).not.toContain("filterPlansByCategory(plans, 'tourist')");
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

    it('renders a per-column CTA slot in each plan header, with no purchase island (HOS-1637)', () => {
        expect(src).toContain('comparison-table__plan-cta');
        expect(src).toContain('comparison-table__plan-link');
        expect(src).not.toContain('PlanPurchaseButton');
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

describe('PlanComparisonTable.astro — mobile layout (HOS-1753)', () => {
    // The `@media (max-width: 768px)` block is the LAST block in the file: the
    // mobile overrides are appended after every desktop rule, so everything
    // from that index to the end is the mobile layer.
    const mediaIndex = src.lastIndexOf('@media (max-width: 768px)');
    const mobileBlock = src.slice(mediaIndex);
    const desktopBlock = src.slice(0, mediaIndex);

    it('TEST:1753:2 — keeps the scroll hint visible only inside the mobile block', () => {
        // AC:1753:2 — the horizontal-scroll affordance stays `display: none`
        // by default and becomes `display: flex` on mobile.
        expect(mobileBlock).toContain('.comparison-table__scroll-hint');
        expect(mobileBlock).toContain('display: flex');
    });

    it('TEST:1753:1 — pins a fixed label width that leaves room for one plan column at 390px', () => {
        // AC:1753:1 with `table-layout: fixed`, every column's width comes from
        // the FIRST row — the `<thead>` row — so the label width must be set
        // there. `min-width` alone leaves the auto layout free to size the
        // column from `rowDesc`, which is what pushes the plans off-screen.
        const tableRule = mobileBlock.match(/\.comparison-table \{([^}]*)\}/);
        expect(tableRule).not.toBeNull();
        expect(tableRule?.[1]).toContain('table-layout: fixed;');

        const labelHeaderRule = mobileBlock.match(
            /\.comparison-table thead \.comparison-table__label-col \{([^}]*)\}/
        );
        expect(labelHeaderRule).not.toBeNull();

        const widthMatch = labelHeaderRule?.[1]?.match(/(?:^|[^-])width:\s*(\d+)px/);
        expect(widthMatch).not.toBeNull();
        const labelWidth = Number(widthMatch?.[1]);

        // The visible width at the issue's 390px viewport:
        //   390 - 2 * 12 = 366px
        // 12px is `--space-container-x` at 390px: clamp(0.75rem, 3vw, 1.5rem)
        // resolves to 0.75rem = 12px there (3vw = 11.7px is below the minimum).
        // 120px is the `min-width` of `.comparison-table__plan-col` on mobile.
        // The label plus at least one plan column must fit those 366px.
        const visibleWidth = 390 - 2 * 12;
        const planColumnWidth = 120;
        expect(labelWidth + planColumnWidth).toBeLessThanOrEqual(visibleWidth);
    });

    it('TEST:1753:1 — does not let the label column grow with its content on mobile', () => {
        // AC:1753:1 — a `min-width` of 160px/200px is what the auto layout
        // already had, and it is not what made the column wide; letting the
        // column keep a content-derived minimum on mobile is exactly the defect.
        expect(mobileBlock).not.toContain('min-width: 160px');
        expect(mobileBlock).not.toContain('min-width: 200px');
    });

    it('TEST:1753:3 — leaves the desktop layout untouched', () => {
        // AC:1753:3 — outside the media query the label keeps its 200px
        // minimum, the table keeps its 600px minimum, and the auto layout
        // stays in place.
        const desktopLabelRule = desktopBlock.match(/\.comparison-table__label-col \{([^}]*)\}/);
        expect(desktopLabelRule).not.toBeNull();
        expect(desktopLabelRule?.[1]).toContain('min-width: 200px;');
        expect(desktopBlock).toContain('min-width: 600px;');
        expect(desktopBlock).not.toContain('table-layout');
    });

    it('TEST:1753:4 — has no per-audience branch in the mobile block', () => {
        // AC:1753:4 — the same component renders all four comparisons, so one
        // CSS fix covers them; per-audience selectors would mean four fixes.
        expect(mobileBlock).not.toContain('data-audience');
        expect(mobileBlock).not.toContain('--gastronomy');
        expect(mobileBlock).not.toContain('--experience');
        expect(mobileBlock).not.toContain('--owner');
        expect(mobileBlock).not.toContain('--tourist');
    });
});
