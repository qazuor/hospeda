/**
 * TEST:V3:1 (AC:V3:1, `V/15` §2): every key is aggregated with the strategy its
 * catalog declares. Plan 20 photos + complement 30 = 50 (`SUM`); in `MAX` and
 * `MIN` the most favorable source wins; in `BEST_DECLARED` the fold refuses the
 * key instead of guessing its order (Coord-12, 2026-10-08).
 *
 * Type: unit. The fold is a pure function of the plegable set.
 */
import { describe, expect, it } from 'vitest';
import { ContradictoryStrategyError } from '../../src/effective-set/errors';
import { foldPlegableSet } from '../../src/effective-set/fold';
import { UndecidableKeyError } from '../../src/plan-catalog/errors';
import { addon, grant, subscription } from './sources';

const PHOTOS = 'max_photos_per_accommodation';
const COMPARE = 'max_compare_items';
const RESPONSE_HOURS = 'response_time_hours';
const SUPPORT_LEVEL = 'support_level';

describe('TEST:V3:1 — each key folds with the strategy its catalog declares', () => {
    it('SUM adds every source of the plegable set: 20 + 30 = 50', () => {
        const folded = foldPlegableSet({
            sources: [
                subscription([grant({ key: PHOTOS, value: 20, strategy: 'SUM' })]),
                addon({
                    scope: 'USER',
                    grants: [grant({ key: PHOTOS, value: 30, strategy: 'SUM' })]
                })
            ]
        });

        expect(folded.get(PHOTOS)).toBe(50);
        expect([...folded.keys()]).toStrictEqual([PHOTOS]);
    });

    it('MAX takes the highest, which is the most favorable for the client', () => {
        const folded = foldPlegableSet({
            sources: [
                subscription([grant({ key: COMPARE, value: 3, strategy: 'MAX' })]),
                addon({
                    scope: 'USER',
                    grants: [grant({ key: COMPARE, value: 10, strategy: 'MAX' })]
                })
            ]
        });

        expect(folded.get(COMPARE)).toBe(10);
    });

    it('MIN takes the lowest, which is the most favorable for the client', () => {
        const folded = foldPlegableSet({
            sources: [
                subscription([grant({ key: RESPONSE_HOURS, value: 24, strategy: 'MIN' })]),
                addon({
                    scope: 'USER',
                    grants: [grant({ key: RESPONSE_HOURS, value: 4, strategy: 'MIN' })]
                })
            ]
        });

        expect(folded.get(RESPONSE_HOURS)).toBe(4);
    });

    it('BEST_DECLARED refuses the key: its order is not declared, never guessed', () => {
        expect(() =>
            foldPlegableSet({
                sources: [
                    subscription([
                        grant({ key: SUPPORT_LEVEL, value: 2, strategy: 'BEST_DECLARED' })
                    ]),
                    addon({
                        scope: 'USER',
                        grants: [grant({ key: SUPPORT_LEVEL, value: 1, strategy: 'BEST_DECLARED' })]
                    })
                ]
            })
        ).toThrow(UndecidableKeyError);
    });

    it('folds several keys of the same set, each with its own strategy', () => {
        const folded = foldPlegableSet({
            sources: [
                subscription([
                    grant({ key: PHOTOS, value: 20, strategy: 'SUM' }),
                    grant({ key: COMPARE, value: 5, strategy: 'MAX' })
                ]),
                addon({
                    scope: 'USER',
                    grants: [
                        grant({ key: PHOTOS, value: 30, strategy: 'SUM' }),
                        grant({ key: COMPARE, value: 8, strategy: 'MAX' })
                    ]
                })
            ]
        });

        expect([folded.get(PHOTOS), folded.get(COMPARE)]).toStrictEqual([50, 8]);
    });

    it('is order-independent: the catalog key decides, never the first source', () => {
        // `max_photos_per_accommodation` declares SUM in the catalog. One source
        // carries the declared strategy and the other a contradicting one, so a
        // fold that read the strategy from its first source would return 50 with
        // the plan first and 30 with the addon first. The catalog decides instead.
        const declared = subscription([grant({ key: PHOTOS, value: 20, strategy: 'SUM' })]);
        const contradicting = addon({
            scope: 'USER',
            grants: [grant({ key: PHOTOS, value: 30, strategy: 'MAX' })]
        });

        const planFirst = foldPlegableSet({ sources: [declared, contradicting] });
        const addonFirst = foldPlegableSet({ sources: [contradicting, declared] });

        expect(planFirst.get(PHOTOS)).toBe(50);
        expect(addonFirst.get(PHOTOS)).toBe(50);
        expect([...addonFirst]).toStrictEqual([...planFirst]);
    });

    it('refuses contradicting strategies on a key the catalog does not declare', () => {
        expect(() =>
            foldPlegableSet({
                sources: [
                    subscription([grant({ key: RESPONSE_HOURS, value: 24, strategy: 'MIN' })]),
                    addon({
                        scope: 'USER',
                        grants: [grant({ key: RESPONSE_HOURS, value: 4, strategy: 'MAX' })]
                    })
                ]
            })
        ).toThrow(ContradictoryStrategyError);
    });
});
