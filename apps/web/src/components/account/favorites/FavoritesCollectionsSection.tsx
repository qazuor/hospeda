/**
 * @file FavoritesCollectionsSection.tsx
 * @description The «Mis colecciones» Section of the favorites page (HOS-2480).
 *
 * An `AsyncRegion` over the collections read: Skeleton, ErrorState with retry,
 * EmptyState, the ONE plan `LockedState` of the page (D9 «sin acceso único»,
 * plan names from the catalog) and a grid of `EntityCard`s linking to each
 * collection. The usage line («3 de 10 colecciones usadas») comes from the same
 * gate «Crear colección» reads.
 */

import {
    AsyncRegion,
    type AsyncResult,
    EmptyState,
    EntityCard,
    EntityCardGrid,
    ErrorState,
    LockedState,
    Section,
    Skeleton
} from '@/components/account/ui';
import type { BookmarkCollectionItem } from '@/lib/api/endpoints-protected';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import { ICON_OPTIONS } from '../collection-picker-config';
import type { CollectionsGate } from './collections-gate';

/** Props of {@link FavoritesCollectionsSection}. */
export interface FavoritesCollectionsSectionProps {
    /** Page locale. */
    readonly locale: SupportedLocale;
    /** The collections region state. */
    readonly state: AsyncResult<readonly BookmarkCollectionItem[]>;
    /** The collections gate (for the usage line). */
    readonly gate: CollectionsGate;
}

/** The decorative visual of a collection: its icon in its color. */
function CollectionVisual({ collection }: { readonly collection: BookmarkCollectionItem }) {
    const entry = collection.icon
        ? ICON_OPTIONS.find((option) => option.key === collection.icon)
        : undefined;
    const Icon = entry?.Component ?? ICON_OPTIONS[0]?.Component;
    if (!Icon) return null;
    return (
        <span style={{ color: collection.color ?? undefined }}>
            <Icon
                size={40}
                weight="duotone"
                aria-hidden="true"
            />
        </span>
    );
}

/**
 * The collections Section.
 *
 * @param props - See {@link FavoritesCollectionsSectionProps}.
 * @returns A kit Section.
 */
export function FavoritesCollectionsSection({
    locale,
    state,
    gate
}: FavoritesCollectionsSectionProps) {
    const { t, tPlural } = createTranslations(locale);
    const usage = gate.kind === 'noPlan' ? null : gate.usage;

    return (
        <Section
            title={t('account.favorites.collections.title')}
            description={
                usage === null
                    ? undefined
                    : t('account.favorites.collections.usage', undefined, {
                          current: usage.current,
                          max: usage.max
                      })
            }
            helpId="section:favorites.collections"
        >
            <AsyncRegion
                state={state}
                loading={() => (
                    <Skeleton
                        locale={locale}
                        shape="block"
                        lines={2}
                    />
                )}
                error={({ retry }) => (
                    <ErrorState
                        locale={locale}
                        onRetry={retry}
                        title={t('account.favorites.collections.loadError')}
                    />
                )}
                empty={() => (
                    <EmptyState
                        title={t('account.favorites.collections.empty')}
                        description={t('account.favorites.collections.emptyDescription')}
                    />
                )}
                locked={(reason) => (
                    <LockedState
                        reason={reason}
                        locale={locale}
                        helpId="section:favorites.collections#locked"
                    />
                )}
                ready={(collections) => (
                    <EntityCardGrid label={t('account.favorites.collections.title')}>
                        {collections.map((collection) => (
                            <EntityCard
                                key={collection.id}
                                locale={locale}
                                title={collection.name}
                                href={buildUrl({
                                    locale,
                                    path: `mi-cuenta/favoritos/colecciones/${collection.id}`
                                })}
                                media={<CollectionVisual collection={collection} />}
                                meta={tPlural(
                                    'account.favorites.bookmarks.count',
                                    collection.bookmarkCount,
                                    { count: collection.bookmarkCount }
                                )}
                            />
                        ))}
                    </EntityCardGrid>
                )}
            />
        </Section>
    );
}
