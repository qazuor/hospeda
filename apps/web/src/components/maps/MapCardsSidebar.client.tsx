/**
 * @file MapCardsSidebar.client.tsx
 * @description Airbnb-style sidebar that lists accommodations visible on the
 * map, synced with marker hover/click. On desktop it sits at the right of the
 * map (split layout). On mobile it collapses into a peekable bottom sheet that
 * the user can expand to browse the cards.
 *
 * Hover behavior:
 * - hovering a card → highlights its marker on the map (`onCardHover`)
 * - clicking a card → no-op (the link inside the card handles navigation)
 * - hovering a marker → highlights the matching card (`hoveredItemId` prop)
 */
import { useEffect, useState } from 'react';

import sidebarStyles from './MapCardsSidebar.module.css';

export interface MapSidebarCardData {
    readonly id: string;
    readonly slug: string;
    readonly name: string;
    readonly thumbnailUrl?: string;
    readonly priceLabel?: string;
    readonly typeLabel?: string;
    readonly cityName?: string;
    readonly summary?: string;
    readonly isFeatured?: boolean;
    readonly featuredLabel?: string;
    readonly averageRating?: number;
    readonly reviewsCount?: number;
    readonly reviewsLabel?: string;
    readonly detailHref?: string;
}

interface MapCardsSidebarProps {
    readonly items: ReadonlyArray<MapSidebarCardData>;
    readonly hoveredItemId: string | null;
    readonly onCardHover: (id: string | null) => void;
    readonly i18n: {
        readonly resultsHeading: string;
        readonly resultsCount: (n: number) => string;
        readonly emptyState: string;
        readonly openSheet: string;
        readonly closeSheet: string;
    };
}

const MOBILE_BREAKPOINT_PX = 768;

export function MapCardsSidebar({ items, hoveredItemId, onCardHover, i18n }: MapCardsSidebarProps) {
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
                    <li
                        key={item.id}
                        className={`${sidebarStyles.card} ${
                            hoveredItemId === item.id ? sidebarStyles.cardHovered : ''
                        }`}
                        onMouseEnter={() => onCardHover(item.id)}
                        onMouseLeave={() => onCardHover(null)}
                        onFocus={() => onCardHover(item.id)}
                        onBlur={() => onCardHover(null)}
                    >
                        <a
                            href={item.detailHref ?? `#${item.slug}`}
                            className={sidebarStyles.cardLink}
                        >
                            {item.thumbnailUrl ? (
                                <div className={sidebarStyles.cardImageWrapper}>
                                    <img
                                        src={item.thumbnailUrl}
                                        alt={item.name}
                                        className={sidebarStyles.cardImage}
                                        loading="lazy"
                                    />
                                    {item.typeLabel ? (
                                        <span className={sidebarStyles.cardTypeChip}>
                                            {item.typeLabel}
                                        </span>
                                    ) : null}
                                </div>
                            ) : null}
                            <div className={sidebarStyles.cardBody}>
                                <div className={sidebarStyles.cardTitleRow}>
                                    <h3 className={sidebarStyles.cardTitle}>{item.name}</h3>
                                    {item.isFeatured && item.featuredLabel ? (
                                        <span className={sidebarStyles.cardFeaturedBadge}>
                                            {item.featuredLabel}
                                        </span>
                                    ) : null}
                                </div>
                                {item.cityName ? (
                                    <p className={sidebarStyles.cardCity}>{item.cityName}</p>
                                ) : null}
                                {item.summary ? (
                                    <p className={sidebarStyles.cardSummary}>{item.summary}</p>
                                ) : null}
                                <div className={sidebarStyles.cardMeta}>
                                    {typeof item.averageRating === 'number' &&
                                    item.averageRating > 0 ? (
                                        <span className={sidebarStyles.cardRating}>
                                            <span aria-hidden="true">★</span>
                                            <span>{item.averageRating.toFixed(1)}</span>
                                            {item.reviewsLabel ? (
                                                <span className={sidebarStyles.cardReviewsCount}>
                                                    {item.reviewsLabel}
                                                </span>
                                            ) : null}
                                        </span>
                                    ) : (
                                        <span />
                                    )}
                                    {item.priceLabel ? (
                                        <span className={sidebarStyles.cardPrice}>
                                            {item.priceLabel}
                                        </span>
                                    ) : null}
                                </div>
                            </div>
                        </a>
                    </li>
                ))
            )}
        </ul>
    );

    if (isMobile) {
        return (
            <>
                <button
                    type="button"
                    className={sidebarStyles.sheetTrigger}
                    onClick={() => setIsSheetOpen(true)}
                    aria-expanded={isSheetOpen}
                    aria-controls="map-cards-sheet"
                >
                    {i18n.openSheet} · {i18n.resultsCount(items.length)}
                </button>
                <div
                    id="map-cards-sheet"
                    className={`${sidebarStyles.sheet} ${
                        isSheetOpen ? sidebarStyles.sheetOpen : ''
                    }`}
                    aria-hidden={!isSheetOpen}
                    // biome-ignore lint/a11y/useSemanticElements: native <dialog> does not compose with the slide-in bottom-sheet animation
                    role="dialog"
                    aria-label={i18n.resultsHeading}
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
        >
            <div className={sidebarStyles.sidebarHeader}>
                <h2 className={sidebarStyles.sidebarTitle}>{i18n.resultsHeading}</h2>
                <p className={sidebarStyles.sidebarSubtitle}>{i18n.resultsCount(items.length)}</p>
            </div>
            <div className={sidebarStyles.sidebarScroll}>{cards}</div>
        </aside>
    );
}
