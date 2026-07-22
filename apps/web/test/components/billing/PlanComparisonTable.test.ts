import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LimitKey } from '@repo/billing';
import { describe, expect, it } from 'vitest';
import {
    asVipForAll,
    OWNER_AI_ROWS,
    OWNER_AS_TOURIST_ROWS,
    OWNER_GROUPS,
    OWNER_ROWS,
    type RowConfig,
    TOURIST_AI_ROWS,
    TOURIST_EXPERIENCE_ROWS,
    TOURIST_GROUPS
} from '../../../src/components/billing/plan-comparison-rows';

// HOS-213: the row/group configs were extracted from PlanComparisonTable.astro
// into an importable module (plan-comparison-rows.ts) so the catalog-veracity
// data has a direct unit-test surface. These assertions run against the real
// exported data instead of source substrings, so a reformat can't false-break
// them and a value/status regression can't slip through.

const src = readFileSync(
    resolve(__dirname, '../../../src/components/billing/PlanComparisonTable.astro'),
    'utf8'
);

function findRow(rows: readonly RowConfig[], id: string): RowConfig {
    const row = rows.find((r) => r.id === id);
    if (!row) throw new Error(`Row not found: ${id}`);
    return row;
}

describe('plan-comparison-rows — curated row-config model', () => {
    it('defines the tourist experience, tourist AI, owner and owner-AI row groups', () => {
        expect(TOURIST_EXPERIENCE_ROWS.length).toBeGreaterThan(0);
        expect(TOURIST_AI_ROWS.length).toBeGreaterThan(0);
        expect(OWNER_ROWS.length).toBeGreaterThan(0);
        expect(OWNER_AI_ROWS.length).toBeGreaterThan(0);
    });

    it('derives asTourist rows from tourist VIP values via asVipForAll', () => {
        expect(OWNER_AS_TOURIST_ROWS.length).toBe(
            TOURIST_EXPERIENCE_ROWS.length + TOURIST_AI_ROWS.length
        );
        // A tourist literals cell whose VIP (last) value is 'yes' collapses to all-yes.
        expect(asVipForAll({ kind: 'literals', values: ['no', 'yes', 'yes'] })).toEqual({
            kind: 'all-yes'
        });
        // A literals cell whose VIP value is 'no' collapses to all-no.
        expect(asVipForAll({ kind: 'literals', values: ['no', 'no', 'no'] })).toEqual({
            kind: 'all-no'
        });
        // limit cells pass through unchanged (graduated owner quotas — SPEC-283).
        expect(asVipForAll({ kind: 'limit', key: LimitKey.MAX_FAVORITES })).toEqual({
            kind: 'limit',
            key: LimitKey.MAX_FAVORITES
        });
    });

    it('exposes tourist and owner group configs', () => {
        expect(TOURIST_GROUPS.map((g) => g.id)).toEqual(['experience', 'ai']);
        expect(OWNER_GROUPS.map((g) => g.id)).toEqual(['asTourist', 'asOwner', 'aiBusiness']);
    });

    it('uses graduated limit keys for consumer AI rows (SPEC-283), never all-yes', () => {
        const aiSearch = findRow(TOURIST_AI_ROWS, 'aiSearch');
        const aiChat = findRow(TOURIST_AI_ROWS, 'aiChat');
        expect(aiSearch.cell.kind).toBe('limit');
        expect(aiChat.cell.kind).toBe('limit');
    });
});

describe('plan-comparison-rows — activated / corrected feature rows', () => {
    it('marks the compare row available with per-tier Plus/VIP values (SPEC-288)', () => {
        const compare = findRow(TOURIST_EXPERIENCE_ROWS, 'compare');
        expect(compare.status).toBe('available');
        expect(compare.cell).toEqual({ kind: 'literals', values: ['no', 'yes', 'yes'] });
    });

    it('marks the collections row available with a MAX_COLLECTIONS limit cell (SPEC-287)', () => {
        const collections = findRow(TOURIST_EXPERIENCE_ROWS, 'collections');
        expect(collections.status).toBe('available');
        expect(collections.cell.kind).toBe('limit');
    });

    it('marks the promotions row available with a MAX_ACTIVE_PROMOTIONS limit cell (HOS-16)', () => {
        const promotions = findRow(OWNER_ROWS, 'promotions');
        expect(promotions.status).toBe('available');
        expect(promotions.cell.kind).toBe('limit');
    });
});

describe('PlanComparisonTable.astro — rendering, a11y and styling', () => {
    it('renders an upcoming badge for rows with status upcoming', () => {
        expect(src).toContain('comparison-table__badge--upcoming');
        expect(src).toContain("status === 'upcoming'");
        expect(src).toContain('upcomingLabel');
    });

    it('handles a missing limit key with a no (Minus icon) fallback', () => {
        expect(src).toContain('in plan.limits');
    });

    it('renders an optional note under the row label when noteKey is set', () => {
        expect(src).toContain('comparison-table__row-note');
        expect(src).toContain('row.noteKey');
    });

    it('filters complex plans from the active columns', () => {
        expect(src).toContain("p.category === 'owner'");
        expect(src).toContain('activePlans');
    });

    it('renders the complex teaser note for owner audience only', () => {
        expect(src).toContain('comparison-table__complex-teaser');
        expect(src).toContain("audience === 'owner'");
        expect(src).toContain('billing.comparison.complexTeaser');
    });

    it('uses CheckIcon for included (yes) cells', () => {
        expect(src).toContain('CheckIcon');
    });

    it('uses MinusIcon for not-included (no) cells', () => {
        expect(src).toContain('MinusIcon');
    });

    it('uses aria-label + role="img" on icon cells for screen readers', () => {
        expect(src).toContain('aria-label');
        expect(src).toContain('role="img"');
    });

    it('uses scope="col" for plan column headers', () => {
        expect(src).toContain('scope="col"');
    });

    it('uses scope="row" for feature row headers', () => {
        expect(src).toContain('scope="row"');
    });

    it('uses scope="rowgroup" for group header rows', () => {
        expect(src).toContain('scope="rowgroup"');
    });

    it('has tabindex on the scrollable wrapper for keyboard access', () => {
        expect(src).toContain('tabindex="0"');
    });

    it('uses getComparisonGroupLabel for group headers', () => {
        expect(src).toContain('getComparisonGroupLabel');
    });

    it('handles unlimited limit values (-1)', () => {
        expect(src).toContain('-1');
        expect(src).toContain('unlimited');
    });

    it('renders unlimitedLabel text for unlimited cells', () => {
        expect(src).toContain('unlimitedLabel');
    });

    it('accepts an audience prop for group selection', () => {
        expect(src).toContain('audience');
        expect(src).toContain("'owner'");
        expect(src).toContain("'tourist'");
    });

    it('uses CSS custom properties (no hardcoded colors)', () => {
        expect(src).toContain('var(--');
        expect(src).not.toContain('#000');
        expect(src).not.toContain('#fff');
    });

    it('has a sticky first column class', () => {
        expect(src).toContain('sticky');
        expect(src).toContain('comparison-table__label-col');
    });

    it('has overflow-x for horizontal scroll on mobile', () => {
        expect(src).toContain('overflow-x');
    });

    it('uses font-heading for plan names', () => {
        expect(src).toContain('font-heading');
    });

    it('uses font-sans for body text', () => {
        expect(src).toContain('font-sans');
    });

    it('does not contain the dead hover rule on group-header', () => {
        expect(src).not.toContain('.comparison-table__group-header:hover th');
    });

    it('styles the upcoming badge with CSS vars', () => {
        expect(src).toContain('.comparison-table__badge--upcoming');
        expect(src).toContain('var(--brand-accent');
    });

    it('styles the complex teaser with CSS vars', () => {
        expect(src).toContain('.comparison-table__complex-teaser');
        expect(src).toContain('var(--core-muted-foreground)');
    });
});
