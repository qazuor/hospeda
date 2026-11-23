/**
 * @file FavoriteBookmarkCard.tsx
 * @description One favorite on the kit `EntityCard` (HOS-2480): the entity
 * image (Cloudinary `card` preset, HOS-1094), its title linking to the entity,
 * the type, the personal note (autosave on blur, HOS-2445) and two actions:
 * «Mover» (to a collection) and «Quitar» (asks first, HOS-2429).
 */

import { getMediaUrl } from '@repo/media';
import { Button, EntityCard } from '@/components/account/ui';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { EditableNote } from '../EditableNote';
import type { BookmarkItem } from './favorites-api';
import { entityHref, entityTypeLabelKey } from './favorites-tabs';

/** Props of {@link FavoriteBookmarkCard}. */
export interface FavoriteBookmarkCardProps {
    /** The bookmark. */
    readonly bookmark: BookmarkItem;
    /** Page locale. */
    readonly locale: SupportedLocale;
    /** API origin without trailing slash (note PATCH). */
    readonly apiBase: string;
    /** True while its removal is in flight. */
    readonly removing: boolean;
    /** Opens the «Mover» dialog. Omitted where moving is not offered. */
    readonly onMove?: (bookmark: BookmarkItem) => void;
    /** Starts the removal (the caller asks for confirmation). */
    readonly onRemove: (bookmark: BookmarkItem) => void;
    /** Visible label of the remove action. */
    readonly removeLabel: string;
    /** Accessible name prefix of the remove action («Quitar de favoritos»). */
    readonly removeAriaLabel: string;
    /** Data test id of the remove action. */
    readonly removeTestId?: string;
    /** Called after the note was saved. */
    readonly onNoteSaved?: (input: { readonly id: string; readonly description: string }) => void;
}

/**
 * Display title of a bookmark: the user's label, the entity name, or «Sin título».
 *
 * @param input - Options object.
 * @param input.bookmark - The bookmark.
 * @param input.untitled - Translated fallback.
 * @returns The title.
 */
export function bookmarkTitle({
    bookmark,
    untitled
}: {
    readonly bookmark: BookmarkItem;
    readonly untitled: string;
}): string {
    return bookmark.name ?? bookmark.entityName ?? untitled;
}

/**
 * A favorite card.
 *
 * @param props - See {@link FavoriteBookmarkCardProps}.
 * @returns An `EntityCard` `<li>`.
 */
export function FavoriteBookmarkCard({
    bookmark,
    locale,
    apiBase,
    removing,
    onMove,
    onRemove,
    removeLabel,
    removeAriaLabel,
    removeTestId,
    onNoteSaved
}: FavoriteBookmarkCardProps) {
    const t = createT(locale);
    const title = bookmarkTitle({ bookmark, untitled: t('common.untitled') });
    const typeKey = entityTypeLabelKey({ entityType: bookmark.entityType });

    return (
        <EntityCard
            locale={locale}
            title={title}
            href={entityHref({
                locale,
                entityType: bookmark.entityType,
                entityId: bookmark.entityId,
                entitySlug: bookmark.entitySlug
            })}
            image={
                bookmark.entityImage
                    ? {
                          // HOS-1094: entityImage is the raw original; transform at render.
                          src: getMediaUrl(bookmark.entityImage, { preset: 'card' }),
                          alt: title
                      }
                    : undefined
            }
            meta={typeKey ? t(typeKey) : bookmark.entityType}
            actions={
                <>
                    {onMove ? (
                        <Button
                            variant="secondary"
                            size="sm"
                            data-testid={`move-bookmark-button-${bookmark.id}`}
                            disabled={removing}
                            onClick={() => onMove(bookmark)}
                            aria-label={t(
                                'account.favorites.collections.move_button_aria',
                                undefined,
                                {
                                    name: title
                                }
                            )}
                        >
                            {t('account.favorites.collections.move')}
                        </Button>
                    ) : null}
                    <Button
                        variant="danger-ghost"
                        size="sm"
                        data-testid={removeTestId}
                        loading={removing}
                        onClick={() => onRemove(bookmark)}
                        aria-label={`${removeAriaLabel}: ${title}`}
                    >
                        {removeLabel}
                    </Button>
                </>
            }
        >
            <EditableNote
                bookmarkId={bookmark.id}
                initialValue={bookmark.description}
                apiBase={apiBase}
                locale={locale}
                onSaved={(description) => onNoteSaved?.({ id: bookmark.id, description })}
            />
        </EntityCard>
    );
}
