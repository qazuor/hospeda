/**
 * @file CompareCardSelect.client.tsx
 * @description Whole-card compare-selection overlay for accommodation listing
 * cards (HOS-85 post-review fix).
 *
 * Replaces the earlier `CompareButton` `variant="contextual"` usage inside
 * `AccommodationCard.astro`. That control was mounted as
 * `<CompareButton client:visible variant="contextual" />`: it rendered `null`
 * while compare mode was off (the default, including SSR), and the card's own
 * scoped `astro-island { display: contents }` rule collapsed the empty wrapper
 * to zero layout space. That combination is exactly the bug: `client:visible`
 * hydrates via `IntersectionObserver`, which needs a non-zero observed area to
 * ever fire — a `display: contents` wrapper with no rendered children has 0x0
 * size, so the observer never fires, the island never hydrates, and the
 * control never appears even after the user turns compare mode on.
 *
 * This component fixes both the bug and a design change requested on review:
 * - **Hydration**: mounted with `client:idle` instead of `client:visible`.
 * `client:idle` hydrates once the browser is idle regardless of the element's
 * size or viewport visibility, so it does not depend on having a non-zero
 * observed area.
 * - **Interaction model**: instead of a small labeled button in the card body,
 * the WHOLE card becomes the selection target while compare mode is active.
 * This component renders an absolutely-positioned overlay (`inset: 0`) that
 * covers the entire card — `AccommodationCard.astro` gives its root `<a>`
 * `position: relative` so the overlay anchors to it — and captures the
 * click/keyboard activation for the whole surface.
 *
 * Rendering contract:
 * - Compare mode OFF (the default, including SSR — {@link useCompareMode}'s
 *   server snapshot is always `false`): renders `null`. No overlay exists, so
 *   the card's own `<a>` handles clicks normally (navigates to the detail
 *   page) and the empty `astro-island` wrapper (paired with the
 *   `display: contents` rule in `AccommodationCard.astro`) takes no layout
 *   space.
 * - Compare mode ON: renders the overlay. Activating it (click, Enter, or
 *   Space) calls `preventDefault` + `stopPropagation` so the event never
 *   reaches the anchor — the card does NOT navigate — then toggles the
 *   accommodation via {@link useCompareGuard}, surfacing the same
 *   added/removed/upsell/limit toasts as {@link CompareButton}. Because the
 *   overlay and the card live in separate DOM subtrees (this is its own
 *   island), the selected-state border/tint are drawn on the overlay itself
 *   rather than by mutating the card's own markup.
 *
 * Visual affordance (post-review fix, HOS-85):
 * - Unselected: no icon/badge is rendered at all. The overlay is fully
 *   transparent except for the hover border/tint, so nothing sits on top of
 *   the card's `FavoriteButton`, which lives in the same top-right corner a
 *   small corner badge used to occupy.
 * - Selected: the brand border + tint on the whole card (`data-selected`)
 *   PLUS a large check icon centered over the card's photo (not a small
 *   corner badge, and not the dead center of the whole card — see
 *   `.selectedCheck` in the CSS module).
 *
 * @module components/shared/compare/CompareCardSelect
 */

import { useCompareGuard } from '@/hooks/useCompareGuard';
import { cn } from '@/lib/cn';
import { createT } from '@/lib/i18n';
import type { SupportedLocale } from '@/lib/i18n';
import { useCompareMode } from '@/store/compare-store';
import { addToast } from '@/store/toast-store';
import { CheckCircleIcon } from '@repo/icons';
import type { FC, KeyboardEvent, MouseEvent } from 'react';
import styles from './CompareCardSelect.module.css';

/** Props for the CompareCardSelect overlay island. */
export interface CompareCardSelectProps {
    /** UUID of the accommodation this card represents. */
    readonly accommodationId: string;
    /** Accommodation name, used for the aria-label and the compare-bar label. */
    readonly accommodationName: string;
    /** Thumbnail URL stored alongside the selection for the compare-bar preview. */
    readonly accommodationThumbnailUrl?: string;
    /** Locale for aria-label and toast messaging. Defaults to `es`. */
    readonly locale?: SupportedLocale;
    /** Additional CSS classes forwarded to the overlay root element. */
    readonly className?: string;
}

/**
 * Whole-card compare-selection overlay, shown only while compare mode
 * ({@link useCompareMode}) is active on the accommodation listing.
 *
 * @param props - {@link CompareCardSelectProps}
 * @returns The overlay island, or `null` while compare mode is off.
 *
 * @example
 * ```astro
 * <a class="acc-card__link" href={detailUrl} style="position: relative">
 *   <CompareCardSelect
 *     client:idle
 *     accommodationId={data.id}
 *     accommodationName={data.name}
 *     accommodationThumbnailUrl={data.featuredImage.url}
 *     locale={locale}
 *   />
 *   <!-- ... rest of the card ... -->
 * </a>
 * ```
 */
export const CompareCardSelect: FC<CompareCardSelectProps> = ({
    accommodationId,
    accommodationName,
    accommodationThumbnailUrl,
    locale = 'es',
    className
}) => {
    const t = createT(locale);
    const compareMode = useCompareMode();
    const { isInList, isLoading, maxItems, toggle } = useCompareGuard();

    // Render nothing while browsing normally: no overlay, no layout footprint
    // (paired with the `astro-island { display: contents }` rule in
    // AccommodationCard.astro), and the card's <a> navigates as usual.
    if (!compareMode) {
        return null;
    }

    const selected = isInList(accommodationId);

    const comparePageHref = `/${locale}/alojamientos/comparar/`;
    const pricingHref = `/${locale}/suscriptores/planes/`;

    const ariaLabel = selected
        ? t('accommodations.comparison.button.removeAriaLabel', 'Quitar de comparación', {
              name: accommodationName
          })
        : t('accommodations.comparison.button.addAriaLabel', 'Agregar a comparación', {
              name: accommodationName
          });

    /** Toggle the accommodation and surface the resulting toast. */
    const activate = (): void => {
        // Defer while entitlements are still loading (guard fails closed until known).
        if (isLoading) return;

        const result = toggle(accommodationId, {
            name: accommodationName,
            thumbnailUrl: accommodationThumbnailUrl
        });

        if (result.action === 'added') {
            addToast({
                type: 'success',
                message: t('accommodations.comparison.toast.added', 'Agregado a la comparación'),
                action: {
                    label: t('accommodations.comparison.toast.view', 'Comparar ahora'),
                    href: comparePageHref
                }
            });
            return;
        }

        if (result.action === 'removed') {
            addToast({
                type: 'success',
                message: t('accommodations.comparison.toast.removed', 'Quitado de la comparación')
            });
            return;
        }

        // result.action === 'blocked'
        if (result.reason === 'upsell') {
            addToast({
                type: 'info',
                message: t(
                    'accommodations.comparison.upsell.message',
                    'Comparar alojamientos está disponible en los planes Plus y VIP.'
                ),
                action: {
                    label: t('accommodations.comparison.upsell.cta', 'Ver planes'),
                    href: pricingHref
                }
            });
            return;
        }

        // result.reason === 'limit'
        addToast({
            type: 'warning',
            message: t(
                'accommodations.comparison.limit.message',
                'Tu plan permite comparar hasta {{max}} alojamientos a la vez.',
                { max: maxItems }
            )
        });
    };

    // The overlay sits directly inside the card's <a> wrapper. Without
    // stopping propagation + preventing default here, the click would bubble
    // to the anchor and the browser would navigate to the detail page,
    // undoing the toggle and defeating the whole point of compare mode.
    const handleClick = (event: MouseEvent<HTMLDivElement>): void => {
        event.preventDefault();
        event.stopPropagation();
        activate();
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        // Prevent the default Space-scrolls-the-page behavior and stop the
        // event from reaching the anchor, same rationale as handleClick.
        event.preventDefault();
        event.stopPropagation();
        activate();
    };

    return (
        // biome-ignore lint/a11y/useSemanticElements: the overlay is rendered inside the card's wrapping <a>; a native <button>/<input type="checkbox"> there would be invalid nested-interactive HTML, so a div with role="checkbox" + keyboard handlers is the intentional accessible choice.
        <div
            role="checkbox"
            tabIndex={0}
            aria-checked={selected}
            aria-label={ariaLabel}
            aria-busy={isLoading}
            data-selected={selected ? 'true' : undefined}
            className={cn(styles.overlay, className)}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
        >
            {/* Unselected: render nothing here — no badge, no icon — so the
                card's FavoriteButton (same top-right corner) is never
                covered. Selected: a large check, centered over the photo,
                on top of the border/tint already applied to `.overlay`
                above via `[aria-checked='true']`. */}
            {selected && (
                <span
                    className={styles.selectedCheck}
                    aria-hidden="true"
                >
                    <CheckCircleIcon
                        size={48}
                        weight="fill"
                        aria-hidden="true"
                    />
                </span>
            )}
        </div>
    );
};
