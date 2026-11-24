import { describe, expect, it } from 'vitest';
import {
    resolveEmailAccountLink,
    VERTICAL_OWNS_PUBLICATIONS
} from '../../src/catalog/vertical-owns-publications';
import { VerticalEnum } from '../../src/enums/vertical.enum';

describe('VERTICAL_OWNS_PUBLICATIONS (HOS-2565 D16)', () => {
    it('declares every VerticalEnum value, and nothing else', () => {
        // Arrange: a new vertical lands in VerticalEnum; this list must grow with it.
        const declared = Object.keys(VERTICAL_OWNS_PUBLICATIONS).sort();

        // Act
        const enumValues = Object.values(VerticalEnum).sort();

        // Assert
        expect(declared).toEqual(enumValues);
        for (const value of Object.values(VERTICAL_OWNS_PUBLICATIONS)) {
            expect(typeof value).toBe('boolean');
        }
    });

    it('marks the three listing verticals as publication owners', () => {
        // Assert
        expect(VERTICAL_OWNS_PUBLICATIONS).toEqual({
            [VerticalEnum.ACCOMMODATION]: true,
            [VerticalEnum.VENUE]: true,
            [VerticalEnum.EXPERIENCE]: true,
            [VerticalEnum.TOURIST]: false,
            [VerticalEnum.PARTNER]: false
        });
    });
});

describe('resolveEmailAccountLink (HOS-2565 D16)', () => {
    it.each(
        Object.values(VerticalEnum)
    )('follows the declaration map for a recipient holding only %s', (vertical) => {
        // Act
        const { accountLink } = resolveEmailAccountLink({ verticals: [vertical] });

        // Assert
        expect(accountLink).toBe(VERTICAL_OWNS_PUBLICATIONS[vertical] ? 'publications' : 'account');
    });

    it('gives publications to a partner that also holds a listing vertical', () => {
        // Act
        const { accountLink } = resolveEmailAccountLink({
            verticals: [VerticalEnum.PARTNER, VerticalEnum.VENUE]
        });

        // Assert
        expect(accountLink).toBe('publications');
    });

    it('gives account to a partner plus tourist, no vertical, absent input or an unknown value', () => {
        // Assert
        expect(
            resolveEmailAccountLink({ verticals: [VerticalEnum.PARTNER, VerticalEnum.TOURIST] })
                .accountLink
        ).toBe('account');
        expect(resolveEmailAccountLink({ verticals: [] }).accountLink).toBe('account');
        expect(resolveEmailAccountLink({}).accountLink).toBe('account');
        expect(resolveEmailAccountLink({ verticals: ['unknown'] }).accountLink).toBe('account');
    });
});
