import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/billing/PlanComparisonTable.astro'),
    'utf8'
);

describe('PlanComparisonTable.astro', () => {
    it('should use getEntitlementName for entitlement row labels', () => {
        expect(src).toContain('getEntitlementName');
    });

    it('should use getLimitName for limit row labels', () => {
        expect(src).toContain('getLimitName');
    });

    it('should use getComparisonGroupLabel for group headers', () => {
        expect(src).toContain('getComparisonGroupLabel');
    });

    it('should use CheckIcon for included entitlements', () => {
        expect(src).toContain('CheckIcon');
    });

    it('should use MinusIcon for not-included entitlements', () => {
        expect(src).toContain('MinusIcon');
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

    it('should handle unlimited limit values (-1)', () => {
        expect(src).toContain('-1');
        expect(src).toContain('unlimited');
    });

    it('should use aria-label on icon cells for screen readers', () => {
        expect(src).toContain('aria-label');
        expect(src).toContain('role="img"');
    });

    it('should accept audience prop for group filtering', () => {
        expect(src).toContain('audience');
        expect(src).toContain("'owner'");
        expect(src).toContain("'tourist'");
    });

    it('should define entitlement groups for owner audience', () => {
        expect(src).toContain('OWNER_GROUPS');
        expect(src).toContain('OWNER_ENTITLEMENTS');
    });

    it('should define entitlement groups for tourist audience', () => {
        expect(src).toContain('TOURIST_GROUPS');
        expect(src).toContain('TOURIST_ENTITLEMENTS');
    });

    it('should define AI entitlement group shared by both audiences', () => {
        expect(src).toContain('AI_ENTITLEMENTS');
    });

    it('should define limit keys for both audiences', () => {
        expect(src).toContain('OWNER_LIMITS');
        expect(src).toContain('TOURIST_LIMITS');
    });

    it('should use font-heading for plan names', () => {
        expect(src).toContain('font-heading');
    });

    it('should use font-sans for body text', () => {
        expect(src).toContain('font-sans');
    });

    it('should have tabindex on scrollable wrapper for keyboard access', () => {
        expect(src).toContain('tabindex="0"');
    });
});
