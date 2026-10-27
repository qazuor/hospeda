/**
 * @file VenueCard.tsx
 * List card for a gastronomy listing (SPEC-239 T-059).
 *
 * Displays: name, type badge, owner display name, publication status,
 * last-modified date.  Used in grid-view layouts where the DataTable is
 * replaced by a card grid.
 */

import { PriceRangeEnum, VenueTypeEnum } from '@repo/schemas';
import { Link } from '@tanstack/react-router';
import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-wrapped/Card';
import type { VenueListItem } from '../config/venue.config';

// ---------------------------------------------------------------------------
// Label helpers
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<VenueTypeEnum, string> = {
    [VenueTypeEnum.RESTAURANT]: 'Restaurante',
    [VenueTypeEnum.BAR]: 'Bar',
    [VenueTypeEnum.CAFE]: 'Café',
    [VenueTypeEnum.PARRILLA]: 'Parrilla',
    [VenueTypeEnum.CERVECERIA]: 'Cervecería',
    [VenueTypeEnum.HELADERIA]: 'Heladería',
    [VenueTypeEnum.PANADERIA]: 'Panadería',
    [VenueTypeEnum.ROTISERIA]: 'Rotisería',
    [VenueTypeEnum.FOOD_TRUCK]: 'Food Truck'
};

const PRICE_LABELS: Record<PriceRangeEnum, string> = {
    [PriceRangeEnum.BUDGET]: '$',
    [PriceRangeEnum.MID]: '$$',
    [PriceRangeEnum.HIGH]: '$$$',
    [PriceRangeEnum.PREMIUM]: '$$$$'
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Props accepted by {@link VenueCard}. */
export interface VenueCardProps {
    /** Gastronomy list item data. */
    readonly venue: VenueListItem;
    /** Called when the card is clicked (optional supplement to the link). */
    readonly onSelect?: (id: string) => void;
}

/**
 * Card component for a gastronomy listing.
 *
 * Renders inside a grid layout on the list page.  Navigates to the view route
 * on click via `<Link>`.
 */
export const VenueCard = React.memo(function VenueCardComponent({
    venue,
    onSelect
}: VenueCardProps) {
    const typeLabel = venue.type ? (TYPE_LABELS[venue.type as VenueTypeEnum] ?? venue.type) : null;

    const priceLabel = venue.priceRange
        ? (PRICE_LABELS[venue.priceRange as PriceRangeEnum] ?? venue.priceRange)
        : null;

    const formattedDate = venue.createdAt
        ? new Date(venue.createdAt).toLocaleDateString('es-AR', {
              day: '2-digit',
              month: 'short',
              year: 'numeric'
          })
        : null;

    const handleClick = React.useCallback(() => {
        onSelect?.(venue.id);
    }, [venue.id, onSelect]);

    return (
        <Link
            to="/venues/$id"
            params={{ id: venue.id }}
            onClick={handleClick}
            className="block h-full rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Ver gastronomía: ${venue.name}`}
        >
            <Card
                hoverable
                clickable
                className="h-full"
            >
                <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                        <CardTitle className="line-clamp-2 text-base">{venue.name}</CardTitle>
                        {venue.featuredByEntitlement && (
                            <Badge
                                variant="secondary"
                                className="shrink-0 text-xs"
                            >
                                Destacado
                            </Badge>
                        )}
                    </div>

                    {/* Type + price row */}
                    <div className="mt-1 flex flex-wrap gap-1">
                        {typeLabel && (
                            <Badge
                                variant="outline"
                                className="text-xs"
                            >
                                {typeLabel}
                            </Badge>
                        )}
                        {priceLabel && (
                            <Badge
                                variant="outline"
                                className="text-muted-foreground text-xs"
                            >
                                {priceLabel}
                            </Badge>
                        )}
                    </div>
                </CardHeader>

                <CardContent className="space-y-2 pt-0 text-muted-foreground text-sm">
                    {/* Publication state (HOS-1641) */}
                    {venue.publicationStatus && (
                        <div className="flex items-center gap-1">
                            <span className="font-medium text-foreground">Estado:</span>
                            <span>{venue.publicationStatus}</span>
                        </div>
                    )}

                    {/* Owner */}
                    {venue.ownerId && (
                        <div className="flex items-center gap-1">
                            <span className="font-medium text-foreground">Propietario:</span>
                            <span className="truncate">{venue.ownerId}</span>
                        </div>
                    )}

                    {/* Last modified */}
                    {formattedDate && (
                        <div className="flex items-center gap-1">
                            <span className="font-medium text-foreground">Creado:</span>
                            <span>{formattedDate}</span>
                        </div>
                    )}
                </CardContent>
            </Card>
        </Link>
    );
});

VenueCard.displayName = 'VenueCard';
