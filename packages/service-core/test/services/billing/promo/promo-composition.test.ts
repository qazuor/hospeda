import { describe, expect, it } from 'vitest';
import {
    composePromoAmount,
    type PromoDiscount
} from '../../../../src/services/billing/promo/promo-composition.js';
import { ServiceError } from '../../../../src/types/index.js';

function permutations<T>(items: readonly T[]): T[][] {
    if (items.length < 2) return [[...items]];
    return items.flatMap((item, index) =>
        permutations(items.filter((_, itemIndex) => itemIndex !== index)).map((rest) => [
            item,
            ...rest
        ])
    );
}

describe('TEST:B9b:1 AC:B9b:1 the promo composition', () => {
    it('applies percentages before fixed discounts: 1,000 with 20% and 100 is 700, never 720', () => {
        const promos = [
            { discountKind: 'PERCENTAGE', value: 20 },
            { discountKind: 'FIXED', value: 10_000 }
        ] as const satisfies readonly PromoDiscount[];
        for (const order of permutations(promos))
            expect(composePromoAmount({ listAmountMinor: 100_000, promos: order })).toEqual({
                amountMinor: 70_000
            });
    });

    it('composes 15% and 10% on 9,999 as 7,649.23 in every input order', () => {
        const promos = [
            { discountKind: 'PERCENTAGE', value: 15 },
            { discountKind: 'PERCENTAGE', value: 10 }
        ] as const satisfies readonly PromoDiscount[];
        for (const order of permutations(promos))
            expect(composePromoAmount({ listAmountMinor: 999_900, promos: order })).toEqual({
                amountMinor: 764_923
            });
    });

    it('does one final downward rounding, clamps at zero, and leaves the list unchanged without promos', () => {
        expect(
            composePromoAmount({
                listAmountMinor: 105,
                promos: [
                    { discountKind: 'PERCENTAGE', value: 10 },
                    { discountKind: 'PERCENTAGE', value: 10 }
                ]
            })
        ).toEqual({ amountMinor: 85 });
        expect(
            composePromoAmount({
                listAmountMinor: 80,
                promos: [{ discountKind: 'PERCENTAGE', value: 100 }]
            })
        ).toEqual({ amountMinor: 0 });
        expect(
            composePromoAmount({
                listAmountMinor: 80,
                promos: [
                    { discountKind: 'PERCENTAGE', value: 100 },
                    { discountKind: 'FIXED', value: 1 }
                ]
            })
        ).toEqual({ amountMinor: 0 });
        expect(composePromoAmount({ listAmountMinor: 80, promos: [] })).toEqual({
            amountMinor: 80
        });
    });

    it('rejects invalid list amounts and discount values with the validation reason', () => {
        const invalidCases: Array<{
            readonly listAmountMinor: number;
            readonly promos: PromoDiscount[];
        }> = [
            { listAmountMinor: -1, promos: [] },
            { listAmountMinor: 1.5, promos: [] },
            { listAmountMinor: Number.MAX_SAFE_INTEGER + 1, promos: [] },
            { listAmountMinor: 100, promos: [{ discountKind: 'PERCENTAGE', value: 0 }] },
            { listAmountMinor: 100, promos: [{ discountKind: 'PERCENTAGE', value: 101 }] },
            { listAmountMinor: 100, promos: [{ discountKind: 'PERCENTAGE', value: 1.5 }] },
            { listAmountMinor: 100, promos: [{ discountKind: 'FIXED', value: 0 }] },
            { listAmountMinor: 100, promos: [{ discountKind: 'FIXED', value: -1 }] }
        ];
        for (const input of invalidCases) {
            try {
                composePromoAmount(input);
                expect.fail('Expected invalid promo composition input to throw');
            } catch (error) {
                expect(error).toBeInstanceOf(ServiceError);
                expect(error).toMatchObject({
                    code: 'VALIDATION_ERROR',
                    reason: 'PROMO_COMPOSITION_INVALID_INPUT'
                });
            }
        }
    });

    it('matches an independently calculated BigInt reference for large values', () => {
        const factors = [37n, 61n, 88n];
        const expected = Number(
            (200_000_000n * factors[0]! * factors[1]! * factors[2]!) / 1_000_000n
        );
        expect(
            composePromoAmount({
                listAmountMinor: 200_000_000,
                promos: [
                    { discountKind: 'PERCENTAGE', value: 63 },
                    { discountKind: 'PERCENTAGE', value: 39 },
                    { discountKind: 'PERCENTAGE', value: 12 }
                ]
            })
        ).toEqual({ amountMinor: expected });
    });

    it('does not mutate its promo input', () => {
        const promos: PromoDiscount[] = [
            { discountKind: 'FIXED', value: 1_000 },
            { discountKind: 'PERCENTAGE', value: 10 }
        ];
        const original = structuredClone(promos);
        composePromoAmount({ listAmountMinor: 10_000, promos });
        expect(promos).toEqual(original);
    });
});
