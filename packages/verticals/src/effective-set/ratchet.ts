/**
 * The ratchet, shared by the trial and the grant (HOS-1440, V3.2, AC:V3:4 and
 * AC:V3:5; DEC-TRIAL-002, DEC-GRANT-005): a FLOOR compared at the end, never a
 * source. The resolution derives the current result, then keeps, per key, the
 * more favorable of the current value and the floor, so the ratchet only ever
 * raises the result.
 *
 * "More favorable" follows the key's declared aggregation strategy, the same
 * favorability the fold of several sources uses (`V/15` §2): `SUM` and `MAX`
 * want the higher value, `MIN` the lower, and `BEST_DECLARED` refuses because
 * no key declares its order of values yet.
 */
import type { AggregationStrategy } from '@repo/schemas';
import { UndecidableKeyError } from '../plan-catalog/errors';

/** Whether a higher or a lower value of a key is the better one. */
export type Better = 'HIGHER' | 'LOWER';

/** Which way is better for a key, read from its declared aggregation strategy. */
export function betterOf(args: {
    readonly key: string;
    readonly strategy: AggregationStrategy;
}): Better {
    switch (args.strategy) {
        case 'SUM':
        case 'MAX':
            return 'HIGHER';
        case 'MIN':
            return 'LOWER';
        case 'BEST_DECLARED':
            throw new UndecidableKeyError({
                key: args.key,
                reason: 'its strategy is BEST_DECLARED and no order of values is declared'
            });
    }
}

/**
 * The more favorable of two values of one key.
 *
 * @param args.key - The key, for the refusal of an unrankable one.
 * @param args.strategy - The key's declared aggregation strategy.
 * @param args.a - One value.
 * @param args.b - The other value.
 * @returns The value the user keeps: the higher when more is better, the lower
 * when less is better.
 * @throws UndecidableKeyError if the key declares `BEST_DECLARED`
 */
export function bestOf(args: {
    readonly key: string;
    readonly strategy: AggregationStrategy;
    readonly a: number;
    readonly b: number;
}): number {
    const better = betterOf({ key: args.key, strategy: args.strategy });
    if (better === 'HIGHER') return Math.max(args.a, args.b);
    return Math.min(args.a, args.b);
}
