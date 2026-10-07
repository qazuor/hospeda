import { ENTITLEMENT_KEY_DEFINITIONS } from './entitlement-keys.js';
import type { CatalogKeyDefinition } from './key-attributes.js';
import { LIMIT_KEY_DEFINITIONS } from './limit-keys.js';

/**
 * The whole key catalog: every entitlement key followed by every limit key.
 *
 * The order is deterministic and is the order the `catalog_key` reference rows
 * are written in the structural migration (entitlements first, then limits, each
 * group sorted by key name), so the SQL generator can regenerate it identically.
 */
export const CATALOG_KEY_DEFINITIONS: readonly CatalogKeyDefinition[] = [
    ...[...ENTITLEMENT_KEY_DEFINITIONS].sort(compareByKey),
    ...[...LIMIT_KEY_DEFINITIONS].sort(compareByKey)
];

/** The catalog's key names, in catalog order. */
export const CATALOG_KEY_NAMES: readonly string[] = CATALOG_KEY_DEFINITIONS.map(
    (definition) => definition.key
);

const BY_KEY: ReadonlyMap<string, CatalogKeyDefinition> = new Map(
    CATALOG_KEY_DEFINITIONS.map((definition) => [definition.key, definition])
);

/**
 * Looks a key up in the catalog.
 *
 * @param params.key - The key name to look up.
 * @returns The declared definition, or `undefined` when the catalog does not know the key.
 */
export function getCatalogKey({ key }: { readonly key: string }): CatalogKeyDefinition | undefined {
    return BY_KEY.get(key);
}

/**
 * Whether the catalog knows a key.
 *
 * @param params.key - The key name to test.
 * @returns `true` when the key is declared in the catalog.
 */
export function isCatalogKey({ key }: { readonly key: string }): boolean {
    return BY_KEY.has(key);
}

function compareByKey(a: CatalogKeyDefinition, b: CatalogKeyDefinition): number {
    if (a.key < b.key) return -1;
    return a.key > b.key ? 1 : 0;
}
