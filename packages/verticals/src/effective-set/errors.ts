import type { AggregationStrategy, KeyScope } from '@repo/schemas';

/**
 * A key whose scope is `vertical` was resolved without a vertical (HOS-1440,
 * V3.2, AC:V3:3; `V/15` §3): a vertical key resolves by `user + vertical`, so
 * its resolution always asks for the vertical and it can never be read from
 * another vertical by accident. Refusing is what makes the crossing impossible.
 */
export class MissingVerticalForVerticalKeyError extends Error {
    readonly key: string;

    constructor(args: { readonly key: string }) {
        super(
            `key ${args.key} has scope vertical and cannot be resolved without a vertical ` +
                '(its resolution asks for user + vertical, `V/15` §3)'
        );
        this.name = 'MissingVerticalForVerticalKeyError';
        this.key = args.key;
    }
}

/**
 * A metered key (one that carries a quota) was declared with `scope: global`
 * (HOS-1440, V3.2, AC:V3:3; `V/15` §3.2): a metered key is always of vertical,
 * because its window counts by `user + vertical` and a global metered key would
 * open two windows against the same quota. The catalog refuses it.
 */
export class MeteredKeyGlobalScopeError extends Error {
    readonly key: string;
    readonly scope: KeyScope;

    constructor(args: { readonly key: string; readonly scope: KeyScope }) {
        super(
            `metered key ${args.key} is declared with scope ${args.scope} and a metered key ` +
                'is always of vertical (`V/15` §3.2)'
        );
        this.name = 'MeteredKeyGlobalScopeError';
        this.key = args.key;
        this.scope = args.scope;
    }
}

/**
 * The trial plan version that carries the overrides declares entitlement rows
 * (HOS-1440, V3.2, AC:V3:4; DEC-TRIAL-001): only its limits are overrides. An
 * entitlement row there is a declaration this resolution cannot interpret, so
 * it refuses instead of guessing which half is an override.
 */
export class TrialPlanEntitlementOverrideError extends Error {
    readonly planVersionId: string;

    constructor(args: { readonly planVersionId: string }) {
        super(
            `the trial plan version ${args.planVersionId} declares entitlement rows; ` +
                'only its limits are overrides (DEC-TRIAL-001)'
        );
        this.name = 'TrialPlanEntitlementOverrideError';
        this.planVersionId = args.planVersionId;
    }
}

/**
 * A GRANT source carries no floor (HOS-1440, V3.2, AC:V3:5; contract §2): the
 * ratchet of a grant compares against its `floor`, and a grant without one
 * cannot be resolved. It fails explicit, never guesses a floor from billing.
 */
export class GrantWithoutFloorError extends Error {
    constructor() {
        super('the GRANT source carries no floor; its ratchet cannot be resolved (AC:V3:5)');
        this.name = 'GrantWithoutFloorError';
    }
}

/**
 * A GRANT source's anchored plan version belongs to another vertical than the
 * one being resolved (HOS-1440, V3.2, AC:V3:5; G-R2-B): the resolution takes
 * the GRANT source of the vertical being resolved and no other, so a plan of
 * another vertical is a mis-transported source and fails.
 */
export class GrantReferenceVerticalMismatchError extends Error {
    readonly resolvedVertical: string;
    readonly referenceVertical: string;

    constructor(args: {
        readonly resolvedVertical: string;
        readonly referenceVertical: string;
    }) {
        super(
            `the GRANT source references a plan of vertical ${args.referenceVertical} while ` +
                `resolving ${args.resolvedVertical}; a grant is compared by vertical (AC:V3:5)`
        );
        this.name = 'GrantReferenceVerticalMismatchError';
        this.resolvedVertical = args.resolvedVertical;
        this.referenceVertical = args.referenceVertical;
    }
}

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
