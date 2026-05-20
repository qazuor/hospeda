/**
 * @file CollectionPickerPopover.tsx
 * @description Lightweight popover anchored to a FavoriteButton that lets the
 * user (optionally) assign a freshly-saved bookmark to one of their
 * collections, without leaving the current page.
 *
 * The popover is fully optional: the bookmark is already persisted by the
 * time it appears. Dismissing the popover (Escape, click outside, X) leaves
 * the bookmark uncollected. Clicking a collection chip fires the assignment
 * in the background and closes the popover with a confirmation toast.
 *
 * Rendered via React Portal to `document.body` with `position: fixed` so the
 * popover is never clipped by ancestor `overflow: hidden` (e.g. the card's
 * image-area that hides the image radius). Position is computed from the
 * anchor button's bounding rect, with auto-flip (above/below) and horizontal
 * clamp to the viewport. Mirrors the approach used by `AuthRequiredPopover`.
 *
 * **Styling note:** styles live in `collection-picker-popover.css` (NOT a
 * CSS Module) and are imported eagerly from `BaseLayout.astro`. A CSS Module
 * here would be lost on Astro `<ClientRouter />` swaps because Vite injects
 * its CSS dynamically and the swap drops dynamically-injected `<style>` tags.
 */

import { translateApiError } from '@/lib/api-errors';
import { userBookmarkCollectionsApi } from '@/lib/api/endpoints-protected';
import type { BookmarkCollectionItem } from '@/lib/api/endpoints-protected';
import type { SupportedLocale } from '@/lib/i18n';
import { createT } from '@/lib/i18n';
import { addToast } from '@/store/toast-store';
import {
    type FC,
    type RefObject,
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState
} from 'react';
import { createPortal } from 'react-dom';

/** Auto-dismiss the popover after this many milliseconds of inactivity. */
const AUTO_DISMISS_MS = 8000;
/** Vertical gap between the trigger and the popover (in px). */
const ANCHOR_GAP = 10;
/** Minimum distance the popover must keep from the viewport edges (in px). */
const VIEWPORT_PADDING = 8;

interface PopoverPosition {
    readonly top: number;
    readonly left: number;
    readonly arrowLeft: number;
    readonly placement: 'bottom' | 'top';
}

/**
 * Compute the popover position from the anchor and popover bounding rects,
 * with auto-flip (top/bottom) and horizontal clamp to the viewport.
 */
function computePosition(
    anchorRect: DOMRect,
    popoverRect: { readonly width: number; readonly height: number },
    viewport: { readonly width: number; readonly height: number }
): PopoverPosition {
    const spaceBelow = viewport.height - anchorRect.bottom;
    const spaceAbove = anchorRect.top;
    const needed = popoverRect.height + ANCHOR_GAP + VIEWPORT_PADDING;

    // Prefer below; flip above only if there is no room below AND there is room above.
    const placement: 'bottom' | 'top' =
        spaceBelow < needed && spaceAbove > spaceBelow ? 'top' : 'bottom';

    const top =
        placement === 'bottom'
            ? anchorRect.bottom + ANCHOR_GAP
            : anchorRect.top - popoverRect.height - ANCHOR_GAP;

    // Default: align popover's right edge with anchor's right edge so the popover
    // stays visually attached to the heart button.
    let left = anchorRect.right - popoverRect.width;

    const minLeft = VIEWPORT_PADDING;
    const maxLeft = viewport.width - popoverRect.width - VIEWPORT_PADDING;
    if (left < minLeft) left = minLeft;
    if (left > maxLeft) left = maxLeft;

    // Arrow points at the anchor's horizontal center.
    const anchorCenterX = anchorRect.left + anchorRect.width / 2;
    const rawArrowLeft = anchorCenterX - left;
    const arrowMin = 12;
    const arrowMax = popoverRect.width - 12;
    const arrowLeft = Math.max(arrowMin, Math.min(arrowMax, rawArrowLeft));

    return { top, left, arrowLeft, placement };
}

export interface CollectionPickerPopoverProps {
    /**
     * Ref to the trigger element (the FavoriteButton). The popover is
     * positioned relative to this element's bounding rect.
     */
    readonly anchorRef: RefObject<HTMLElement | null>;
    /** Bookmark to assign. The popover only opens after a successful save. */
    readonly bookmarkId: string;
    /** User's existing collections (cached at module level). */
    readonly collections: readonly BookmarkCollectionItem[];
    /** Locale for the labels and the toast message. */
    readonly locale: SupportedLocale;
    /** Called when the user dismisses or auto-dismiss fires. */
    readonly onClose: () => void;
    /**
     * Called once a collection has been successfully assigned. Receives the
     * collection id so the parent can update its own toast (e.g. point the
     * "Ver favoritos" link at the collection detail page).
     */
    readonly onAssigned?: (params: { readonly collectionId: string }) => void;
}

export const CollectionPickerPopover: FC<CollectionPickerPopoverProps> = ({
    anchorRef,
    bookmarkId,
    collections,
    locale,
    onClose,
    onAssigned
}) => {
    const t = createT(locale);
    const [busyId, setBusyId] = useState<string | null>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<PopoverPosition | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    // Render via portal only after mount (document is undefined on the server).
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Auto-dismiss after AUTO_DISMISS_MS so a forgotten popover doesn't linger.
    useEffect(() => {
        const timer = setTimeout(onClose, AUTO_DISMISS_MS);
        return () => {
            clearTimeout(timer);
        };
    }, [onClose]);

    // Close on Escape.
    useEffect(() => {
        const onKey = (e: KeyboardEvent): void => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('keydown', onKey);
        };
    }, [onClose]);

    // Close on click outside (ignore clicks on the anchor itself, otherwise
    // re-clicking the heart to dismiss the popover would also re-toggle it).
    useEffect(() => {
        const onClickOutside = (event: MouseEvent): void => {
            const target = event.target as Node;
            if (popoverRef.current?.contains(target)) return;
            if (anchorRef.current?.contains(target)) return;
            onClose();
        };
        // Defer so the click that opened us doesn't immediately close us.
        const handle = setTimeout(() => {
            document.addEventListener('mousedown', onClickOutside);
        }, 0);
        return () => {
            clearTimeout(handle);
            document.removeEventListener('mousedown', onClickOutside);
        };
    }, [anchorRef, onClose]);

    // Position relative to the anchor; reposition on resize; dismiss on scroll
    // (capture:true catches scrolling ancestors too) so the popover does not
    // visually detach from the heart as the page moves.
    useLayoutEffect(() => {
        if (!mounted) return;
        const anchor = anchorRef.current;
        const popover = popoverRef.current;
        if (!anchor || !popover) return;

        const update = (): void => {
            const anchorRect = anchor.getBoundingClientRect();
            const popoverRect = {
                width: popover.offsetWidth,
                height: popover.offsetHeight
            };
            const viewport = {
                width: window.innerWidth,
                height: window.innerHeight
            };
            setPosition(computePosition(anchorRect, popoverRect, viewport));
        };

        update();
        const frame = requestAnimationFrame(() => setIsVisible(true));

        const handleScroll = (): void => onClose();
        window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
        window.addEventListener('resize', update, { passive: true });

        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener('scroll', handleScroll, { capture: true });
            window.removeEventListener('resize', update);
        };
    }, [mounted, anchorRef, onClose]);

    const handlePick = useCallback(
        async (collection: BookmarkCollectionItem): Promise<void> => {
            if (busyId !== null) return;
            setBusyId(collection.id);
            try {
                const result = await userBookmarkCollectionsApi.addBookmark({
                    collectionId: collection.id,
                    bookmarkId
                });
                if (!result.ok) {
                    addToast({
                        type: 'error',
                        message: translateApiError({
                            error: result.error,
                            t,
                            fallback: t(
                                'account.favorites.collections.assignFailed',
                                'No se pudo asignar a la colección'
                            )
                        })
                    });
                    return;
                }
                onAssigned?.({ collectionId: collection.id });
                addToast({
                    type: 'success',
                    message: t('account.favorites.collections.assignSuccess', 'Movido a {{name}}', {
                        name: collection.name
                    }),
                    action: {
                        label: t('account.favorites.toast.view', 'Ver favoritos'),
                        href: `/${locale}/mi-cuenta/favoritos/colecciones/${collection.id}/`
                    }
                });
                onClose();
            } finally {
                setBusyId(null);
            }
        },
        [bookmarkId, busyId, locale, onAssigned, onClose, t]
    );

    if (!mounted) return null;

    const visibilityClass =
        isVisible && position ? 'collection-picker--visible' : 'collection-picker--hidden';

    const popoverNode = (
        <div
            ref={popoverRef}
            className={`collection-picker ${visibilityClass}`}
            style={{
                top: position ? `${position.top}px` : 0,
                left: position ? `${position.left}px` : 0
            }}
            data-placement={position?.placement ?? 'bottom'}
            // biome-ignore lint/a11y/useSemanticElements: inline popover anchored to a button, not a modal dialog — native <dialog> requires showModal()/close() and blocks the page, which is wrong for this UX.
            role="dialog"
            aria-label={t('account.favorites.collections.assignPrompt', 'Asignar a una colección')}
        >
            <div
                aria-hidden="true"
                className="collection-picker__arrow"
                style={{ left: position ? `${position.arrowLeft}px` : undefined }}
            />
            <div className="collection-picker__header">
                <p className="collection-picker__title">
                    {t('account.favorites.collections.assignPrompt', 'Asignar a una colección')}
                </p>
                <button
                    type="button"
                    className="collection-picker__close-btn"
                    onClick={onClose}
                    aria-label={t('common.auth.close', 'Cerrar')}
                >
                    ×
                </button>
            </div>
            <ul className="collection-picker__list">
                {collections.map((collection) => (
                    <li key={collection.id}>
                        <button
                            type="button"
                            className="collection-picker__chip"
                            onClick={() => {
                                void handlePick(collection);
                            }}
                            disabled={busyId !== null}
                        >
                            <span
                                className="collection-picker__color-dot"
                                style={
                                    collection.color
                                        ? { backgroundColor: collection.color }
                                        : undefined
                                }
                                aria-hidden="true"
                            />
                            <span className="collection-picker__chip-name">{collection.name}</span>
                            {typeof collection.bookmarkCount === 'number' && (
                                <span className="collection-picker__chip-count">
                                    {collection.bookmarkCount}
                                </span>
                            )}
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );

    return createPortal(popoverNode, document.body);
};
