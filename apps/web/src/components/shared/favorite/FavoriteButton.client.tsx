/**
 * @file FavoriteButton.client.tsx
 * @description React island for toggling the favorite (heart) state of a polymorphic
 * entity. Used across accommodation cards, map popups, and detail headers.
 *
 * T-038a: Skeleton — structural foundations, props interface, local state, and
 * a no-op click stub.
 * T-038b: Auth detection + AuthRequiredPopover wiring for guest users.
 * T-039a: API wiring — optimistic toggle via userBookmarksApi.toggle, rollback on
 * error, toast notifications, and isPending guard against double-click.
 *
 * HOS-369 WB0-3: the button no longer trusts SSR for anything user-specific.
 * Favorite state comes from the shared `favorites-store` (one bulk request per
 * page load, shared across every heart) and the session is resolved
 * client-side via `useAccountPermissions`. The SSR props that used to carry
 * both survive only as deprecated no-ops until the pages stop computing them
 * (WB0-5). This is what lets a listing's HTML be identical for every visitor,
 * and therefore edge-cacheable.
 */

import { FavoriteIcon } from '@repo/icons';
import { type FC, type MouseEvent, useRef, useState } from 'react';
import { AuthRequiredPopover } from '@/components/auth/AuthRequiredPopover.client';
import { useAccountPermissions } from '@/hooks/use-account-permissions';
import { WebEvents } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/posthog-client';
import type { BookmarkCollectionItem } from '@/lib/api/endpoints-protected';
import { userBookmarksApi } from '@/lib/api/endpoints-protected';
import { buildLimitReachedPayloadFromDetails } from '@/lib/billing-limit-error';
import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import { createT } from '@/lib/i18n';
import { setFavoriteStatus, useFavoriteStatus } from '@/store/favorites-store';
import { addToast } from '@/store/toast-store';
import { CollectionPickerPopover } from './CollectionPickerPopover';
import styles from './FavoriteButton.module.css';
import { getUserCollections } from './user-collections-cache';

/**
 * Polymorphic entity types that can be favorited.
 * Must stay in sync with the EntityTypeEnum in @repo/schemas.
 */
export type FavoriteEntityType =
    | 'ACCOMMODATION'
    | 'ATTRACTION'
    | 'DESTINATION'
    | 'EVENT'
    | 'EXPERIENCE'
    | 'GASTRONOMY'
    | 'POST';

/**
 * Visual display variant for the favorite button.
 *
 * - `standalone` (default): circular icon-only button.
 * - `pill`: circular button with an adjacent count badge slot (count not implemented yet).
 * - `compact`: smaller circular button for dense contexts (map popups, small cards).
 */
export type FavoriteButtonVariant = 'standalone' | 'pill' | 'compact';

/**
 * Payload emitted via `onChange` when the favorited state changes.
 */
export interface FavoriteChangePayload {
    /** Whether the entity is now favorited. */
    readonly isFavorited: boolean;
    /** The bookmark id after the change, or null if the entity was un-favorited. */
    readonly bookmarkId: string | null;
}

/**
 * Props for the FavoriteButton island.
 */
export interface FavoriteButtonProps {
    /** UUID of the entity being favorited. */
    readonly entityId: string;
    /**
     * Polymorphic entity type — must match the EntityTypeEnum from @repo/schemas.
     * ATTRACTION is included for forward-compatibility but is not yet in active use.
     */
    readonly entityType: FavoriteEntityType;
    /**
     * Visual variant:
     * - `standalone` (default): icon-only circular button.
     * - `pill`: with a count-badge slot.
     * - `compact`: smaller, for dense contexts.
     */
    readonly variant?: FavoriteButtonVariant;
    /** Locale for aria-label and future popover messaging. Defaults to 'es'. */
    readonly locale?: SupportedLocale;
    /** Additional CSS classes forwarded to the root button element. */
    readonly className?: string;
    /**
     * Optional callback invoked after a state change.
     * Used by parent listing components to sync local state without re-fetching.
     */
    readonly onChange?: (next: FavoriteChangePayload) => void;
    /**
     * Public count of bookmarks for this entity.
     * When `count >= 3` and either `variant='pill'` or `showCount=true`, the button
     * renders a count badge next to the heart icon. Hidden if count < 3 or undefined.
     */
    readonly count?: number;
    /**
     * Whether to display the count badge regardless of variant.
     * Allows card components using `variant="standalone"` to still show the pill
     * when the entity has >= 3 active bookmarks (AC-10.1).
     * Defaults to false. Backwards-compatible: existing `variant="pill"` consumers
     * retain the pill behaviour without setting this prop.
     */
    readonly showCount?: boolean;
}

/**
 * Favorite (heart) toggle button for polymorphic entities.
 *
 * Renders a circular button with a heart icon. The filled/outlined heart
 * communicates the current favorited state via `aria-pressed` and CSS.
 *
 * **Rendering.** The server always renders the anonymous variant: an unfilled,
 * un-busy heart (HOS-369 D-11). That is what a crawler must see, what a visitor
 * gets if JS never runs, and the only variant that can be cached. The real
 * state arrives from `favorites-store` shortly after hydration.
 *
 * **Session.** Resolved client-side by `useAccountPermissions`, cache-first.
 * A resolved guest gets the AuthRequiredPopover immediately; a resolved session
 * toggles. While the session is still unknown the click is *attempted* rather
 * than guessed — a 401 opens the popover, which is also the backstop for a
 * session that expired after the page was rendered.
 *
 * **Toggle.** Authenticated clicks apply an optimistic update through the store
 * (so every heart showing this entity moves together), call
 * `userBookmarksApi.toggle`, then:
 * - On success: confirm the optimistic state and publish the returned bookmarkId.
 * - On 401: rollback and open the AuthRequiredPopover (session expired race).
 * - On 403 + LIMIT_REACHED: rollback and show a limit-reached toast.
 * - On any other error: rollback and show a generic error toast.
 *
 * An `isPending` guard prevents double-click while the request is in-flight.
 *
 * @param props - {@link FavoriteButtonProps}
 * @returns A positioned wrapper containing the button and (conditionally) the popover.
 *
 * @example
 * ```astro
 * <FavoriteButton
 *   entityId={accommodation.id}
 *   entityType="ACCOMMODATION"
 *   locale={locale}
 *   client:visible
 * />
 * ```
 */
export const FavoriteButton: FC<FavoriteButtonProps> = ({
    entityId,
    entityType,
    variant = 'standalone',
    locale = 'es',
    className,
    onChange,
    count,
    showCount = false
}) => {
    const t = createT(locale);

    /**
     * Favorite state, resolved on the client and shared with every other heart
     * on the page: one bulk request per page load instead of one per card.
     * `isResolving` covers the window from mount until the session and the bulk
     * check have both settled.
     */
    const { isFavorited, bookmarkId, isResolving } = useFavoriteStatus({ entityType, entityId });

    /**
     * Session, resolved cache-first from `/auth/me`. `permissions === null` is
     * the hook's "still resolving" signal; `user` is `null` for a guest.
     */
    const { user, permissions } = useAccountPermissions();
    const isSessionResolved = permissions !== null;

    /** Whether a toggle request is currently in-flight. */
    const [isPending, setIsPending] = useState<boolean>(false);

    /** Whether the auth-required popover is currently visible. */
    const [isPopoverOpen, setIsPopoverOpen] = useState<boolean>(false);

    /**
     * The bookmark id + collections list to render in the inline collection
     * picker. Populated after a successful add when the user has at least one
     * collection. `null` keeps the picker closed.
     */
    const [collectionPicker, setCollectionPicker] = useState<{
        readonly bookmarkId: string;
        readonly collections: readonly BookmarkCollectionItem[];
    } | null>(null);

    /**
     * Tracks the collection a bookmark was just assigned to (via the picker
     * pop-over) so the post-save toast can deep-link to that collection.
     * Ref instead of state because the toast read happens outside the React
     * render cycle (inside `handleAuthenticatedClick`'s async closure).
     */
    const assignedCollectionRef = useRef<string | null>(null);

    // SPEC-228 T-018: No visual spinner added while the state resolves.
    // Reasoning: the delay is potentially perceptible (~50–300ms), but the button
    // is already `disabled`, carries `aria-busy={true}`, and its `aria-label` reads
    // "Verificando favorito…". Adding a Spinner would overlay the heart icon in a
    // tiny (<22px) space, degrading the compact card UX. The existing disabled +
    // aria-busy + aria-label contract satisfies WCAG AA (AT announces the busy
    // state) without a visual disruption. Skipped.

    /**
     * Publish a state change to the shared store and notify the parent.
     *
     * The store is the single source of truth: writing through it keeps every
     * heart rendering this entity — a listing card and its map popup, say — in
     * agreement, which per-component state could not do.
     */
    const publish = (next: {
        readonly isFavorited: boolean;
        readonly bookmarkId: string | null;
    }) => {
        setFavoriteStatus({ entityType, entityId, ...next });
        onChange?.(next);
    };

    const ariaLabel = isResolving
        ? t('ui.favorite.loading', 'Verificando favorito...')
        : isFavorited
          ? t('ui.favorite.remove', 'Quitar de favoritos')
          : t('ui.favorite.add', 'Agregar a favoritos');

    /**
     * Whether to show the count pill.
     * Shown when count >= 3 AND either:
     * - `variant === 'pill'` (backwards-compatible legacy behaviour), OR
     * - `showCount === true` (new opt-in for standalone cards, AC-10.1)
     */
    const showCountPill = count !== undefined && count >= 3 && (variant === 'pill' || showCount);

    /**
     * Localized count string using Intl.NumberFormat for the display locale.
     * Computed only when the pill is actually shown to avoid unnecessary allocation.
     */
    // count is guaranteed defined and >= 3 here because showCountPill checks both conditions.
    // Using the non-null assertion avoids an unnecessary cast while remaining type-safe.
    const formattedCount = showCountPill
        ? // biome-ignore lint/style/noNonNullAssertion: guarded by showCountPill check above
          new Intl.NumberFormat(locale).format(count!)
        : null;

    /**
     * Safely resolves the current page URL for the auth return-redirect.
     * Guarded by typeof window check for SSR safety.
     */
    const returnUrl = typeof window === 'undefined' ? '' : window.location.href;

    /**
     * Handle click for authenticated users.
     * Applies optimistic update, calls the API, and rolls back on error.
     */
    const handleAuthenticatedClick = async (): Promise<void> => {
        // Guard against double-click while pending.
        if (isPending) return;

        // Capture current values for potential rollback.
        const prevFavorited = isFavorited;
        const prevBookmarkId = bookmarkId;

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
                    setIsPopoverOpen(true);
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
                        // HOS-723: forwarded verbatim — the helper decides which
                        // CTA leads. No add-on raises `max_favorites` today, so
                        // `action` is the plan upgrade and `secondaryAction` is
                        // `undefined`; wired anyway so the day one exists the
                        // offer appears without touching this call site.
                        action: limitPayload.action,
                        secondaryAction: limitPayload.secondaryAction
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
                    assigned_collection: Boolean(assignedCollectionId)
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
                    assigned_collection: false
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

    /**
     * Open the collection picker pop-over IF the user has any collections.
     * Called after a successful add; bails out silently if the user has no
     * collections to choose from (the toast is enough in that case).
     */
    const maybeOpenCollectionPicker = async (confirmedBookmarkId: string | null): Promise<void> => {
        if (!confirmedBookmarkId) return;
        try {
            const collections = await getUserCollections();
            if (collections.length === 0) return;
            setCollectionPicker({ bookmarkId: confirmedBookmarkId, collections });
        } catch {
            // Non-critical — silently skip when the cache fetch fails.
        }
    };

    const handleClick = (event: MouseEvent<HTMLButtonElement>): void => {
        // The favorite button is rendered inside a card-wide <a> wrapper in
        // listings/cards. Without stopping propagation, the click bubbles up
        // and the browser navigates to the entity's detail page, undoing the
        // toggle the user just made. Stop propagation + prevent default keep
        // the user on the current page while still letting our toggle run.
        event.stopPropagation();
        event.preventDefault();

        // Block interaction until the favorite state is known — toggling from an
        // unknown base would flip the wrong way.
        if (isResolving) return;

        if (isSessionResolved && user === null) {
            // Known guest: open the auth-required popover immediately, without
            // spending a doomed request first.
            setIsPopoverOpen(true);
            return;
        }

        // Session known-authenticated, or not resolved yet. In the second case we
        // attempt rather than guess: guessing "guest" would show the sign-in
        // prompt to a signed-in user. A 401 opens the popover anyway.
        // Fire-and-forget: errors are handled inside handleAuthenticatedClick.

        void handleAuthenticatedClick();
    };

    const handlePopoverClose = (): void => {
        setIsPopoverOpen(false);
    };

    const buttonRef = useRef<HTMLButtonElement>(null);

    return (
        <div className={styles.wrapper}>
            <button
                ref={buttonRef}
                type="button"
                aria-pressed={isFavorited}
                aria-label={ariaLabel}
                aria-busy={isPending || isResolving}
                data-variant={variant}
                data-entity-type={entityType}
                data-pending={isPending ? 'true' : undefined}
                data-hydrating={isResolving ? 'true' : undefined}
                data-show-count={showCountPill ? 'true' : undefined}
                className={cn(styles.button, className)}
                onClick={handleClick}
                disabled={isPending || isResolving}
            >
                <span
                    className={styles.iconStack}
                    aria-hidden="true"
                >
                    <FavoriteIcon
                        size={variant === 'compact' ? 18 : 22}
                        weight={isFavorited ? 'fill' : 'regular'}
                        aria-hidden="true"
                    />
                    {!isFavorited && (
                        <span className={styles.iconFill}>
                            <FavoriteIcon
                                size={variant === 'compact' ? 18 : 22}
                                weight="fill"
                                aria-hidden="true"
                            />
                        </span>
                    )}
                </span>
                {showCountPill && (
                    <span
                        className={styles.countPill}
                        aria-hidden="true"
                    >
                        {formattedCount}
                    </span>
                )}
            </button>

            {isPopoverOpen && (
                <AuthRequiredPopover
                    anchorRef={buttonRef}
                    message={t(
                        'ui.favorite.auth_required.message',
                        'Para guardar tus favoritos necesitás una cuenta. Es gratis y rápido.'
                    )}
                    onClose={handlePopoverClose}
                    locale={locale}
                    returnUrl={returnUrl}
                />
            )}

            {collectionPicker && (
                <CollectionPickerPopover
                    anchorRef={buttonRef}
                    bookmarkId={collectionPicker.bookmarkId}
                    collections={collectionPicker.collections}
                    locale={locale}
                    onClose={() => setCollectionPicker(null)}
                    onAssigned={({ collectionId }) => {
                        // Remember the assignment so the next toast (if any)
                        // can deep-link to the collection detail page.
                        assignedCollectionRef.current = collectionId;
                    }}
                />
            )}
        </div>
    );
};
