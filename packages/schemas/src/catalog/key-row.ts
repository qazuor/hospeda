import type {
    AggregationStrategy,
    CatalogKeyDefinition,
    EnforcementStrategy,
    KeyClass,
    KeyKind,
    KeyScope
} from './key-attributes.js';

/** Compact declaration of one key: `[key, scope, aggregation, enforcement, class]`. */
export type KeyRow = readonly [
    key: string,
    scope: KeyScope,
    aggregation: AggregationStrategy,
    enforcement: EnforcementStrategy,
    keyClass: KeyClass
];

/**
 * Expands compact rows into full {@link CatalogKeyDefinition}s of one kind.
 *
 * @param params.kind - Which list the rows belong to.
 * @param params.rows - The compact rows.
 * @returns One frozen definition per row, in the same order.
 */
export function toDefinitions({
    kind,
    rows
}: {
    readonly kind: KeyKind;
    readonly rows: readonly KeyRow[];
}): readonly CatalogKeyDefinition[] {
    return rows.map(([key, scope, aggregationStrategy, enforcementStrategy, keyClass]) =>
        Object.freeze({ key, kind, scope, aggregationStrategy, enforcementStrategy, keyClass })
    );
}
