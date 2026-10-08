/**
 * The verdict of a plan change, as a pure function of the two versions'
 * effects (HOS-1435, V2, AC:V2:4; unit half of TEST:V2:5, whose DB-backed
 * run lives in test/integration/). Every case gives the destination a HIGHER
 * rank or none at all: the rank is never read.
 */
import { describe, expect, it } from 'vitest';
import type {
    PlanVersionEffectsRow,
    PlanVersionEntitlementRow,
    PlanVersionLimitRow
} from '../../src/plan-catalog/catalog-reader';
import { decideChangeDirection } from '../../src/plan-catalog/change-direction';
import { UndecidableKeyError } from '../../src/plan-catalog/errors';

const effects = (args: {
    readonly entitlements?: readonly PlanVersionEntitlementRow[];
    readonly limits?: readonly PlanVersionLimitRow[];
}): PlanVersionEffectsRow => ({
    entitlements: args.entitlements ?? [],
    limits: args.limits ?? []
});

const photos = (value: number): PlanVersionLimitRow => ({
    key: 'max_photos_per_accommodation',
    value,
    aggregationStrategy: 'SUM'
});
const compare = (value: number): PlanVersionLimitRow => ({
    key: 'max_compare_items',
    value,
    aggregationStrategy: 'MAX'
});
/** A commitment where less is better (no catalog key declares MIN yet). */
const responseHours = (value: number): PlanVersionLimitRow => ({
    key: 'response_time_hours',
    value,
    aggregationStrategy: 'MIN'
});
const reviews: PlanVersionEntitlementRow = {
    key: 'respond_reviews',
    planQuota: null,
    aggregationStrategy: 'MAX'
};
const aiChat = (planQuota: number | null): PlanVersionEntitlementRow => ({
    key: 'ai_chat',
    planQuota,
    aggregationStrategy: 'MAX'
});

describe('TEST:V2:5 (unit) — the verdict is the delta, and any drop rules', () => {
    it('(a) a richer destination with ONE SUM limit lower: DOWN', () => {
        const verdict = decideChangeDirection({
            from: effects({ entitlements: [reviews], limits: [photos(20), compare(3)] }),
            to: effects({
                entitlements: [reviews, aiChat(500)],
                limits: [photos(19), compare(10)]
            })
        });

        expect(verdict).toStrictEqual({ direction: 'DOWN' });
    });

    it('(a) a richer destination with ONE MAX limit lower: DOWN', () => {
        const verdict = decideChangeDirection({
            from: effects({ limits: [photos(20), compare(5)] }),
            to: effects({ entitlements: [reviews], limits: [photos(50), compare(4)] })
        });

        expect(verdict.direction).toBe('DOWN');
    });

    it('(b) only a MIN key changes, from 24 to 4: UP (lower is better)', () => {
        const verdict = decideChangeDirection({
            from: effects({ limits: [photos(20), responseHours(24)] }),
            to: effects({ limits: [photos(20), responseHours(4)] })
        });

        expect(verdict).toStrictEqual({ direction: 'UP' });
    });

    it('the same MIN key from 4 to 24: DOWN', () => {
        const verdict = decideChangeDirection({
            from: effects({ limits: [responseHours(4)] }),
            to: effects({ limits: [responseHours(24)] })
        });

        expect(verdict.direction).toBe('DOWN');
    });

    it('an entitlement the destination does not grant: DOWN, whatever else rises', () => {
        const verdict = decideChangeDirection({
            from: effects({ entitlements: [reviews], limits: [photos(20)] }),
            to: effects({ entitlements: [aiChat(1000)], limits: [photos(200)] })
        });

        expect(verdict.direction).toBe('DOWN');
    });

    it('a limit the destination does not set: DOWN', () => {
        const verdict = decideChangeDirection({
            from: effects({ limits: [photos(20), compare(3)] }),
            to: effects({ limits: [photos(20)] })
        });

        expect(verdict.direction).toBe('DOWN');
    });

    it('a metered quota that drops: DOWN; that rises, or becomes unmetered: UP', () => {
        const drop = decideChangeDirection({
            from: effects({ entitlements: [aiChat(100)] }),
            to: effects({ entitlements: [aiChat(50)] })
        });
        const rise = decideChangeDirection({
            from: effects({ entitlements: [aiChat(100)] }),
            to: effects({ entitlements: [aiChat(150)] })
        });
        const unmetered = decideChangeDirection({
            from: effects({ entitlements: [aiChat(100)] }),
            to: effects({ entitlements: [aiChat(null)] })
        });
        const metered = decideChangeDirection({
            from: effects({ entitlements: [aiChat(null)] }),
            to: effects({ entitlements: [aiChat(100)] })
        });

        expect([drop, rise, unmetered, metered].map((v) => v.direction)).toEqual([
            'DOWN',
            'UP',
            'UP',
            'DOWN'
        ]);
    });

    it('nothing lowers (only gains, or no change at all): UP', () => {
        const gains = decideChangeDirection({
            from: effects({ limits: [photos(20)] }),
            to: effects({ entitlements: [reviews], limits: [photos(20), compare(3)] })
        });
        const same = decideChangeDirection({
            from: effects({ entitlements: [reviews], limits: [photos(20)] }),
            to: effects({ entitlements: [reviews], limits: [photos(20)] })
        });

        expect([gains.direction, same.direction]).toEqual(['UP', 'UP']);
    });

    it('answers the verdict and nothing else', () => {
        const verdict = decideChangeDirection({
            from: effects({ limits: [photos(20)] }),
            to: effects({ limits: [photos(10)] })
        });

        expect(Object.keys(verdict)).toEqual(['direction']);
    });

    it('a BEST_DECLARED key cannot be ranked: refused, never guessed', () => {
        expect(() =>
            decideChangeDirection({
                from: effects({
                    limits: [
                        { key: 'support_level', value: 2, aggregationStrategy: 'BEST_DECLARED' }
                    ]
                }),
                to: effects({
                    limits: [
                        { key: 'support_level', value: 1, aggregationStrategy: 'BEST_DECLARED' }
                    ]
                })
            })
        ).toThrow(UndecidableKeyError);
    });
});
