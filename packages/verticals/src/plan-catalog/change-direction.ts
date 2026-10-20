/**
 * The verdict of a plan change, computed from the delta and never from the
 * rank (HOS-1435, V2, AC:V2:4; DEC-ARCH-008, `B/10` §3.5): if anything the
 * destination version grants is worse than what the origin version grants,
 * the change is `DOWN`. Any drop rules; otherwise it is `UP` (a change that
 * lowers nothing, including one that changes nothing).
 *
 * "Worse" follows each key's declared aggregation strategy (read from the
 * catalog with each row), the same favorability the resolution of several
 * sources uses (`V/15` §2):
 * - `SUM` and `MAX`: more is better, so a lower value is worse;
 * - `MIN` (a commitment such as a response time): less is better, so a higher
 *   value is worse (24 to 4 is better);
 * - `BEST_DECLARED`: no key declares its order of values yet, so the verdict
 *   refuses ({@link UndecidableKeyError}) instead of guessing.
 *
 * Two readings this module fixes, because the catalog rows carry them:
 * - **A key the origin grants and the destination does not is a drop.** A
 *   version that does not name a key grants nothing of it.
 * - **An entitlement compares by its plan quota**: a plain entitlement (no
 *   quota) grants unbounded use, so it beats any metered quota of the same
 *   key; a metered one compares quota against quota. The trial quota plays no
 *   part: a plan change is about what the plan grants, not its trial.
 *
 * Only the verdict leaves this module, never the values.
 */
import type { ChangeDirectionResponse } from '@repo/billing-verticals-contract';
import type { AggregationStrategy } from '@repo/schemas';
import type { PlanVersionEffectsRow } from './catalog-reader';
import { UndecidableKeyError } from './errors';

/** Whether a higher or a lower value of a key is the better one. */
type Better = 'HIGHER' | 'LOWER';

/** Which way is better for a key, read from its declared aggregation strategy. */
function betterOf(args: { readonly key: string; readonly strategy: AggregationStrategy }): Better {
    const { key } = args;
    switch (args.strategy) {
        case 'SUM':
        case 'MAX':
            return 'HIGHER';
        case 'MIN':
            return 'LOWER';
        case 'BEST_DECLARED':
            throw new UndecidableKeyError({
                key,
                reason: 'its strategy is BEST_DECLARED and no order of values is declared'
            });
    }
}

/** Whether going from `from` to `to` (both present) is worse under `better`. */
function lowers(args: { readonly from: number; readonly to: number; readonly better: Better }) {
    return args.better === 'HIGHER' ? args.to < args.from : args.to > args.from;
}

/** What one version grants of one key: the value and the key's strategy. */
interface Granted {
    readonly value: number;
    readonly strategy: AggregationStrategy;
}

/**
 * Whether any key granted by `from` is granted worse, or not at all, by `to`.
 * Each map holds, per key, the value it is granted with and its strategy.
 */
function anyDrop(args: {
    readonly from: ReadonlyMap<string, Granted>;
    readonly to: ReadonlyMap<string, Granted>;
}): boolean {
    for (const [key, granted] of args.from) {
        const target = args.to.get(key);
        if (target === undefined) return true;
        const better = betterOf({ key, strategy: granted.strategy });
        if (lowers({ from: granted.value, to: target.value, better })) return true;
    }
    return false;
}

/**
 * An entitlement's value for the comparison: its plan quota, or unbounded for
 * a plain one. Entitlement keys fold by `MAX`, so "unbounded" is the best.
 */
function entitlementValues(effects: PlanVersionEffectsRow): ReadonlyMap<string, Granted> {
    return new Map(
        effects.entitlements.map((row) => [
            row.key,
            {
                value: row.planQuota ?? Number.POSITIVE_INFINITY,
                strategy: row.aggregationStrategy
            }
        ])
    );
}

function limitValues(effects: PlanVersionEffectsRow): ReadonlyMap<string, Granted> {
    return new Map(
        effects.limits.map((row) => [
            row.key,
            { value: row.value, strategy: row.aggregationStrategy }
        ])
    );
}

/**
 * Decides the direction of a change between two plan versions by the delta of
 * what they grant.
 *
 * @param args.from - What the origin (anchored) version grants
 * @param args.to - What the destination version grants
 * @returns `DOWN` if anything drops, `UP` otherwise; never the values
 * @throws UndecidableKeyError if a granted key cannot be ranked
 */
export function decideChangeDirection(args: {
    readonly from: PlanVersionEffectsRow;
    readonly to: PlanVersionEffectsRow;
}): ChangeDirectionResponse {
    const entitlementsDrop = anyDrop({
        from: entitlementValues(args.from),
        to: entitlementValues(args.to)
    });
    const limitsDrop = anyDrop({ from: limitValues(args.from), to: limitValues(args.to) });
    return { direction: entitlementsDrop || limitsDrop ? 'DOWN' : 'UP' };
}
