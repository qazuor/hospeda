/**
 * Client-side destination card for use in React islands.
 * Mirrors the structure of DestinationCard.astro for visual consistency,
 * including attraction badges sorted by displayWeight DESC.
 */

import { LocationIcon, resolveIcon } from '@repo/icons';
import { useTranslation } from '../../hooks/useTranslation';
import type { SupportedLocale } from '../../lib/i18n';

/** Attraction item with displayWeight for sorting. */
export interface DestinationAttraction {
    readonly id: string;
    readonly name: string;
    readonly icon?: string;
    readonly displayWeight?: number;
}

/** Minimal destination shape for rendering cards. */
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
    /** Top attractions ordered by displayWeight DESC from the service layer. */
    readonly attractions?: readonly DestinationAttraction[];
}

/** Localized labels needed for card rendering. */
export interface CardLabels {
    readonly accommodation: string;
    readonly accommodations: string;
    readonly featured: string;
}

/** Props for the DestinationCardClient component. */
export interface DestinationCardClientProps {
    readonly destination: DestinationItem;
    readonly locale: string;
    readonly labels: CardLabels;
}

/** Max number of attraction badges to show. */
const MAX_ATTRACTIONS = 3;

/**
 * Minimal destination card for client-rendered filtered results.
 *
 * Renders a card with the destination image, name, accommodation count,
 * attraction badges (up to {@link MAX_ATTRACTIONS}), and an optional summary.
 * Attractions are sorted by displayWeight DESC before slicing.
 *
 * @param props - {@link DestinationCardClientProps}
 */
export function DestinationCardClient({ destination, locale, labels }: DestinationCardClientProps) {
    const { tPlural } = useTranslation({
        locale: locale as SupportedLocale,
        namespace: 'destinations'
    });

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
    const countLabel = tPlural('featured.card.accommodation', count);

    const sortedAttractions = [...(destination.attractions ?? [])].sort(
        (a, b) => (b.displayWeight ?? 50) - (a.displayWeight ?? 50)
    );
    const visibleAttractions = sortedAttractions.slice(0, MAX_ATTRACTIONS);
    const extraAttractionCount = Math.max(0, sortedAttractions.length - MAX_ATTRACTIONS);

    return (
        <article className="group relative overflow-hidden rounded-lg bg-card shadow-md transition-shadow hover:shadow-lg">
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
                        <span className="rounded-full bg-accent/90 px-2.5 py-0.5 font-medium text-accent-foreground text-xs backdrop-blur-sm">
                            {labels.featured}
                        </span>
                    </div>
                )}
            </a>
            <div className="p-4">
                <h3 className="font-semibold text-lg">
                    <a
                        href={detailUrl}
                        className="text-foreground no-underline hover:text-primary"
                    >
                        {destination.name}
                    </a>
                </h3>
                <p className="mt-1 text-muted-foreground text-sm">{countLabel}</p>
                {visibleAttractions.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        {visibleAttractions.map((attraction) => {
                            const IconComp =
                                (attraction.icon
                                    ? resolveIcon({ iconName: attraction.icon })
                                    : undefined) ?? LocationIcon;
                            return (
                                <span
                                    key={attraction.id}
                                    className="inline-flex items-center justify-center rounded-full bg-primary/10 p-[5px] text-primary transition-colors hover:bg-primary/20"
                                    title={attraction.name}
                                    aria-label={attraction.name}
                                    role="img"
                                >
                                    <IconComp
                                        size={16}
                                        weight="regular"
                                        aria-hidden="true"
                                    />
                                </span>
                            );
                        })}
                        {extraAttractionCount > 0 && (
                            <span className="inline-flex items-center justify-center rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary text-xs">
                                +{extraAttractionCount}
                            </span>
                        )}
                    </div>
                )}
                {summary && (
                    <p className="mt-2 line-clamp-2 text-muted-foreground text-sm">{summary}</p>
                )}
            </div>
        </article>
    );
}
