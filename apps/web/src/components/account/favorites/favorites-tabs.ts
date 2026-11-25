/**
 * @file favorites-tabs.ts
 * @description The type tabs of the favorites page and how a bookmark links to
 * its entity (HOS-2480). Built from the same list as the collection page
 * (`lib/collection-entity-types.ts`, HOS-2423), so a bookmarkable type cannot
 * be missing from one page and present in the other.
 *
 * ATTRACTION is left out HERE only: the bookmarks list endpoint validates
 * `entityType` against `EntityTypeEnum`, which has no ATTRACTION, so the tab
 * would answer 400 on every read and show a permanent error. The collection
 * page keeps it (its endpoint accepts it).
 */

import {
    COLLECTION_ENTITY_PATH_SEGMENTS,
    COLLECTION_ENTITY_TYPES,
    COLLECTION_FILTER_LABELS,
    type CollectionEntityType
} from '@/lib/collection-entity-types';
import type { SupportedLocale } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';

/** Types the bookmarks list endpoint accepts, in tab order. */
export const FAVORITES_LIST_ENTITY_TYPES = COLLECTION_ENTITY_TYPES.filter(
    (type): type is Exclude<CollectionEntityType, 'ATTRACTION'> => type !== 'ATTRACTION'
);

/** One type tab, or ALL (no type filter). */
export type FavoritesTabKey = (typeof FAVORITES_LIST_ENTITY_TYPES)[number] | 'ALL';

/** Every tab in order: ALL first. */
export const FAVORITES_TABS: readonly FavoritesTabKey[] = ['ALL', ...FAVORITES_LIST_ENTITY_TYPES];

/**
 * i18n key of a tab label.
 *
 * @param input - Options object.
 * @param input.tab - The tab.
 * @returns The key under `account.favorites.tabs.*`.
 */
export function tabLabelKey({ tab }: { readonly tab: FavoritesTabKey }): string {
    return tab === 'ALL' ? 'account.favorites.tabs.all' : COLLECTION_FILTER_LABELS[tab].key;
}

/**
 * i18n key of the type label of a bookmark (shown under the card title).
 *
 * @param input - Options object.
 * @param input.entityType - The bookmark's raw entity type.
 * @returns The key, or null for a type without a label.
 */
export function entityTypeLabelKey({ entityType }: { readonly entityType: string }): string | null {
    const known = COLLECTION_ENTITY_TYPES.find((type) => type === entityType);
    if (known === 'ACCOMMODATION') return 'accommodations.entity.name';
    return known ? `account.favorites.cardTypes.${known.toLowerCase()}` : null;
}

/**
 * Public URL of a bookmarked entity: the server-resolved slug, falling back to
 * the raw id when the entity was not enriched.
 *
 * @param input - Options object.
 * @param input.locale - Page locale.
 * @param input.entityType - The bookmark's raw entity type.
 * @param input.entityId - The entity id.
 * @param input.entitySlug - The resolved slug, when known.
 * @returns The localized entity URL.
 */
export function entityHref({
    locale,
    entityType,
    entityId,
    entitySlug
}: {
    readonly locale: SupportedLocale;
    readonly entityType: string;
    readonly entityId: string;
    readonly entitySlug?: string | null;
}): string {
    const known = COLLECTION_ENTITY_TYPES.find((type) => type === entityType);
    const segment = known ? COLLECTION_ENTITY_PATH_SEGMENTS[known] : entityType.toLowerCase();
    return buildUrl({ locale, path: `${segment}/${entitySlug ?? entityId}` });
}
