/**
 * The scope of a key decides how it resolves (HOS-1440, V3.2, AC:V3:3;
 * `V/15` §3): a key of the vertical resolves by `user + vertical`, a global key
 * by `user`. The defense against reading a vertical key from another vertical
 * is structural: its resolution asks for the vertical, so there is no control
 * an author can forget.
 *
 * A metered key (one that carries a quota) is always of vertical (`V/15`
 * §3.2): its monthly window counts by `user + vertical`, and a global metered
 * key granted by two verticals would open two windows against the same quota
 * that cannot see each other. The catalog refuses a metered key declared with
 * `scope: global`.
 *
 * Both rules are pure functions over a catalog definition; the publish-version
 * validation (V2.3 / HOS-1436) reuses {@link assertMeteredKeyIsVertical}, which
 * is why it is exported from the package index.
 */
import { type CatalogKeyDefinition, getCatalogKey } from '@repo/schemas';
import { MeteredKeyGlobalScopeError, MissingVerticalForVerticalKeyError } from './errors';

/** Where a key resolves: by `user + vertical` (a vertical key) or by `user`. */
export type KeyResolution =
    | { readonly by: 'user+vertical'; readonly vertical: string }
    | { readonly by: 'user' };

/** A resolved value can only be read with the identity selected by its catalog scope. */
export interface ScopedKeyValues {
    get(args: {
        readonly key: string;
        readonly userId: string;
        readonly vertical: string | null;
    }): number | undefined;
}

/** Binds resolved values to their user or user-and-vertical identity. */
export function scopeKeyValues(args: {
    readonly values: ReadonlyMap<string, number>;
    readonly userId: string;
    readonly vertical: string;
}): ScopedKeyValues {
    const global = new Map<string, number>();
    const vertical = new Map<string, number>();
    for (const [key, value] of args.values) {
        const definition = getCatalogKey({ key });
        if (!definition) continue;
        const resolution = resolveKeyScope({ definition, vertical: args.vertical });
        (resolution.by === 'user' ? global : vertical).set(key, value);
    }
    return {
        get: ({ key, userId, vertical: requestedVertical }) => {
            if (userId !== args.userId) return undefined;
            const definition = getCatalogKey({ key });
            if (!definition) return undefined;
            const resolution = resolveKeyScope({ definition, vertical: requestedVertical });
            return resolution.by === 'user'
                ? global.get(key)
                : resolution.vertical === args.vertical
                  ? vertical.get(key)
                  : undefined;
        }
    };
}

/**
 * Resolves where a key resolves, from its declared scope.
 *
 * @param args.definition - The catalog definition of the key (only `scope` is read).
 * @param args.vertical - The vertical being resolved, or `null` when there is none.
 * @returns `{ by: 'user+vertical', vertical }` for a vertical key, `{ by: 'user' }`
 * for a global one.
 * @throws MissingVerticalForVerticalKeyError when a vertical key is resolved
 * without a vertical: its resolution asks for it and there is no safe default.
 */
export function resolveKeyScope(args: {
    readonly definition: Pick<CatalogKeyDefinition, 'key' | 'scope'>;
    readonly vertical: string | null;
}): KeyResolution {
    if (args.definition.scope === 'global') return { by: 'user' };
    if (args.vertical === null || args.vertical === '') {
        throw new MissingVerticalForVerticalKeyError({ key: args.definition.key });
    }
    return { by: 'user+vertical', vertical: args.vertical };
}

/**
 * Refuses a metered key declared with `scope: global` (`V/15` §3.2).
 *
 * A metered key is the one whose entitlement row carries a quota; whether the
 * key is metered is a property of the version being read, not of the catalog
 * declaration, which is why it arrives as its own argument.
 *
 * @param args.definition - The catalog definition of the key.
 * @param args.isMetered - Whether the key carries a quota (plan or trial) in
 * the version being read.
 * @throws MeteredKeyGlobalScopeError if the key is metered and its scope is `global`.
 */
export function assertMeteredKeyIsVertical(args: {
    readonly definition: Pick<CatalogKeyDefinition, 'key' | 'scope'>;
    readonly isMetered: boolean;
}): void {
    if (args.isMetered && args.definition.scope === 'global') {
        throw new MeteredKeyGlobalScopeError({
            key: args.definition.key,
            scope: args.definition.scope
        });
    }
}
