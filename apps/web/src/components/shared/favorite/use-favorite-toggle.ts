import { type RefObject, useState } from 'react';
import { WebEvents } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/umami-client';
import { userBookmarksApi } from '@/lib/api/endpoints-protected';
import { buildLimitReachedPayloadFromDetails } from '@/lib/billing-limit-error';
import type { createT, SupportedLocale } from '@/lib/i18n';
import type { ContactOrigin } from '@/lib/listing-contact/listing-contact-events';
import { addToast } from '@/store/toast-store';
import type { FavoriteChangePayload, FavoriteEntityType } from './FavoriteButton.client';

interface FavoriteToggleOptions {
    readonly entityId: string;
    readonly entityType: FavoriteEntityType;
    readonly locale: SupportedLocale;
    readonly t: ReturnType<typeof createT>;
    readonly origin?: ContactOrigin;
    readonly isFavorited: boolean;
    readonly bookmarkId: string | null;
    readonly assignedCollectionRef: RefObject<string | null>;
    readonly publish: (next: FavoriteChangePayload) => void;
    readonly refreshUsage: () => void;
    readonly maybeOpenCollectionPicker: (bookmarkId: string | null) => Promise<void>;
    readonly promptSignIn: () => void;
}

/** Keeps authenticated favorite mutations, rollback and post-success effects together. */
export function useFavoriteToggle({
    entityId,
    entityType,
    locale,
    t,
    origin,
    isFavorited,
    bookmarkId,
    assignedCollectionRef,
    publish,
    refreshUsage,
    maybeOpenCollectionPicker,
    promptSignIn
}: FavoriteToggleOptions) {
    const [isPending, setIsPending] = useState(false);

    /**
     * Handle click for authenticated users.
     * Applies optimistic update, calls the API, and rolls back on error.
     */
    const handleAuthenticatedClick = async (baseFavorited?: boolean): Promise<void> => {
        // Guard against double-click while pending.
        if (isPending) return;

        // Capture current values for potential rollback.
        const prevFavorited = baseFavorited ?? isFavorited;
        const prevBookmarkId = baseFavorited === undefined ? bookmarkId : null;

        // Optimistic update.
        const nextFavorited = !prevFavorited;
        // When toggling on, the bookmarkId will come from the API response.
        // When toggling off, the bookmarkId becomes null.
        const optimisticBookmarkId = nextFavorited ? prevBookmarkId : null;

        setIsPending(true);
        publish({ isFavorited: nextFavorited, bookmarkId: optimisticBookmarkId });

        try {
            const result = await userBookmarksApi.toggle({
                entityId,
                entityType
            });

            if (!result.ok) {
                const status = result.error.status;
                const errorCode = result.error.code;

                if (status === 401) {
                    // No session after all — either a guest whose click was
                    // attempted before the session resolved, or a session that
                    // expired after the page rendered. Rollback and prompt auth.
                    publish({ isFavorited: prevFavorited, bookmarkId: prevBookmarkId });
                    promptSignIn();
                } else if (status === 403 && errorCode === 'LIMIT_REACHED') {
                    // User hit their plan's limit — rollback and show localized toast with upgrade CTA.
                    publish({ isFavorited: prevFavorited, bookmarkId: prevBookmarkId });
                    const limitPayload = buildLimitReachedPayloadFromDetails({
                        details: result.error.details,
                        locale
                    });
                    addToast({
                        type: 'error',
                        message: limitPayload.message,
                        action: limitPayload.action
                    });
                } else {
                    // Any other API error — rollback and show generic toast.
                    publish({ isFavorited: prevFavorited, bookmarkId: prevBookmarkId });
                    addToast({
                        type: 'error',
                        message: t(
                            'ui.favorite.error_generic',
                            'No se pudo actualizar el favorito. Intentá de nuevo.'
                        )
                    });
                }

                return;
            }

            // Success: confirm the optimistic state and publish the server's bookmarkId.
            const confirmedBookmarkId = result.data.bookmark?.id ?? null;
            publish({ isFavorited: nextFavorited, bookmarkId: confirmedBookmarkId });
            refreshUsage();

            if (nextFavorited) {
                // Add: surface a toast with a "Ver favoritos" link. Auto-routes
                // to the collection detail page when the new bookmark landed in
                // a specific collection (populated lazily by the picker
                // pop-over below — see `assignedCollectionRef`).
                const assignedCollectionId = assignedCollectionRef.current;
                const favoritesHref = assignedCollectionId
                    ? `/${locale}/mi-cuenta/favoritos/colecciones/${assignedCollectionId}/`
                    : `/${locale}/mi-cuenta/favoritos/`;
                addToast({
                    type: 'success',
                    message: t('account.favorites.toast.saved', 'Guardado en favoritos'),
                    action: {
                        label: t('account.favorites.toast.view'),
                        href: favoritesHref
                    }
                });
                trackEvent(WebEvents.FavoriteToggledAdd, {
                    entity_type: entityType,
                    entity_id: entityId,
                    assigned_collection: Boolean(assignedCollectionId),
                    ...(origin ? { origin } : {})
                });

                // Open the inline collection picker on the next render if the
                // user has any collections AND the bookmark is not yet assigned.
                if (!assignedCollectionId) {
                    void maybeOpenCollectionPicker(confirmedBookmarkId);
                }
            } else {
                addToast({
                    type: 'success',
                    message: t('account.favorites.toast.removed', 'Eliminado de favoritos')
                });
                trackEvent(WebEvents.FavoriteToggledRemove, {
                    entity_type: entityType,
                    entity_id: entityId,
                    assigned_collection: false,
                    ...(origin ? { origin } : {})
                });
            }
            // Reset the per-click assignment ref so the next save starts fresh.
            assignedCollectionRef.current = null;
        } catch {
            // Network failure or unexpected throw — rollback and show generic toast.
            publish({ isFavorited: prevFavorited, bookmarkId: prevBookmarkId });
            addToast({
                type: 'error',
                message: t(
                    'ui.favorite.error_generic',
                    'No se pudo actualizar el favorito. Intentá de nuevo.'
                )
            });
        } finally {
            setIsPending(false);
        }
    };

    return { isPending, handleAuthenticatedClick } as const;
}
