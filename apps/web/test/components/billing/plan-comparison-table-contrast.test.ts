/**
 * @module test/components/billing/plan-comparison-table-contrast
 * @description HOS-1766 item 14. Pins WHICH ink token each readable part of the
 * plan comparison table uses. The ratios themselves are measured from the real
 * token values in `packages/design-tokens/src/tokens/plan-comparison-contrast
 * .test.ts`; this file keeps the consumer and that guard from drifting apart.
 */
import { describe, expect, it } from 'vitest';
import { baseValue, parseFile } from '../../helpers/css-contract';

const rules = parseFile({ path: 'components/billing/PlanComparisonTable.astro' });

const INK = [
    ['.comparison-table__icon--included', 'var(--hospeda-forest-link)'],
    ['.comparison-table__limit-value--unlimited', 'var(--hospeda-forest-link)'],
    ['.comparison-table__plan-price', 'var(--brand-accent-text)'],
    ['.comparison-table__badge--upcoming', 'var(--core-foreground)']
] as const;

const GROUP_HEADER = '.comparison-table__group-header th';

describe('PlanComparisonTable ink tokens', () => {
    it.each(INK)('%s is painted with %s', (selector, expected) => {
        // Arrange / Act
        const color = baseValue({ rules, selector, prop: 'color' });

        // Assert
        expect(color).toBe(expected);
    });

    it('never uses --brand-tertiary (a pale surface tint) as ink anywhere', () => {
        // Arrange
        const offenders = rules
            .filter((r) => r.decls.color?.includes('--brand-tertiary'))
            .map((r) => r.selector);

        // Assert
        expect(offenders).toEqual([]);
    });

    it('never uses the orange fill token --brand-accent as text colour', () => {
        const offenders = rules
            .filter((r) => r.decls.color === 'var(--brand-accent)')
            .map((r) => r.selector);

        expect(offenders).toEqual([]);
    });

    it('paints the group header with the text-grade primary, not the fill token', () => {
        expect(baseValue({ rules, selector: GROUP_HEADER, prop: 'color' })).toBe(
            'var(--brand-primary-text)'
        );
    });

    it('keeps the "not included" glyph at the opacity the contrast guard measured', () => {
        expect(
            baseValue({
                rules,
                selector: '.comparison-table__icon--not-included',
                prop: 'opacity'
            })
        ).toBe('0.7');
    });
});
