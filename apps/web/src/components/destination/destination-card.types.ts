/**
 * Types and helpers for DestinationCard and related destination components.
 */
import type { SupportedLocale } from '../../lib/i18n';
import { t, tPlural } from '../../lib/i18n';

/** Data shape for destination cards and related components (preview, map) */
export interface DestinationCardData {
    readonly slug: string;
    readonly name: string;
    readonly summary: string;
    readonly featuredImage: string;
    readonly accommodationsCount: number;
    readonly isFeatured: boolean;
    readonly path?: string;
    /** Average rating (0-5). Hidden when 0. */
    readonly averageRating?: number;
    /** Number of reviews. */
    readonly reviewsCount?: number;
    /** Number of events. Hidden when 0. */
    readonly eventsCount?: number;
    /** Top attractions to display as badges. Ordered by displayWeight DESC from the service layer. */
    readonly attractions?: ReadonlyArray<{
        readonly id: string;
        readonly name: string;
        readonly icon?: string;
        readonly displayWeight?: number;
    }>;
    /** Gallery images for hover preview. */
    readonly gallery?: ReadonlyArray<{ readonly url: string; readonly caption?: string }>;
    /** Geographic coordinates for mini-map. */
    readonly coordinates?: { readonly lat: string; readonly long: string };
    /** Rating dimensions (landscape, gastronomy, etc.) for hover preview. */
    readonly ratingDimensions?: Readonly<Record<string, number>>;
}

/** Pre-computed i18n text for card rendering */
export interface CardComputedText {
    readonly detailUrl: string;
    readonly accText: string;
    readonly evtCount: number;
    readonly evtText: string;
    readonly featuredLabel: string;
}

/** Compute all i18n text for a destination card */
export function computeCardText({
    destination,
    locale
}: {
    destination: DestinationCardData;
    locale: SupportedLocale;
}): CardComputedText {
    const detailPath = destination.path ?? destination.slug;
    const detailUrl = `/${locale}/destinos/${detailPath}/`;

    const accCount = destination.accommodationsCount;
    const accText = tPlural({
        locale,
        namespace: 'destinations',
        key: 'featured.card.accommodation',
        count: accCount
    });

    const evtCount = destination.eventsCount ?? 0;
    const evtText = tPlural({
        locale,
        namespace: 'destinations',
        key: 'featured.card.event',
        count: evtCount
    });

    const featuredLabel = t({
        locale,
        namespace: 'destinations',
        key: 'featured.card.featured',
        fallback: 'Destacado'
    });

    return { detailUrl, accText, evtCount, evtText, featuredLabel };
}
