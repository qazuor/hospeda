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
 * T-039b: Single-check fallback — when initialIsFavorited is undefined and the
 * user is authenticated, fires a lightweight check on mount to hydrate the state.
 */

import { AuthRequiredPopover } from '@/components/auth/AuthRequiredPopover.client';
import type { BookmarkCollectionItem } from '@/lib/api/endpoints-protected';
import { userBookmarksApi } from '@/lib/api/endpoints-protected';
import { cn } from '@/lib/cn';
import { createT } from '@/lib/i18n';
import type { SupportedLocale } from '@/lib/i18n';
import { addToast } from '@/store/toast-store';
import { FavoriteIcon } from '@repo/icons';
import { type FC, type MouseEvent, useEffect, useRef, useState } from 'react';
import { CollectionPickerPopover } from './CollectionPickerPopover';
import styles from './FavoriteButton.module.css';
import { getUserCollections } from './user-collections-cache';

/**
 * Polymorphic entity types that can be favorited.
 * Must stay in sync with the EntityTypeEnum in @repo/schemas.
 */
export type FavoriteEntityType = 'ACCOMMODATION' | 'DESTINATION' | 'EVENT' | 'POST' | 'ATTRACTION';

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
    /** Initial favorited state, typically hydrated from a bulk-check API call. */
    readonly initialIsFavorited?: boolean;
    /**
     * Bookmark id when the entity is already favorited on mount.
     * Required for explicit DELETE flows in some API call patterns.
     */
    readonly initialBookmarkId?: string | null;
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
     * Whether the current user is authenticated.
     * When false, click will trigger AuthRequiredPopover.
     * When true, click will toggle the favorite via API.
     */
    readonly isAuthenticated: boolean;
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
 * **T-038b behavior:** Unauthenticated clicks open the AuthRequiredPopover.
 *
 * **T-039a behavior:** Authenticated clicks apply an optimistic state update
 * immediately, call `userBookmarksApi.toggle`, then:
 * - On success: confirm the optimistic state and update the bookmarkId from the response.
 * - On 401: rollback optimistic state and reopen the AuthRequiredPopover (session expired race).
 * - On 403 + LIMIT_REACHED: rollback optimistic state and show a limit-reached toast.
 * - On any other error: rollback optimistic state and show a generic error toast.
 *
 * A `isPending` guard prevents double-click while the request is in-flight.
 *
 * **T-039b behavior:** When `initialIsFavorited` is `undefined` and the user is
 * authenticated, fires a single `userBookmarksApi.checkStatus` call on mount to
 * hydrate the local state. During the check, `isHydrating` is true and clicks are
 * blocked. On error, silently defaults to `isFavorited = false`. Uses AbortController
 * to cancel the request on unmount. The check is skipped if `initialIsFavorited` is
 * provided (even as `false`) — the parent's hydration is trusted.
 *
 * @param props - {@link FavoriteButtonProps}
 * @returns A positioned wrapper containing the button and (conditionally) the popover.
 *
 * @example
 * ```astro
 * <FavoriteButton
 *   entityId={accommodation.id}
 *   entityType="ACCOMMODATION"
 *   initialIsFavorited={userHasFavorited}
 *   isAuthenticated={!!user}
 *   locale={locale}
 *   client:visible
 * />
 * ```
 */
export const FavoriteButton: FC<FavoriteButtonProps> = ({
    entityId,
    entityType,
    initialIsFavorited,
    initialBookmarkId = null,
    variant = 'standalone',
    locale = 'es',
    className,
    isAuthenticated,
    onChange,
    count,
    showCount = false
}) => {
    const t = createT(locale);

    /**
     * Whether the initial state needs to be fetched from the API.
     * True only when the parent did not provide initialIsFavorited at all (undefined).
     */
    const needsHydration = initialIsFavorited === undefined;

    const [isFavorited, setIsFavorited] = useState<boolean>(initialIsFavorited ?? false);

    // bookmarkId tracks the server-side id returned by the API.
    const [bookmarkId, setBookmarkId] = useState<string | null>(initialBookmarkId);

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

    /**
     * Whether the component is currently performing the initial check call.
     * Blocks clicks and shows a subtle loading affordance.
     * Only ever true when needsHydration === true and isAuthenticated === true.
     */
    const [isHydrating, setIsHydrating] = useState<boolean>(needsHydration && isAuthenticated);

    /**
     * Guard ref to ensure the check fires exactly once on mount.
     * useEffect with an empty dep array already guarantees single-shot, but
     * the ref protects against Strict-Mode double-invocation in development.
     */
    const hydrationFiredRef = useRef<boolean>(false);

    // Single-shot hydration: fire the check when parent did not pre-hydrate the state.
    // Deps are intentionally omitted: this effect must run exactly once on mount.
    // entityId, entityType, isAuthenticated, onChange are captured via closure at mount time.
    // The hydrationFiredRef guard prevents a second run if Strict-Mode double-invokes.
    // biome-ignore lint/correctness/useExhaustiveDependencies: intentional single-shot mount effect
    useEffect(() => {
        if (!needsHydration || !isAuthenticated || hydrationFiredRef.current) return;

        hydrationFiredRef.current = true;
        const controller = new AbortController();

        const runCheck = async (): Promise<void> => {
            setIsHydrating(true);
            try {
                const result = await userBookmarksApi.checkStatus({ entityId, entityType });
                // Bail out silently if the component unmounted before the response arrived.
                if (controller.signal.aborted) return;

                if (result.ok) {
                    setIsFavorited(result.data.isFavorited);
                    setBookmarkId(result.data.bookmarkId);
                    onChange?.({
                        isFavorited: result.data.isFavorited,
                        bookmarkId: result.data.bookmarkId
                    });
                }
                // On non-ok result: silently default to false (already the initial state).
            } catch {
                // Network error or abort — silently default to false.
            } finally {
                if (!controller.signal.aborted) {
                    setIsHydrating(false);
                }
            }
        };

        void runCheck();

        return () => {
            controller.abort();
        };
    }, []); // intentionally empty — single-shot on mount only

    const ariaLabel = isHydrating
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
    const returnUrl = typeof window !== 'undefined' ? window.location.href : '';

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

        setIsFavorited(nextFavorited);
        setBookmarkId(optimisticBookmarkId);
        setIsPending(true);

        onChange?.({ isFavorited: nextFavorited, bookmarkId: optimisticBookmarkId });

        try {
            const result = await userBookmarksApi.toggle({
                entityId,
                entityType
            });

            if (!result.ok) {
                const status = result.error.status;
                const errorCode = result.error.code;

                if (status === 401) {
                    // Session expired between page load and click — rollback and prompt auth.
                    setIsFavorited(prevFavorited);
                    setBookmarkId(prevBookmarkId);
                    onChange?.({ isFavorited: prevFavorited, bookmarkId: prevBookmarkId });
                    setIsPopoverOpen(true);
                } else if (status === 403 && errorCode === 'LIMIT_REACHED') {
                    // User hit their plan's favorites limit — rollback and show specific toast.
                    setIsFavorited(prevFavorited);
                    setBookmarkId(prevBookmarkId);
                    onChange?.({ isFavorited: prevFavorited, bookmarkId: prevBookmarkId });
                    addToast({
                        type: 'error',
                        message: t(
                            'ui.favorite.error_limit_reached',
                            'Alcanzaste el límite de favoritos. Actualizá tu plan para agregar más.'
                        )
                    });
                } else {
                    // Any other API error — rollback and show generic toast.
                    setIsFavorited(prevFavorited);
                    setBookmarkId(prevBookmarkId);
                    onChange?.({ isFavorited: prevFavorited, bookmarkId: prevBookmarkId });
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

            // Success: confirm the optimistic state and update bookmarkId from the response.
            const confirmedBookmarkId = result.data.bookmark?.id ?? null;
            setBookmarkId(confirmedBookmarkId);

            // Notify parent with the confirmed bookmarkId.
            onChange?.({ isFavorited: nextFavorited, bookmarkId: confirmedBookmarkId });

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
                        label: t('account.favorites.toast.view', 'Ver favoritos'),
                        href: favoritesHref
                    }
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
            }
            // Reset the per-click assignment ref so the next save starts fresh.
            assignedCollectionRef.current = null;
        } catch {
            // Network failure or unexpected throw — rollback and show generic toast.
            setIsFavorited(prevFavorited);
            setBookmarkId(prevBookmarkId);
            onChange?.({ isFavorited: prevFavorited, bookmarkId: prevBookmarkId });
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

        // Block interaction while the initial hydration check is in-flight.
        if (isHydrating) return;

        if (!isAuthenticated) {
            // Open the auth-required popover so the guest can sign in.
            setIsPopoverOpen(true);
            return;
        }

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
                aria-busy={isPending || isHydrating}
                data-variant={variant}
                data-entity-type={entityType}
                data-pending={isPending ? 'true' : undefined}
                data-hydrating={isHydrating ? 'true' : undefined}
                data-show-count={showCountPill ? 'true' : undefined}
                className={cn(styles.button, className)}
                onClick={handleClick}
                disabled={isPending || isHydrating}
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
