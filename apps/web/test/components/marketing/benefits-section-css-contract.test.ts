/**
 * @module test/components/marketing/benefits-section-css-contract
 * @description HOS-1766 item 04. The tourist landing has five benefits; the
 * old `repeat(auto-fit, minmax(250px, 1fr))` grid fit four per row and left
 * the fifth alone, left-aligned, on a second row. The `auto-fit` mode must
 * wrap and CENTER, with equal-width cards, for any card count.
 */
import { describe, expect, it } from 'vitest';
import { baseValue, parseFile } from '../../helpers/css-contract';

const rules = parseFile({ path: 'components/marketing/BenefitsSection.astro' });
const GRID = ".benefits__grid[data-columns='auto-fit']";
const CARD = `${GRID} .benefits__card`;

describe('BenefitsSection auto-fit grid', () => {
    it('wraps and centers its rows instead of using a fixed track grid', () => {
        // Arrange / Act
        const display = baseValue({ rules, selector: GRID, prop: 'display' });
        const wrap = baseValue({ rules, selector: GRID, prop: 'flex-wrap' });
        const justify = baseValue({ rules, selector: GRID, prop: 'justify-content' });
        const tracks = baseValue({ rules, selector: GRID, prop: 'grid-template-columns' });

        // Assert
        expect(display).toBe('flex');
        expect(wrap).toBe('wrap');
        expect(justify).toBe('center');
        expect(tracks).toBeUndefined();
    });

    it('gives every card the same fixed, shrinkable basis so a short row matches the others', () => {
        // Arrange / Act
        const flex = baseValue({ rules, selector: CARD, prop: 'flex' });

        // Assert: no flex-grow (grow would stretch the orphan wider than its siblings)
        expect(flex).toMatch(/^0 1 \d+px$/);
    });

    it('collapses to one full-width column on mobile', () => {
        // Arrange / Act
        const mobile = rules.filter(
            (r) =>
                r.selector === CARD &&
                r.media.some((m) => m.includes('max-width: 768px')) &&
                r.decls['flex-basis'] === '100%'
        );

        // Assert
        expect(mobile).toHaveLength(1);
    });

    it('keeps the fixed three-column mode untouched', () => {
        expect(
            baseValue({
                rules,
                selector: ".benefits__grid[data-columns='3']",
                prop: 'grid-template-columns'
            })
        ).toBe('repeat(3, 1fr)');
    });
});
