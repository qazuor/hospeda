import { StarIcon } from '@repo/icons';
import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMap, useMapEvents } from 'react-leaflet';
import { FavoriteButton } from '@/components/shared/favorite/FavoriteButton.client';
import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import type { AccommodationListingItem } from './ListingMap.client';
import styles from './ListingMap.module.css';

const FLOATING_CARD_PADDING = 12;
const FLOATING_CARD_GAP_ABOVE_MARKER = 18;

/**
 * Floating accommodation card, rendered OUTSIDE the Leaflet container (portaled
 * into the map's `.root` wrapper) so it is never clipped by the container's
 * rounded `overflow: hidden`, and positioned so the whole card stays inside the
 * map viewport WITHOUT moving the map (HOS-95).
 *
 * Why not a Leaflet `<Popup>` + autoPan here: on
 * the accommodations map, panning the map fires `moveend`, which makes
 * `useViewportSearch` refetch the results for the new viewport. So an autoPan on
 * popup-open reshuffled the pills and moved the one just clicked — the popup felt
 * "off". This card keeps the map still: it projects the marker's lat/lng to a
 * container pixel with `latLngToContainerPoint`, anchors the card above the
 * marker, then clamps left/top so the card is fully within the map rectangle
 * (padding on every side). It closes on drag/zoom start and on a background map
 * click, mirroring popup semantics.
 */
export function AccommodationCardPopup({
    item,
    viewDetailsLabel,
    priceConsultLabel,
    consultAvailabilityLabel,
    locale,
    onClose
}: {
    readonly item: AccommodationListingItem;
    readonly viewDetailsLabel: string;
    readonly priceConsultLabel: string;
    readonly consultAvailabilityLabel: string;
    readonly locale: SupportedLocale;
    readonly onClose: () => void;
}) {
    const { t } = createTranslations(locale);
    const map = useMap();
    const cardRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

    // Measure the card and clamp it inside the map rectangle. Runs after layout
    // (so `offsetWidth/Height` are real) and on container resize. No continuous
    // follow is needed — the card closes the moment the user drags or zooms.
    useLayoutEffect(() => {
        const place = () => {
            const card = cardRef.current;
            if (!card) return;
            const point = map.latLngToContainerPoint([
                item.approximateLocation.lat,
                item.approximateLocation.lng
            ]);
            const size = map.getSize();
            const cw = card.offsetWidth;
            const ch = card.offsetHeight;
            const pad = FLOATING_CARD_PADDING;
            const left = Math.max(pad, Math.min(point.x - cw / 2, size.x - cw - pad));
            const top = Math.max(
                pad,
                Math.min(point.y - ch - FLOATING_CARD_GAP_ABOVE_MARKER, size.y - ch - pad)
            );
            setPos({ left, top });
        };
        place();
        const container = map.getContainer();
        const ro = new ResizeObserver(place);
        ro.observe(container);
        return () => ro.disconnect();
    }, [map, item]);

    useMapEvents({
        dragstart: onClose,
        zoomstart: onClose,
        click: onClose
    });

    const root = map.getContainer().parentElement;
    if (!root) return null;

    return createPortal(
        <div
            ref={cardRef}
            className={styles.floatingCard}
            style={{
                left: pos ? `${pos.left}px` : '0',
                top: pos ? `${pos.top}px` : '0',
                visibility: pos ? 'visible' : 'hidden'
            }}
        >
            <button
                type="button"
                className={styles.floatingCardClose}
                onClick={onClose}
                aria-label={t('common.close')}
            >
                ×
            </button>
            <AccommodationPopupContent
                item={item}
                viewDetailsLabel={viewDetailsLabel}
                priceConsultLabel={priceConsultLabel}
                consultAvailabilityLabel={consultAvailabilityLabel}
                locale={locale}
            />
        </div>,
        root
    );
}

/** Render the accommodation popup body with its localized price and CTA copy. */
export function AccommodationPopupContent({
    item,
    viewDetailsLabel,
    priceConsultLabel,
    consultAvailabilityLabel,
    locale
}: {
    readonly item: AccommodationListingItem;
    readonly viewDetailsLabel: string;
    readonly priceConsultLabel: string;
    readonly consultAvailabilityLabel: string;
    readonly locale: SupportedLocale;
}) {
    const { t } = createTranslations(locale);
    const hasRating =
        typeof item.averageRating === 'number' &&
        item.averageRating > 0 &&
        typeof item.reviewsCount === 'number' &&
        item.reviewsCount > 0;
    const hasHeaderRow =
        Boolean(item.typeLabel) ||
        (item.isFeatured && Boolean(item.featuredLabel)) ||
        Boolean(item.id);
    return (
        <div className={styles.popupCard}>
            <div className={styles.popupBody}>
                {hasHeaderRow ? (
                    <div className={styles.popupHeader}>
                        <div className={styles.popupHeaderChips}>
                            {item.typeLabel ? (
                                <span className={styles.popupTypeChip}>{item.typeLabel}</span>
                            ) : null}
                            {item.isFeatured && item.featuredLabel ? (
                                <span className={`${styles.popupFeaturedBadge} featured-badge`}>
                                    <StarIcon
                                        size={12}
                                        weight="fill"
                                        aria-hidden="true"
                                    />
                                    <span>{item.featuredLabel}</span>
                                </span>
                            ) : null}
                        </div>
                        <FavoriteButton
                            entityId={item.id}
                            entityType="ACCOMMODATION"
                            count={item.bookmarkCount}
                            variant="compact"
                            locale={locale}
                        />
                    </div>
                ) : null}
                <div className={styles.popupTitleBlock}>
                    <h3 className={styles.popupTitle}>{item.name}</h3>
                    {item.cityName ? <p className={styles.popupCity}>{item.cityName}</p> : null}
                </div>
                {item.summary ? <p className={styles.popupSummary}>{item.summary}</p> : null}
                {hasRating ? (
                    <span
                        className={styles.popupRating}
                        role="img"
                        aria-label={`${item.averageRating?.toFixed(1)} ${t('accommodations.detail.stars')}`}
                    >
                        <span aria-hidden="true">★</span>
                        <span>{item.averageRating?.toFixed(1)}</span>
                        <span className={styles.popupReviewsCount}>
                            {item.reviewsLabel ?? `(${item.reviewsCount})`}
                        </span>
                    </span>
                ) : null}
                <div className={styles.popupFooter}>
                    {item.priceLabel ? (
                        <span className={styles.popupPrice}>{item.priceLabel}</span>
                    ) : (
                        <span className={cn(styles.popupPrice, styles.popupPriceConsult)}>
                            {priceConsultLabel}
                        </span>
                    )}
                    {item.detailHref ? (
                        <a
                            href={item.detailHref}
                            className={cn(
                                styles.popupCta,
                                !item.priceLabel && styles.popupCtaCompact
                            )}
                        >
                            <span>
                                {item.priceLabel ? viewDetailsLabel : consultAvailabilityLabel}
                            </span>
                            <span aria-hidden="true">→</span>
                        </a>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
