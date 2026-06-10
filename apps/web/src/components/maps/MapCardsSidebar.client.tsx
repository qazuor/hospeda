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
import type { ComponentType } from 'react';
import { useEffect, useState } from 'react';

import { FavoriteButton } from '@/components/shared/favorite/FavoriteButton.client';
import type { SupportedLocale } from '@/lib/i18n';
import type { IconProps } from '@repo/icons';
import { GalleryIcon, LocationIcon, StarIcon } from '@repo/icons';
import sidebarStyles from './MapCardsSidebar.module.css';

export interface MapSidebarAmenity {
    readonly id: string;
    readonly label: string;
    /** Resolved Phosphor icon component (resolveAmenityIcon output). */
    readonly Icon: ComponentType<IconProps>;
}

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
    /** Amenities row: up to 4 resolved icon entries + a +N counter for the rest. */
    readonly amenities?: ReadonlyArray<MapSidebarAmenity>;
    readonly extraAmenitiesCount?: number;
    readonly amenitiesLabel?: string;
    /** Favorite button hydration state — passed straight through. */
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
    /** Whether the visitor is signed-in — drives FavoriteButton behavior. */
    readonly isAuthenticated?: boolean;
    readonly i18n: {
        readonly resultsHeading: string;
        readonly resultsCount: (n: number) => string;
        readonly emptyState: string;
        readonly openSheet: string;
        /**
         * "Ver {{count}} resultados" template used on the floating sheet
         * trigger button (mobile). Falls back to `openSheet · resultsCount`
         * when not provided, preserving the previous behavior.
         */
        readonly openSheetCount?: (n: number) => string;
        readonly closeSheet: string;
    };
}

const MOBILE_BREAKPOINT_PX = 768;

/**
 * Renders the card body inside either an `<a>` (mobile, taps go straight to
 * the detail page) or a `<button>` (desktop, click highlights the matching
 * marker on the map with a pulse halo; the trailing CTA inside is the only
 * link to the detail page). Pulling the conditional wrapper into its own
 * component keeps the long card JSX flat and identical between both modes.
 */
function CardClickable({
    isMobile,
    href,
    ariaLabel,
    onSelect,
    children
}: {
    readonly isMobile: boolean;
    readonly href: string;
    readonly ariaLabel: string;
    readonly onSelect: () => void;
    readonly children: React.ReactNode;
}) {
    if (isMobile) {
        return (
            <a
                href={href}
                className={sidebarStyles.cardLink}
                aria-label={ariaLabel}
            >
                {children}
            </a>
        );
    }
    // Desktop: we need a clickable wrapper that can contain other interactive
    // elements (the FavoriteButton is a real <button>; HTML forbids nesting
    // <button> in <button>). Use a div with role="button" + keyboard handler
    // instead, so the whole card stays focusable and clickable while keeping
    // valid HTML for hydration.
    return (
        // biome-ignore lint/a11y/useSemanticElements: deliberate — a <button> here would nest the inner FavoriteButton's real <button> and break hydration. The div+role+tabIndex+onKeyDown combo keeps a11y semantics intact.
        <div
            role="button"
            tabIndex={0}
            className={sidebarStyles.cardLink}
            aria-label={ariaLabel}
            onClick={onSelect}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect();
                }
            }}
        >
            {children}
        </div>
    );
}

export function MapCardsSidebar({
    items,
    hoveredItemId,
    onCardHover,
    onCardSelect,
    locale = 'es',
    isAuthenticated = false,
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
                items.map((item) => {
                    const fullStars = Math.floor(item.averageRating ?? 0);
                    const hasRating =
                        typeof item.averageRating === 'number' && item.averageRating > 0;
                    const photos = item.photoCount ?? 0;
                    return (
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
                            <CardClickable
                                isMobile={isMobile}
                                href={item.detailHref ?? `#${item.slug}`}
                                ariaLabel={item.name}
                                onSelect={() => onCardSelect?.(item.id)}
                            >
                                {/* IMAGE AREA */}
                                <div className={sidebarStyles.cardImageArea}>
                                    {item.thumbnailUrl ? (
                                        <img
                                            src={item.thumbnailUrl}
                                            alt={item.name}
                                            className={sidebarStyles.cardImage}
                                            loading="lazy"
                                        />
                                    ) : (
                                        <div
                                            className={sidebarStyles.cardImagePlaceholder}
                                            aria-hidden="true"
                                        />
                                    )}

                                    {/* "Nuevo" status corner */}
                                    {item.isNew && item.newLabel ? (
                                        <div
                                            className={sidebarStyles.cardStatusCorner}
                                            aria-hidden="true"
                                            style={
                                                {
                                                    '--corner-bg':
                                                        item.newBg ?? 'var(--brand-accent)',
                                                    '--corner-text':
                                                        item.newText ?? 'var(--accent-foreground)'
                                                } as React.CSSProperties
                                            }
                                        >
                                            <span className={sidebarStyles.cardStatusText}>
                                                {item.newLabel}
                                            </span>
                                        </div>
                                    ) : null}

                                    {/* Featured badge */}
                                    {item.isFeatured && item.featuredLabel ? (
                                        <div
                                            className={`${sidebarStyles.cardFeaturedBadge} featured-badge`}
                                        >
                                            <StarIcon
                                                size={12}
                                                weight="fill"
                                                aria-hidden="true"
                                            />
                                            <span>{item.featuredLabel}</span>
                                        </div>
                                    ) : null}

                                    {/* Wave separator */}
                                    <div
                                        className={sidebarStyles.cardWave}
                                        aria-hidden="true"
                                    >
                                        <svg
                                            viewBox="0 0 432 40"
                                            preserveAspectRatio="none"
                                            fill="var(--core-card, white)"
                                            aria-hidden="true"
                                        >
                                            <title>wave</title>
                                            <path d="M0 40V22C72 8 144 0 216 6C288 12 360 24 432 22V40H0Z" />
                                        </svg>
                                    </div>

                                    {/* Actions: favorite + photo count */}
                                    {/* biome-ignore lint/a11y/useKeyWithClickEvents: this wrapper only stops mouse propagation so clicks on the inner FavoriteButton/photo count don't trigger the card's navigation; it isn't itself focusable or actionable */}
                                    <div
                                        className={sidebarStyles.cardActions}
                                        onClick={(e) => e.stopPropagation()}
                                        onMouseDown={(e) => e.stopPropagation()}
                                    >
                                        <FavoriteButton
                                            entityId={item.id}
                                            entityType="ACCOMMODATION"
                                            initialIsFavorited={item.isFavorited}
                                            initialBookmarkId={item.favoriteBookmarkId ?? null}
                                            count={item.bookmarkCount}
                                            variant="standalone"
                                            showCount={true}
                                            locale={locale}
                                            isAuthenticated={isAuthenticated}
                                        />
                                        {photos > 0 && item.photosLabel ? (
                                            <div
                                                className={sidebarStyles.cardPhotoCount}
                                                aria-hidden="true"
                                            >
                                                <GalleryIcon
                                                    size={16}
                                                    weight="fill"
                                                    aria-hidden={true}
                                                />
                                                <span>{item.photosLabel}</span>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>

                                {/* CONTENT AREA */}
                                <div className={sidebarStyles.cardContent}>
                                    {/* Category + Location row */}
                                    <div className={sidebarStyles.cardCategoryRow}>
                                        {item.typeLabel ? (
                                            <span className={sidebarStyles.cardTypePill}>
                                                {item.TypeIcon ? (
                                                    <item.TypeIcon
                                                        size={14}
                                                        weight="bold"
                                                        aria-hidden={true}
                                                    />
                                                ) : null}
                                                <span className={sidebarStyles.cardTypePillLabel}>
                                                    {item.typeLabel}
                                                </span>
                                            </span>
                                        ) : null}
                                        {item.cityName ? (
                                            <span className={sidebarStyles.cardLocation}>
                                                <LocationIcon
                                                    size={12}
                                                    weight="fill"
                                                    aria-hidden={true}
                                                />
                                                <span>{item.cityName}</span>
                                            </span>
                                        ) : null}
                                    </div>

                                    {/* Name */}
                                    <h3 className={sidebarStyles.cardName}>{item.name}</h3>

                                    {/* Description */}
                                    {item.summary ? (
                                        <p className={sidebarStyles.cardDescription}>
                                            {item.summary}
                                        </p>
                                    ) : null}

                                    {/* Amenities row */}
                                    {item.amenities && item.amenities.length > 0 ? (
                                        <div
                                            className={sidebarStyles.cardAmenities}
                                            aria-label={item.amenitiesLabel}
                                        >
                                            {item.amenities.map((amenity) => {
                                                const Icon = amenity.Icon;
                                                return (
                                                    <span
                                                        key={amenity.id}
                                                        className={sidebarStyles.cardAmenity}
                                                        title={amenity.label}
                                                    >
                                                        <Icon
                                                            size={16}
                                                            weight="regular"
                                                            aria-hidden={true}
                                                        />
                                                    </span>
                                                );
                                            })}
                                            {item.extraAmenitiesCount &&
                                            item.extraAmenitiesCount > 0 ? (
                                                <span className={sidebarStyles.cardAmenitiesMore}>
                                                    +{item.extraAmenitiesCount}
                                                </span>
                                            ) : null}
                                        </div>
                                    ) : null}

                                    {/* Stars + rating */}
                                    {hasRating ? (
                                        <div className={sidebarStyles.cardStars}>
                                            {Array.from({ length: 5 }).map((_, i) => (
                                                <span
                                                    // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length list of decorative stars
                                                    key={i}
                                                    className={
                                                        i < fullStars
                                                            ? sidebarStyles.cardStarFilled
                                                            : sidebarStyles.cardStarEmpty
                                                    }
                                                    aria-hidden="true"
                                                >
                                                    <StarIcon
                                                        size={14}
                                                        weight={i < fullStars ? 'fill' : 'regular'}
                                                        aria-hidden={true}
                                                    />
                                                </span>
                                            ))}
                                            <span className={sidebarStyles.cardRatingValue}>
                                                {item.averageRating?.toFixed(1)}
                                            </span>
                                            {item.reviewsLabel ? (
                                                <span className={sidebarStyles.cardReviewsCount}>
                                                    {item.reviewsLabel}
                                                </span>
                                            ) : null}
                                        </div>
                                    ) : null}

                                    {/* Divider */}
                                    <div className={sidebarStyles.cardDivider} />

                                    {/* Price + CTA */}
                                    <div className={sidebarStyles.cardPriceRow}>
                                        <div className={sidebarStyles.cardPriceBlock}>
                                            {item.priceLabel ? (
                                                <>
                                                    {item.priceFromLabel ? (
                                                        <span
                                                            className={sidebarStyles.cardPriceLabel}
                                                        >
                                                            {item.priceFromLabel}
                                                        </span>
                                                    ) : null}
                                                    <span className={sidebarStyles.cardPriceValue}>
                                                        {item.priceLabel}
                                                    </span>
                                                    {item.pricePerNightLabel ? (
                                                        <span
                                                            className={sidebarStyles.cardPriceLabel}
                                                        >
                                                            {item.pricePerNightLabel}
                                                        </span>
                                                    ) : null}
                                                </>
                                            ) : (
                                                <span className={sidebarStyles.cardPriceValue}>
                                                    {item.priceConsultLabel ?? '—'}
                                                </span>
                                            )}
                                        </div>
                                        {item.ctaLabel && item.detailHref ? (
                                            <a
                                                href={item.detailHref}
                                                className={sidebarStyles.cardCta}
                                                onClick={(e) => e.stopPropagation()}
                                                onMouseDown={(e) => e.stopPropagation()}
                                                aria-label={`${item.ctaLabel} — ${item.name}`}
                                            >
                                                {item.ctaLabel}
                                            </a>
                                        ) : null}
                                    </div>
                                </div>
                            </CardClickable>
                        </li>
                    );
                })
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
                    {i18n.openSheetCount
                        ? i18n.openSheetCount(items.length)
                        : `${i18n.openSheet} · ${i18n.resultsCount(items.length)}`}
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
