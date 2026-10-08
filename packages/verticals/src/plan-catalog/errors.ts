/** The kind of catalog version a query was asked about. */
export type CatalogVersionKind = 'plan_version' | 'addon_version';

/**
 * A query named a catalog version that does not exist. There is no safe
 * default for a policy or a verdict, so the query refuses instead of guessing.
 */
export class CatalogVersionNotFoundError extends Error {
    readonly kind: CatalogVersionKind;
    readonly id: string;

    constructor(args: { readonly kind: CatalogVersionKind; readonly id: string }) {
        super(`${args.kind} ${args.id} does not exist`);
        this.name = 'CatalogVersionNotFoundError';
        this.kind = args.kind;
        this.id = args.id;
    }
}

/**
 * `changeDirection` met a key it cannot rank: one whose aggregation strategy
 * declares no direction it can read (`BEST_DECLARED`, whose order of values no
 * key declares yet). It refuses rather than answer a verdict it did not compute.
 */
export class UndecidableKeyError extends Error {
    readonly key: string;

    constructor(args: { readonly key: string; readonly reason: string }) {
        super(`changeDirection cannot rank key ${args.key}: ${args.reason}`);
        this.name = 'UndecidableKeyError';
        this.key = args.key;
    }
}
