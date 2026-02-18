/**
 * Client-side destination card for use in React islands.
 * Mirrors the structure of DestinationCard.astro for visual consistency.
 */

/** Minimal destination shape for rendering cards */
export interface DestinationItem {
    readonly id: string;
    readonly slug: string;
    readonly name: string;
    readonly summary?: string;
    readonly description?: string;
    readonly featuredImage?: string;
    readonly heroImage?: string;
    readonly accommodationsCount?: number;
    readonly isFeatured?: boolean;
    readonly path?: string;
    readonly media?: {
        readonly featuredImage?: { readonly url?: string } | string;
    };
}

/** Localized labels needed for card rendering */
interface CardLabels {
    readonly accommodation: string;
    readonly accommodations: string;
    readonly featured: string;
}

const CARD_LABELS: Record<string, CardLabels> = {
    es: { accommodation: 'alojamiento', accommodations: 'alojamientos', featured: 'Destacado' },
    en: { accommodation: 'accommodation', accommodations: 'accommodations', featured: 'Featured' },
    pt: { accommodation: 'acomodação', accommodations: 'acomodações', featured: 'Destaque' }
};

/** Minimal destination card for client-rendered filtered results. */
export function DestinationCardClient({
    destination,
    locale
}: {
    readonly destination: DestinationItem;
    readonly locale: string;
}) {
    const detailPath = destination.path ?? destination.slug;
    const detailUrl = `/${locale}/destinos/${detailPath}/`;
    const mediaFeatured = destination.media?.featuredImage;
    const mediaUrl = typeof mediaFeatured === 'string' ? mediaFeatured : mediaFeatured?.url;
    const image =
        mediaUrl ??
        destination.featuredImage ??
        destination.heroImage ??
        '/images/placeholder-destination.svg';
    const summary = destination.summary ?? (destination.description as string | undefined) ?? '';
    const count = destination.accommodationsCount ?? 0;
    const t = (CARD_LABELS[locale] ?? CARD_LABELS.es) as CardLabels;
    const countLabel = count === 1 ? t.accommodation : t.accommodations;

    return (
        <article className="group relative overflow-hidden rounded-lg bg-surface shadow-md transition-shadow hover:shadow-lg">
            <a
                href={detailUrl}
                className="relative block aspect-[16/9] overflow-hidden"
            >
                <img
                    src={image}
                    alt={destination.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                />
                {destination.isFeatured && (
                    <div className="absolute top-3 right-3">
                        <span className="rounded-full bg-warning/90 px-2.5 py-0.5 font-medium text-text text-xs backdrop-blur-sm">
                            {t.featured}
                        </span>
                    </div>
                )}
            </a>
            <div className="p-4">
                <h3 className="font-semibold text-lg">
                    <a
                        href={detailUrl}
                        className="text-text no-underline hover:text-primary"
                    >
                        {destination.name}
                    </a>
                </h3>
                <p className="mt-1 text-sm text-text-tertiary">
                    {count} {countLabel}
                </p>
                {summary && (
                    <p className="mt-2 line-clamp-2 text-sm text-text-secondary">{summary}</p>
                )}
            </div>
        </article>
    );
}
