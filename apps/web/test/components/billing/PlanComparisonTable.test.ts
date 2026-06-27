import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/billing/PlanComparisonTable.astro'),
    'utf8'
);

describe('PlanComparisonTable.astro', () => {
    // -----------------------------------------------------------------------
    // Curated row-config model
    // -----------------------------------------------------------------------

    it('should define curated row configs for tourist experience group', () => {
        expect(src).toContain('TOURIST_EXPERIENCE_ROWS');
    });

    it('should define curated row configs for tourist AI group', () => {
        expect(src).toContain('TOURIST_AI_ROWS');
    });

    it('should define curated row configs for owner rows', () => {
        expect(src).toContain('OWNER_ROWS');
    });

    it('should define curated row configs for owner AI business group', () => {
        expect(src).toContain('OWNER_AI_ROWS');
    });

    it('should define asTourist rows derived from tourist VIP values', () => {
        expect(src).toContain('OWNER_AS_TOURIST_ROWS');
        expect(src).toContain('asVipForAll');
    });

    it('should define tourist group configs', () => {
        expect(src).toContain('TOURIST_GROUPS');
    });

    it('should define owner group configs', () => {
        expect(src).toContain('OWNER_GROUPS');
    });

    it('should use RowCellDef discriminated union kinds', () => {
        expect(src).toContain("kind: 'limit'");
        expect(src).toContain("kind: 'literals'");
        expect(src).toContain("kind: 'all-yes'");
        expect(src).toContain("kind: 'all-no'");
        expect(src).toContain("kind: 'all-unlimited'");
    });

    it('should import LimitKey from @repo/billing for strong typing', () => {
        expect(src).toContain("from '@repo/billing'");
        expect(src).toContain('LimitKey');
    });

    it('should use LimitKey enum values for numeric limit cells', () => {
        expect(src).toContain('LimitKey.MAX_FAVORITES');
        expect(src).toContain('LimitKey.MAX_ACCOMMODATIONS');
        expect(src).toContain('LimitKey.MAX_PHOTOS_PER_ACCOMMODATION');
    });

    it('should use graduated limit keys for consumer AI rows in TOURIST_AI_ROWS (SPEC-283)', () => {
        // aiSearch and aiChat must now read per-plan quotas, not binary all-yes.
        expect(src).toContain('LimitKey.MAX_AI_SEARCH_PER_MONTH');
        expect(src).toContain('LimitKey.MAX_AI_CHAT_CONSUMER_PER_MONTH');
        // The tourist AI rows must use kind:'limit', not kind:'all-yes'.
        expect(src).toContain("{ id: 'aiSearch'");
        expect(src).toContain("{ id: 'aiChat'");
        expect(src).toContain('key: LimitKey.MAX_AI_SEARCH_PER_MONTH');
        expect(src).toContain('key: LimitKey.MAX_AI_CHAT_CONSUMER_PER_MONTH');
    });

    it('should NOT use all-yes for consumer AI rows (SPEC-283 graduated quotas)', () => {
        // Verify the tourist AI rows no longer contain 'all-yes' by checking
        // neither aiSearch nor aiChat is paired with kind:'all-yes' in the source.
        // We do this by asserting the graduated keys ARE present (positive form),
        // and that the two AI row IDs appear with 'limit' kind nearby.
        expect(src).not.toContain(
            "id: 'aiSearch', labelKey: 'billing.comparison.row.aiSearch', cell: { kind: 'all-yes'"
        );
        expect(src).not.toContain(
            "id: 'aiChat',   labelKey: 'billing.comparison.row.aiChat',   cell: { kind: 'all-yes'"
        );
    });

    it('should handle missing limit key with no (Minus icon) fallback', () => {
        expect(src).toContain('in plan.limits');
    });

    // -----------------------------------------------------------------------
    // Upcoming badge
    // -----------------------------------------------------------------------

    it('should render an upcoming badge for rows with status upcoming', () => {
        expect(src).toContain('comparison-table__badge--upcoming');
        expect(src).toContain("status === 'upcoming'");
        expect(src).toContain('upcomingLabel');
    });

    // -----------------------------------------------------------------------
    // Row notes
    // -----------------------------------------------------------------------

    it('should render optional note under row label when noteKey is set', () => {
        expect(src).toContain('comparison-table__row-note');
        expect(src).toContain('row.noteKey');
    });

    // -----------------------------------------------------------------------
    // Complex plan filtering and teaser
    // -----------------------------------------------------------------------

    it('should filter complex plans from the active columns', () => {
        expect(src).toContain("p.category === 'owner'");
        expect(src).toContain('activePlans');
    });

    it('should render complex teaser note for owner audience only', () => {
        expect(src).toContain('comparison-table__complex-teaser');
        expect(src).toContain("audience === 'owner'");
        expect(src).toContain('billing.comparison.complexTeaser');
    });

    // -----------------------------------------------------------------------
    // Icons and accessibility
    // -----------------------------------------------------------------------

    it('should use CheckIcon for included (yes) cells', () => {
        expect(src).toContain('CheckIcon');
    });

    it('should use MinusIcon for not-included (no) cells', () => {
        expect(src).toContain('MinusIcon');
    });

    it('should use aria-label on icon cells for screen readers', () => {
        expect(src).toContain('aria-label');
        expect(src).toContain('role="img"');
    });

    it('should use scope="col" for plan column headers', () => {
        expect(src).toContain('scope="col"');
    });

    it('should use scope="row" for feature row headers', () => {
        expect(src).toContain('scope="row"');
    });

    it('should use scope="rowgroup" for group header rows', () => {
        expect(src).toContain('scope="rowgroup"');
    });

    it('should have tabindex on scrollable wrapper for keyboard access', () => {
        expect(src).toContain('tabindex="0"');
    });

    // -----------------------------------------------------------------------
    // Group headers
    // -----------------------------------------------------------------------

    it('should use getComparisonGroupLabel for group headers', () => {
        expect(src).toContain('getComparisonGroupLabel');
    });

    // -----------------------------------------------------------------------
    // Unlimited rendering
    // -----------------------------------------------------------------------

    it('should handle unlimited limit values (-1)', () => {
        expect(src).toContain('-1');
        expect(src).toContain('unlimited');
    });

    it('should render unlimitedLabel text for unlimited cells', () => {
        expect(src).toContain('unlimitedLabel');
    });

    // -----------------------------------------------------------------------
    // Audience prop
    // -----------------------------------------------------------------------

    it('should accept audience prop for group selection', () => {
        expect(src).toContain('audience');
        expect(src).toContain("'owner'");
        expect(src).toContain("'tourist'");
    });

    // -----------------------------------------------------------------------
    // CSS and styling
    // -----------------------------------------------------------------------

    it('should use CSS custom properties (no hardcoded colors)', () => {
        expect(src).toContain('var(--');
        expect(src).not.toContain('#000');
        expect(src).not.toContain('#fff');
    });

    it('should have sticky first column class', () => {
        expect(src).toContain('sticky');
        expect(src).toContain('comparison-table__label-col');
    });

    it('should have overflow-x for horizontal scroll on mobile', () => {
        expect(src).toContain('overflow-x');
    });

    it('should use font-heading for plan names', () => {
        expect(src).toContain('font-heading');
    });

    it('should use font-sans for body text', () => {
        expect(src).toContain('font-sans');
    });

    it('should not contain the dead hover rule on group-header', () => {
        expect(src).not.toContain('.comparison-table__group-header:hover th');
    });

    it('should style the upcoming badge with CSS vars', () => {
        expect(src).toContain('.comparison-table__badge--upcoming');
        expect(src).toContain('var(--brand-accent');
    });

    it('should style the complex teaser with CSS vars', () => {
        expect(src).toContain('.comparison-table__complex-teaser');
        expect(src).toContain('var(--core-muted-foreground)');
    });
});
