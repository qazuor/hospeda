/**
 * The fold of the plegable set (HOS-1439, V3, AC:V3:1; `V/15` §2): each key is
 * aggregated with the strategy its catalog declares.
 *
 * The strategy is a property of the KEY, declared once in the catalog
 * (`V/15` §2.2 and §2.3): it never travels with a plan, so two plans of one
 * vertical cannot declare different strategies for the same key. The fold
 * therefore reads it from the catalog with the key and never trusts the first
 * source it happens to see. A key the catalog does not declare (today `MIN` and
 * `BEST_DECLARED` have no catalog key, Coord-12) has no catalog strategy to
 * read: the fold then uses the strategy its sources unanimously declare and
 * refuses a contradiction, so its result never depends on the order the sources
 * arrive in either way.
 *
 * The four strategies fold the SAME set — the one that survives the discard of
 * {@link selectPlegableSources}, not the one `cobertura` returns. `SUM` adds
 * every source; the three "does not accumulate" strategies are one rule said
 * three times, "the most favorable source wins", and only how "favorable" is
 * defined changes: `MAX` the highest, `MIN` the lowest, `BEST_DECLARED` the
 * best under the order the key declares.
 *
 * `BEST_DECLARED` has no declared order in the catalog yet, so the fold refuses
 * it with the same {@link UndecidableKeyError} the change verdict uses
 * (Coord-12, 2026-10-08) instead of guessing one: inventing the order would be
 * deciding product without the owner, and leaving the branch unimplemented would
 * be a silent hole. The key that adds the first `BEST_DECLARED` order replaces
 * this refusal with the comparison.
 */
import { type AggregationStrategy, getCatalogKey } from '@repo/schemas';
import { UndecidableKeyError } from '../plan-catalog/errors';
import { ContradictoryStrategyError } from './errors';
import { selectPlegableSources } from './plegable';
import type { FoldableSource } from './types';

/** One key accumulated across the plegable sources: the strategies declared and the values. */
interface KeyAccumulator {
    readonly declared: AggregationStrategy[];
    readonly values: number[];
}

/**
 * Resolves the strategy that folds one key.
 *
 * The catalog is authoritative whenever it declares the key: the strategy is
 * the key's, not the source's, so the strategies the sources carry are ignored
 * and the fold cannot depend on which source it saw first. A key the catalog
 * does not declare is resolved from its sources only when they agree; a
 * contradiction is refused, never decided by order.
 *
 * @param args - Resolution input.
 * @param args.key - The key being folded.
 * @param args.declared - The strategies the plegable sources declare for it.
 * @returns The strategy the key is folded with.
 * @throws ContradictoryStrategyError if an uncatalogued key is declared with
 * two different strategies.
 */
function resolveStrategy(args: {
    readonly key: string;
    readonly declared: readonly AggregationStrategy[];
}): AggregationStrategy {
    const catalogKey = getCatalogKey({ key: args.key });
    if (catalogKey) return catalogKey.aggregationStrategy;

    const [first, ...rest] = args.declared;
    if (first === undefined) {
        throw new UndecidableKeyError({
            key: args.key,
            reason: 'no source grants it and the catalog does not declare it'
        });
    }
    for (const strategy of rest) {
        if (strategy !== first) {
            throw new ContradictoryStrategyError({ key: args.key, strategies: args.declared });
        }
    }
    return first;
}

/**
 * Folds one key's values with its declared strategy.
 *
 * @param args - Fold input.
 * @param args.key - The key, for the refusal of an unrankable one.
 * @param args.values - The values the plegable sources grant for the key.
 * @param args.strategy - The strategy the key declares.
 * @returns The folded value.
 * @throws UndecidableKeyError if the key declares `BEST_DECLARED`
 */
function foldKey(args: {
    readonly key: string;
    readonly values: readonly number[];
    readonly strategy: AggregationStrategy;
}): number {
    switch (args.strategy) {
        case 'SUM':
            return args.values.reduce((total, value) => total + value, 0);
        case 'MAX':
            return Math.max(...args.values);
        case 'MIN':
            return Math.min(...args.values);
        case 'BEST_DECLARED':
            throw new UndecidableKeyError({
                key: args.key,
                reason: 'its strategy is BEST_DECLARED and no order of values is declared'
            });
    }
}

/**
 * Folds the plegable set of a `user + vertical`.
 *
 * @param args.sources - The live coverage sources with their values already resolved.
 * @returns One value per folded key; the trial overrides and the ratchet are
 * never sources here (`V/15` §2: they act later, not in this aggregation).
 * @throws UndecidableKeyError if a folded key declares `BEST_DECLARED`
 * @throws ContradictoryStrategyError if an uncatalogued key is declared with
 * two different strategies
 */
export function foldPlegableSet({
    sources
}: {
    readonly sources: readonly FoldableSource[];
}): ReadonlyMap<string, number> {
    const plegable = selectPlegableSources({ sources });
    const byKey = new Map<string, KeyAccumulator>();
    for (const { grants } of plegable) {
        for (const grant of grants) {
            const accumulator = byKey.get(grant.key);
            if (accumulator) {
                accumulator.declared.push(grant.strategy);
                accumulator.values.push(grant.value);
            } else {
                byKey.set(grant.key, { declared: [grant.strategy], values: [grant.value] });
            }
        }
    }

    const folded = new Map<string, number>();
    for (const [key, accumulator] of byKey) {
        const strategy = resolveStrategy({ key, declared: accumulator.declared });
        folded.set(key, foldKey({ key, values: accumulator.values, strategy }));
    }
    return folded;
}
