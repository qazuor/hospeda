import type { AggregationStrategy } from '@repo/schemas';

/**
 * The fold met a key whose sources declare contradicting aggregation strategies
 * and that the catalog does not declare, so there is no authority to say which
 * one folds it (HOS-1439, V3, AC:V3:1; `V/15` §2.3).
 *
 * The strategy belongs to the KEY and is declared once in the catalog, so a
 * catalogued key never reaches this refusal: the catalog decides and the
 * sources' own strategy is ignored. For an uncatalogued key the fold still
 * refuses instead of letting the order of the sources decide, which is the bug
 * this error closes.
 */
export class ContradictoryStrategyError extends Error {
    readonly key: string;
    readonly strategies: readonly AggregationStrategy[];

    constructor(args: {
        readonly key: string;
        readonly strategies: readonly AggregationStrategy[];
    }) {
        super(
            `key ${args.key} declares contradicting aggregation strategies ` +
                `(${args.strategies.join(', ')}) and the catalog does not declare it`
        );
        this.name = 'ContradictoryStrategyError';
        this.key = args.key;
        this.strategies = args.strategies;
    }
}
