/**
 * @file GastronomyCard.tsx
 * List card for a gastronomy listing (SPEC-239 T-059).
 *
 * Displays: name, type badge, owner display name, lifecycle status badge,
 * last-modified date.  Used in grid-view layouts where the DataTable is
 * replaced by a card grid.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-wrapped/Card';
import { Badge } from '@/components/ui/badge';
import { GastronomyTypeEnum, PriceRangeEnum } from '@repo/schemas';
import { Link } from '@tanstack/react-router';
import * as React from 'react';
import type { GastronomyListItem } from '../config/gastronomy.config';

// ---------------------------------------------------------------------------
// Label helpers
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<GastronomyTypeEnum, string> = {
    [GastronomyTypeEnum.RESTAURANT]: 'Restaurante',
    [GastronomyTypeEnum.BAR]: 'Bar',
    [GastronomyTypeEnum.CAFE]: 'Café',
    [GastronomyTypeEnum.PARRILLA]: 'Parrilla',
    [GastronomyTypeEnum.CERVECERIA]: 'Cervecería',
    [GastronomyTypeEnum.HELADERIA]: 'Heladería',
    [GastronomyTypeEnum.PANADERIA]: 'Panadería',
    [GastronomyTypeEnum.ROTISERIA]: 'Rotisería',
    [GastronomyTypeEnum.FOOD_TRUCK]: 'Food Truck'
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

/** Props accepted by {@link GastronomyCard}. */
export interface GastronomyCardProps {
    /** Gastronomy list item data. */
    readonly gastronomy: GastronomyListItem;
    /** Called when the card is clicked (optional supplement to the link). */
    readonly onSelect?: (id: string) => void;
}

/**
 * Card component for a gastronomy listing.
 *
 * Renders inside a grid layout on the list page.  Navigates to the view route
 * on click via `<Link>`.
 */
export const GastronomyCard = React.memo(function GastronomyCardComponent({
    gastronomy,
    onSelect
}: GastronomyCardProps) {
    const typeLabel = gastronomy.type
        ? (TYPE_LABELS[gastronomy.type as GastronomyTypeEnum] ?? gastronomy.type)
        : null;

    const priceLabel = gastronomy.priceRange
        ? (PRICE_LABELS[gastronomy.priceRange as PriceRangeEnum] ?? gastronomy.priceRange)
        : null;

    const formattedDate = gastronomy.createdAt
        ? new Date(gastronomy.createdAt).toLocaleDateString('es-AR', {
              day: '2-digit',
              month: 'short',
              year: 'numeric'
          })
        : null;

    const handleClick = React.useCallback(() => {
        onSelect?.(gastronomy.id);
    }, [gastronomy.id, onSelect]);

    return (
        <Link
            to="/gastronomies/$id"
            params={{ id: gastronomy.id }}
            onClick={handleClick}
            className="block h-full rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Ver gastronomía: ${gastronomy.name}`}
        >
            <Card
                hoverable
                clickable
                className="h-full"
            >
                <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                        <CardTitle className="line-clamp-2 text-base">{gastronomy.name}</CardTitle>
                        {gastronomy.isFeatured && (
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
                    {/* Status */}
                    {gastronomy.lifecycleStatus && (
                        <div className="flex items-center gap-1">
                            <span className="font-medium text-foreground">Estado:</span>
                            <span>{gastronomy.lifecycleStatus}</span>
                        </div>
                    )}

                    {/* Owner */}
                    {gastronomy.ownerId && (
                        <div className="flex items-center gap-1">
                            <span className="font-medium text-foreground">Propietario:</span>
                            <span className="truncate">{gastronomy.ownerId}</span>
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

GastronomyCard.displayName = 'GastronomyCard';
