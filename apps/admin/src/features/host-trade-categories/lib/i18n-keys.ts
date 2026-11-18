/**
 * @file i18n-keys.ts
 * @description Builds `admin-pages.hostTradeCategories.*` translation keys.
 *
 * The catalog screen shares its dialogs between groups and categories, so the
 * key's scope is a runtime value and the literal-key type of `t()` cannot see
 * it. The cast lives here, once, and the key tree itself is checked by the
 * i18n parity guards and by the typed-keys build.
 */

import type { TranslationKey } from '@repo/i18n';

/** Root of the screen's copy. */
const ROOT = 'admin-pages.hostTradeCategories';

/**
 * Returns the full translation key for a path under the catalog screen's copy.
 *
 * @param input - Object with the path below `admin-pages.hostTradeCategories`.
 * @returns The key, typed for `t()`.
 *
 * @example
 * ```ts
 * t(catalogKey({ path: 'groups.dialog.slugLabel' }));
 * ```
 */
export function catalogKey({ path }: { readonly path: string }): TranslationKey {
    return `${ROOT}.${path}` as TranslationKey;
}
