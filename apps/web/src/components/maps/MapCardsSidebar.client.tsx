/**
 * @file MapCardsSidebar.client.tsx
 * @description Airbnb-style sidebar that lists accommodations visible on the
 * map, synced with marker hover/click. On desktop it sits at the right of the
 * map (split layout). On mobile it collapses into a peekable bottom sheet that
 * the user can expand to browse the cards.
 *
 * Each card visually mirrors the `AccommodationCard.astro` used on the main
 * listing (image with wave separator + status corner + featured badge +
 * favorite + photo count, category pill, location bar, name, summary,
 * amenities, stars, divider, price + CTA). Data is pre-processed by
 * `AccommodationsListingMap.client.tsx` so this island stays presentational.
 *
 * Hover behavior:
 * - hovering a card → highlights its marker on the map (`onCardHover`)
 * - clicking a card → no-op (the link inside the card handles navigation)
 * - hovering a marker → highlights the matching card (`hoveredItemId` prop)
 */

import type { IconProps } from '@repo/icons';
import type { ComponentType } from 'react';
import { useEffect, useState } from 'react';
import { MapCardsSheetTrigger } from '@/components/maps/MapCardsSheetTrigger';
import { Spinner } from '@/components/shared/feedback/Spinner';
import type { SupportedLocale } from '@/lib/i18n';
import sidebarStyles from './MapCardsSidebar.module.css';
import { MapSidebarCard } from './MapSidebarCard';

/** One icon and its localized label for the sidebar card amenities row. */
export interface MapSidebarAmenity {
    readonly id: string;
    readonly label: string;
    /** Resolved Phosphor icon component (resolveAmenityIcon output). */
    readonly Icon: ComponentType<IconProps>;
}

/** Preprocessed accommodation details for one map sidebar card. */
export interface MapSidebarCardData {
    readonly id: string;
    readonly slug: string;
    readonly name: string;
    readonly thumbnailUrl?: string;
    readonly priceLabel?: string;
    readonly typeLabel?: string;
    /** Phosphor icon resolved from the accommodation type (matches the listing
     * card's `<AccommodationTypeBadge>` icon). */
    readonly TypeIcon?: ComponentType<IconProps>;
    readonly cityName?: string;
    readonly summary?: string;
    readonly isFeatured?: boolean;
    readonly featuredLabel?: string;
    readonly averageRating?: number;
    readonly reviewsCount?: number;
    readonly reviewsLabel?: string;
    readonly detailHref?: string;
    /** Pre-formatted "9 fotos" label. Hidden when undefined or 0 photos. */
    readonly photoCount?: number;
    readonly photosLabel?: string;
    /** True when the accommodation was created less than ~30 days ago. */
    readonly isNew?: boolean;
    readonly newLabel?: string;
    /** Status corner background + text colors (matches AccommodationCard). */
    readonly newBg?: string;
    readonly newText?: string;
    /** Pre-translated copy for the price block + CTA. */
    readonly priceFromLabel?: string;
    readonly pricePerNightLabel?: string;
    readonly priceConsultLabel?: string;
    readonly ctaLabel?: string;
    /** Short localized CTA label used beside the no-price explanation. */
    readonly noPriceCtaLabel?: string;
    /** Amenities row: up to 4 resolved icon entries + a +N counter for the rest. */
    readonly amenities?: ReadonlyArray<MapSidebarAmenity>;
    readonly extraAmenitiesCount?: number;
    readonly amenitiesLabel?: string;
    /** Favorite state fields — no longer forwarded to FavoriteButton (HOS-369 WB0-5), kept on the type per data-type-preservation policy. */
    readonly isFavorited?: boolean;
    readonly favoriteBookmarkId?: string | null;
    readonly bookmarkCount?: number;
}

interface MapCardsSidebarProps {
    readonly items: ReadonlyArray<MapSidebarCardData>;
    readonly hoveredItemId: string | null;
    readonly onCardHover: (id: string | null) => void;
    /**
     * Fired when the user clicks anywhere on a card EXCEPT the trailing
     * "Ver más" CTA. The map view treats this as "fly to and focus this
     * accommodation" instead of navigating to the detail page — the detail
     * link is reserved for the CTA only.
     */
    readonly onCardSelect?: (id: string) => void;
    /**
     * Active locale forwarded to per-card FavoriteButton islands so they can
     * render aria labels / popovers in the right language.
     */
    readonly locale?: SupportedLocale;
    /**
     * HOS-2554: catalog names of the plans that carry comparison, read by the SSR page (the
     * catalog reader is server-only). Empty when it could not be read.
     */
    readonly gatePlanNames?: readonly string[];
    /**
     * A1 (SPEC-228): true while `useViewportSearch` is fetching new results for
     * the current viewport. Shows a loading overlay over the (stale) card list.
     */
    readonly isFetching?: boolean;
    readonly i18n: {
        readonly resultsHeading: string;
        readonly resultsCount: (n: number) => string;
        readonly emptyState: string;
        /** Spinner label for the in-flight overlay (A1). */
        readonly loading?: string;
        readonly openSheet: string;
        /**
         * "Ver {{count}} resultados" template used on the floating sheet
         * trigger button (mobile). Falls back to `openSheet · resultsCount`
         * when not provided, preserving the previous behavior.
         */
        readonly openSheetCount?: (n: number) => string;
        /**
         * Short "{{count}} resultados" label shown on the dock trigger where the
         * full "Ver {{count}} resultados" does not fit on one row (HOS-1780).
         */
        readonly openSheetCountShort?: (n: number) => string;
        readonly closeSheet: string;
    };
}

const MOBILE_BREAKPOINT_PX = 768;

/** Lists visible map results in a desktop sidebar or mobile sheet. */
export function MapCardsSidebar({
    items,
    hoveredItemId,
    onCardHover,
    onCardSelect,
    locale = 'es',
    gatePlanNames = [],
    isFetching = false,
    i18n
}: MapCardsSidebarProps) {
    const [isMobile, setIsMobile] = useState(false);
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    useEffect(() => {
        const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`);
        const update = () => setIsMobile(mq.matches);
        update();
        mq.addEventListener('change', update);
        return () => mq.removeEventListener('change', update);
    }, []);

    // Lock body scroll when the bottom sheet is open on mobile.
    useEffect(() => {
        if (!isMobile || !isSheetOpen) return;
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previous;
        };
    }, [isMobile, isSheetOpen]);

    const cards = (
        <ul className={sidebarStyles.list}>
            {items.length === 0 ? (
                <li className={sidebarStyles.empty}>{i18n.emptyState}</li>
            ) : (
                items.map((item) => (
                    <MapSidebarCard
                        key={item.id}
                        item={item}
                        isMobile={isMobile}
                        isHovered={hoveredItemId === item.id}
                        onCardHover={onCardHover}
                        onCardSelect={onCardSelect}
                        locale={locale}
                        gatePlanNames={gatePlanNames}
                    />
                ))
            )}
        </ul>
    );

    // A1 (SPEC-228): overlay shown while a viewport refetch is in flight, so
    // the user sees "updating" instead of stale cards. The Spinner carries the
    // i18n label (role=status) so the in-flight state is announced.
    const loadingOverlay = isFetching ? (
        <div className={sidebarStyles.loadingOverlay}>
            <Spinner
                size="lg"
                label={i18n.loading}
            />
        </div>
    ) : null;

    if (isMobile) {
        return (
            <>
                <MapCardsSheetTrigger
                    label={
                        i18n.openSheetCount
                            ? i18n.openSheetCount(items.length)
                            : `${i18n.openSheet} · ${i18n.resultsCount(items.length)}`
                    }
                    shortLabel={i18n.openSheetCountShort?.(items.length)}
                    isSheetOpen={isSheetOpen}
                    onOpen={() => setIsSheetOpen(true)}
                />
                <div
                    id="map-cards-sheet"
                    className={`${sidebarStyles.sheet} ${
                        isSheetOpen ? sidebarStyles.sheetOpen : ''
                    }`}
                    aria-hidden={!isSheetOpen}
                    role="dialog"
                    aria-label={i18n.resultsHeading}
                    aria-busy={isFetching}
                >
                    <div
                        className={sidebarStyles.sheetHandle}
                        aria-hidden="true"
                    />
                    <div className={sidebarStyles.sheetHeader}>
                        <div>
                            <h2 className={sidebarStyles.sheetTitle}>{i18n.resultsHeading}</h2>
                            <p className={sidebarStyles.sheetSubtitle}>
                                {i18n.resultsCount(items.length)}
                            </p>
                        </div>
                        <button
                            type="button"
                            className={sidebarStyles.sheetClose}
                            onClick={() => setIsSheetOpen(false)}
                            aria-label={i18n.closeSheet}
                        >
                            ×
                        </button>
                    </div>
                    <div className={sidebarStyles.sheetScroll}>{cards}</div>
                    {loadingOverlay}
                </div>
                {isSheetOpen ? (
                    <button
                        type="button"
                        className={sidebarStyles.sheetBackdrop}
                        onClick={() => setIsSheetOpen(false)}
                        aria-label={i18n.closeSheet}
                    />
                ) : null}
            </>
        );
    }

    return (
        <aside
            className={sidebarStyles.sidebar}
            aria-label={i18n.resultsHeading}
            aria-busy={isFetching}
        >
            <div className={sidebarStyles.sidebarHeader}>
                <h2 className={sidebarStyles.sidebarTitle}>{i18n.resultsHeading}</h2>
                <p className={sidebarStyles.sidebarSubtitle}>{i18n.resultsCount(items.length)}</p>
            </div>
            <div className={sidebarStyles.sidebarScroll}>{cards}</div>
            {loadingOverlay}
        </aside>
    );
}
