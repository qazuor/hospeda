/**
 * @file provider-category-chips.ts
 * @description View model of the category chips on `/presentacion/proveedores`
 * (HOS-919 US-6). The page used to hand-write 17 chips that disagreed with the
 * catalog; it now renders what the public catalog endpoint returns, grouped.
 *
 * Kept out of the `.astro` file so the part that can fail (the catalog call)
 * and the part that decides what to draw are unit-testable: `.astro`
 * frontmatter cannot render in Vitest.
 */

import type { PublicHostTradeCatalog } from '@repo/schemas';
import type { ApiResult } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { resolveTradeCategoryName } from '@/lib/trade-category-labels';

/** One chip. */
export interface ProviderCategoryChip {
    readonly slug: string;
    readonly label: string;
}

/** One heading with its chips. */
export interface ProviderCategoryChipGroup {
    readonly slug: string;
    readonly title: string;
    readonly chips: ReadonlyArray<ProviderCategoryChip>;
}

/** Result of {@link buildProviderCategoryChipGroups}. */
export interface ProviderCategoryChips {
    /** Groups to render. Empty when the catalog could not be read, or has no rows. */
    readonly groups: ReadonlyArray<ProviderCategoryChipGroup>;
    /**
     * True when the catalog call FAILED. The page uses it to keep the degraded
     * render out of the shared cache: a transient failure must not be served for
     * the whole cache lifetime. An empty but successful catalog is not degraded.
     */
    readonly degraded: boolean;
}

/**
 * Builds the chip groups for the marketing page from the public catalog call.
 *
 * Never throws: a failed call yields no groups plus `degraded: true`, so the
 * page still renders (HOS-919 AC-6.2) without its chips block.
 *
 * @param params.result - Result of `hostTradeCategoryApi.getHostTradeCatalog()`
 * @param params.locale - Page locale (names fall back to Spanish)
 * @returns The groups to draw and whether the render is degraded
 */
export function buildProviderCategoryChipGroups({
    result,
    locale
}: {
    readonly result: ApiResult<PublicHostTradeCatalog>;
    readonly locale: SupportedLocale;
}): ProviderCategoryChips {
    if (!result.ok) return { groups: [], degraded: true };

    const groups = result.data.groups
        .filter((group) => group.categories.length > 0)
        .map((group) => ({
            slug: group.slug,
            title: resolveTradeCategoryName({ nameI18n: group.nameI18n, locale }),
            chips: group.categories.map((category) => ({
                slug: category.slug,
                label: resolveTradeCategoryName({ nameI18n: category.nameI18n, locale })
            }))
        }));

    return { groups, degraded: false };
}
