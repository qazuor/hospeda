import { GalleryIcon, LocationIcon, StarIcon } from '@repo/icons';
import type { CSSProperties, ReactNode } from 'react';
import { CompareButton } from '@/components/shared/compare/CompareButton.client';
import { FavoriteButton } from '@/components/shared/favorite/FavoriteButton.client';
import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import type { MapSidebarCardData } from './MapCardsSidebar.client';
import styles from './MapSidebarCard.module.css';

/**
 * Renders the card body inside either an `<a>` (mobile, taps go straight to
 * the detail page) or a button-like `<div>` (desktop, click highlights the matching
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
    readonly children: ReactNode;
}) {
    if (isMobile) {
        return (
            <a
                href={href}
                className={styles.cardLink}
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
            className={styles.cardLink}
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

/** Renders one sidebar result and forwards its selection and focus to the map. */
export function MapSidebarCard({
    item,
    isMobile,
    isHovered,
    onCardHover,
    onCardSelect,
    locale,
    gatePlanNames
}: {
    readonly item: MapSidebarCardData;
    readonly isMobile: boolean;
    readonly isHovered: boolean;
    readonly onCardHover: (id: string | null) => void;
    readonly onCardSelect?: (id: string) => void;
    readonly locale: SupportedLocale;
    readonly gatePlanNames: readonly string[];
}) {
    const fullStars = Math.floor(item.averageRating ?? 0);
    const hasRating = typeof item.averageRating === 'number' && item.averageRating > 0;
    const photos = item.photoCount ?? 0;
    return (
        <li
            className={`${styles.card} ${isHovered ? styles.cardHovered : ''}`}
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
                <div className={styles.cardImageArea}>
                    {item.thumbnailUrl ? (
                        <img
                            src={item.thumbnailUrl}
                            alt={item.name}
                            className={styles.cardImage}
                            loading="lazy"
                        />
                    ) : (
                        <div
                            className={styles.cardImagePlaceholder}
                            aria-hidden="true"
                        />
                    )}

                    {/* "Nuevo" status corner */}
                    {item.isNew && item.newLabel ? (
                        <div
                            className={styles.cardStatusCorner}
                            aria-hidden="true"
                            style={
                                {
                                    '--corner-bg': item.newBg ?? 'var(--brand-accent)',
                                    '--corner-text': item.newText ?? 'var(--accent-foreground)'
                                } as CSSProperties
                            }
                        >
                            <span className={styles.cardStatusText}>{item.newLabel}</span>
                        </div>
                    ) : null}

                    {/* Featured badge */}
                    {item.isFeatured && item.featuredLabel ? (
                        <div className={`${styles.cardFeaturedBadge} featured-badge`}>
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
                        className={styles.cardWave}
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
                    {/* biome-ignore lint/a11y/noStaticElementInteractions: purely a mouse-event-propagation stopper around real interactive children (FavoriteButton, photo count); it has no behavior of its own and isn't focusable or actionable */}
                    <div
                        className={styles.cardActions}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <FavoriteButton
                            entityId={item.id}
                            entityType="ACCOMMODATION"
                            count={item.bookmarkCount}
                            variant="standalone"
                            showCount={true}
                            locale={locale}
                        />
                        {photos > 0 && item.photosLabel ? (
                            <div
                                className={styles.cardPhotoCount}
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
                <div className={styles.cardContent}>
                    {/* Category + Location row */}
                    <div className={styles.cardCategoryRow}>
                        {item.typeLabel ? (
                            <span className={styles.cardTypePill}>
                                {item.TypeIcon ? (
                                    <item.TypeIcon
                                        size={14}
                                        weight="bold"
                                        aria-hidden={true}
                                    />
                                ) : null}
                                <span className={styles.cardTypePillLabel}>{item.typeLabel}</span>
                            </span>
                        ) : null}
                        {item.cityName ? (
                            <span className={styles.cardLocation}>
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
                    <h3 className={styles.cardName}>{item.name}</h3>

                    {/* Description */}
                    {item.summary ? <p className={styles.cardDescription}>{item.summary}</p> : null}

                    {/* Amenities row */}
                    {item.amenities && item.amenities.length > 0 ? (
                        // biome-ignore lint/a11y/useSemanticElements: div+role=group+aria-label groups decorative amenity icons; a real <fieldset> would inherit user-agent border/padding/margin that fight this inline card layout
                        <div
                            className={styles.cardAmenities}
                            role="group"
                            aria-label={item.amenitiesLabel}
                        >
                            {item.amenities.map((amenity) => {
                                const Icon = amenity.Icon;
                                return (
                                    <span
                                        key={amenity.id}
                                        className={styles.cardAmenity}
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
                            {item.extraAmenitiesCount && item.extraAmenitiesCount > 0 ? (
                                <span className={styles.cardAmenitiesMore}>
                                    +{item.extraAmenitiesCount}
                                </span>
                            ) : null}
                        </div>
                    ) : null}

                    {/* Stars + rating */}
                    {hasRating ? (
                        <div className={styles.cardStars}>
                            {Array.from({ length: 5 }).map((_, i) => (
                                <span
                                    // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length list of decorative stars
                                    key={i}
                                    className={
                                        i < fullStars ? styles.cardStarFilled : styles.cardStarEmpty
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
                            <span className={styles.cardRatingValue}>
                                {item.averageRating?.toFixed(1)}
                            </span>
                            {item.reviewsLabel ? (
                                <span className={styles.cardReviewsCount}>{item.reviewsLabel}</span>
                            ) : null}
                        </div>
                    ) : null}

                    {/* Divider */}
                    <div className={styles.cardDivider} />

                    {/* Contextual compare control (HOS-85): a labeled
                        add/remove button, only rendered while compare
                        mode is active — mirrors the placement in
                        AccommodationCard.astro so the map sidebar cards
                        behave identically to the listing cards. Unlike
                        the Astro island version, no `display: contents`
                        wrapper trick is needed here: this is a plain
                        React child, so it emits no DOM node at all when
                        it renders `null` (compare mode off), leaving the
                        `gap` layout of `.cardContent` unaffected. The
                        button's own `handleClick` already stops event
                        propagation, so it won't trigger the card's
                        hover-select/navigation handlers. */}
                    <CompareButton
                        accommodationId={item.id}
                        accommodationName={item.name}
                        accommodationThumbnailUrl={item.thumbnailUrl}
                        variant="contextual"
                        locale={locale}
                        gatePlanNames={gatePlanNames}
                    />

                    {/* Price + CTA */}
                    <div className={styles.cardPriceRow}>
                        <div className={styles.cardPriceBlock}>
                            {item.priceLabel ? (
                                <>
                                    {item.priceFromLabel ? (
                                        <span className={styles.cardPriceLabel}>
                                            {item.priceFromLabel}
                                        </span>
                                    ) : null}
                                    <span className={styles.cardPriceValue}>{item.priceLabel}</span>
                                    {item.pricePerNightLabel ? (
                                        <span className={styles.cardPriceLabel}>
                                            {item.pricePerNightLabel}
                                        </span>
                                    ) : null}
                                </>
                            ) : (
                                <span
                                    className={cn(
                                        styles.cardPriceValue,
                                        styles.cardPriceValueConsult
                                    )}
                                >
                                    {item.priceConsultLabel ?? '—'}
                                </span>
                            )}
                        </div>
                        {item.ctaLabel && item.detailHref ? (
                            <a
                                href={item.detailHref}
                                className={cn(
                                    styles.cardCta,
                                    !item.priceLabel && styles.cardCtaCompact
                                )}
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                aria-label={`${item.priceLabel ? item.ctaLabel : (item.noPriceCtaLabel ?? item.ctaLabel)} — ${item.name}`}
                            >
                                {item.priceLabel
                                    ? item.ctaLabel
                                    : (item.noPriceCtaLabel ?? item.ctaLabel)}
                                {!item.priceLabel && item.noPriceCtaLabel ? (
                                    <span aria-hidden="true"> →</span>
                                ) : null}
                            </a>
                        ) : null}
                    </div>
                </div>
            </CardClickable>
        </li>
    );
}
