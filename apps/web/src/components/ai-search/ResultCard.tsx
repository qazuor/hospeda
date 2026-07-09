/**
 * @file ResultCard.tsx
 * @description Compact accommodation card for the SearchChatPanel results
 * grid (SPEC-212 T-010). Extracted from SearchChatPanel.client.tsx (HOS-111
 * follow-up) to keep that file under the repo's 500-line limit — this
 * component has no closure over parent state, so it lifts out cleanly.
 *
 * Card decision: AccommodationCard.astro cannot be used inside a React island.
 * MapCardsSidebar (maps feature) carries too much map-specific state logic.
 * This component renders a compact card — same visual signals (image, type,
 * city, rating, price) but sized for the narrower panel grid. This is
 * intentional: the panel is not the listing page; it provides quick-glance
 * results, not a full browsing surface.
 *
 * @module ResultCard
 */

import { StarIcon } from '@repo/icons';
import type { AccommodationPublic } from '@repo/schemas';
import { getAccommodationTypeLabel } from '@/lib/colors';
import { formatPrice } from '@/lib/format-utils';
import type { createTranslations, SupportedLocale } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import styles from './ResultCard.module.css';

/**
 * Props for {@link ResultCard}.
 *
 * @property item - Accommodation result to display.
 * @property locale - Active locale for price formatting and the detail link.
 * @property t - Bound translation function (from `createTranslations`).
 */
export interface ResultCardProps {
    readonly item: AccommodationPublic;
    readonly locale: SupportedLocale;
    readonly t: ReturnType<typeof createTranslations>['t'];
}

/**
 * Compact accommodation card for the in-panel results grid (HOS-111 T-002).
 *
 * Displays a photo with the type and star-rating overlaid as badges directly
 * on the image, followed by name/city/price in a shortened body — reduces
 * the card's vertical footprint compared to the previous stacked-meta-row
 * layout.
 *
 * @example
 * ```tsx
 * <ResultCard item={accommodation} locale="es" t={t} />
 * ```
 */
export function ResultCard({ item, locale, t }: ResultCardProps) {
    const detailHref = buildUrl({ locale, path: `/alojamientos/${item.slug}/` });
    const thumbnail = item.media?.featuredImage?.url ?? null;
    const cityName = item.cityDestination?.name ?? null;

    const priceValue = item.price?.price;
    const formattedPrice =
        priceValue == null
            ? null
            : formatPrice({
                  amount: priceValue,
                  currency: item.price?.currency ?? 'ARS',
                  locale
              });

    const rating = item.averageRating;
    const hasRating = typeof rating === 'number' && rating > 0;
    const typeLabel = item.type ? getAccommodationTypeLabel({ type: item.type, t }) : null;

    return (
        <a
            href={detailHref}
            // HOS-111 T-002: `resultCardCompact` marks the reduced-height layout —
            // kept as its own class (rather than folded into `resultCard`) so
            // tests/consumers have a stable hook for "this is the compact card".
            className={`${styles.resultCard} ${styles.resultCardCompact}`}
            aria-label={item.name}
        >
            <div className={styles.resultCardImageWrap}>
                {thumbnail ? (
                    <img
                        src={thumbnail}
                        alt={item.name}
                        className={styles.resultCardImage}
                        loading="lazy"
                    />
                ) : (
                    <div
                        className={styles.resultCardImagePlaceholder}
                        aria-hidden="true"
                    >
                        {t('aiSearch.chat.noImage', 'Sin imagen')}
                    </div>
                )}

                {typeLabel && (
                    <span
                        className={styles.resultCardTypeBadge}
                        data-testid="ai-search-result-type-badge"
                    >
                        {typeLabel}
                    </span>
                )}

                {hasRating && (
                    <span
                        className={styles.resultCardRatingBadge}
                        role="img"
                        aria-label={`${rating?.toFixed(1)} stars`}
                        data-testid="ai-search-result-rating-badge"
                    >
                        <StarIcon
                            size={12}
                            weight="fill"
                            color="currentColor"
                            aria-hidden="true"
                        />
                        {rating?.toFixed(1)}
                    </span>
                )}
            </div>

            <div className={styles.resultCardBody}>
                <h3 className={styles.resultCardName}>{item.name}</h3>
                {cityName && <p className={styles.resultCardCity}>{cityName}</p>}

                {formattedPrice ? (
                    <p className={styles.resultCardPrice}>
                        <span className={styles.resultCardPriceSub}>
                            {t('aiSearch.chat.priceFrom', 'Desde')}
                        </span>{' '}
                        {formattedPrice}
                        <span className={styles.resultCardPriceSub}>
                            {t('aiSearch.chat.pricePerNight', '/ noche')}
                        </span>
                    </p>
                ) : (
                    <p className={styles.resultCardPrice}>
                        {t('aiSearch.chat.priceConsult', 'Consultar precio')}
                    </p>
                )}
            </div>
        </a>
    );
}
