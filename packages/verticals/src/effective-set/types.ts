/**
 * The value types the effective set reads (HOS-1439, V3, AC:V3:1 and AC:V3:2,
 * `V/15` §2): what ONE live source grants, and the source itself so the fold can
 * derive its class (`TITLE`, `BASE`, `COMPLEMENT`) before folding anything.
 *
 * The aggregation strategy travels with the value because it lives with the KEY
 * in the catalog, never with the plan (`V/15` §2.3): two plans of one vertical
 * cannot declare different strategies for the same key.
 */
import type { CoverageSource } from '@repo/billing-verticals-contract';
import type { AggregationStrategy } from '@repo/schemas';

/**
 * One value a source grants of one key, with the aggregation strategy the key
 * declares in the catalog.
 */
export interface SourceGrant {
    readonly key: string;
    readonly value: number;
    readonly strategy: AggregationStrategy;
}

/**
 * One live source of `cobertura(user, vertical)` with the values it grants
 * already resolved from its reference. `source` is read only to derive its class
 * and its type; the values are what the fold aggregates.
 */
export interface FoldableSource {
    readonly source: CoverageSource;
    readonly grants: readonly SourceGrant[];
}
