/**
 * Render helpers for the HOST card J market-comparison meta lines.
 *
 * Kept in a dedicated `.tsx` module so the parent `host.ts` (a plain `.ts`
 * file consumed via a side-effect import in the registry barrel) can stay
 * JSX-free while still emitting icon-rich React nodes inside `ListItem.metaLines`.
 *
 * @module dashboard-sources/host-market-comparison-meta
 */

import {
    MapIcon,
    MinusIcon,
    PriceIcon,
    StarIcon,
    TrendingDownIcon,
    TrendingUpIcon
} from '@repo/icons';
import type { ReactNode } from 'react';

/**
 * One row of the market-comparison dataset returned by the host endpoint.
 * Duplicated here verbatim so this module has no dependency on the
 * resolver file.
 */
export interface MarketComparisonRow {
    readonly destinationName: string | null;
    readonly accommodationType?: string;
    readonly yourRating: number | null;
    readonly yourReviews: number;
    readonly destinationAvgRating: number | null;
    readonly destinationReviewsTotal: number;
    readonly yourPrice: number | null;
    readonly destinationAvgPrice: number | null;
}

/**
 * A keyed meta-line entry consumed by `ListItem.metaLines`. The `key` is a
 * stable string per line semantic ("destination" / "rating" / "price") so
 * React reconciliation does not depend on array index ordering.
 */
export interface MarketComparisonMetaLine {
    readonly key: string;
    readonly content: ReactNode;
}

/**
 * Inline signed-delta indicator used by the rating + price comparison
 * meta lines. Up arrow + green when better, down arrow + rose when worse,
 * neutral muted minus when within a hair of zero.
 */
function DeltaIndicator({
    delta,
    suffix = ''
}: {
    readonly delta: number;
    readonly suffix?: string;
}) {
    if (Math.abs(delta) < 0.001) {
        return (
            <span className="inline-flex items-center gap-0.5 text-muted-foreground">
                <MinusIcon className="size-3" />0{suffix}
            </span>
        );
    }
    if (delta > 0) {
        return (
            <span className="inline-flex items-center gap-0.5 text-green-600">
                <TrendingUpIcon className="size-3" />+{delta.toFixed(1)}
                {suffix}
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-0.5 text-rose-600">
            <TrendingDownIcon className="size-3" />
            {delta.toFixed(1)}
            {suffix}
        </span>
    );
}

/** Formats an integer as ARS pesos: `$ 1.234`. Returns "—" for null. */
function formatPriceArs(value: number | null): string {
    if (value === null) return '—';
    return `$ ${Math.round(value).toLocaleString('es-AR')}`;
}

/**
 * Builds the three meta lines a single accommodation row shows on card J.
 *
 *   key=destination → destination + total review volume in the destination.
 *   key=rating      → rating comparison: you vs avg + signed delta arrow.
 *   key=price       → price comparison:  you vs avg + percent delta arrow.
 *
 * Lines whose underlying signal is missing are skipped so a row never
 * renders a blank line.
 */
export function buildMarketComparisonMetaLines(
    row: MarketComparisonRow
): MarketComparisonMetaLine[] {
    const lines: MarketComparisonMetaLine[] = [];

    // Line 1 — destination context.
    const destinationName = row.destinationName ?? 'Sin destino';
    lines.push({
        key: 'destination',
        content: (
            <span className="inline-flex items-center gap-1.5">
                <MapIcon
                    className="size-3.5 shrink-0 text-muted-foreground/70"
                    weight="duotone"
                />
                <span className="truncate">
                    {destinationName}
                    {row.destinationReviewsTotal > 0 ? (
                        <span className="opacity-70">
                            {' · '}
                            {row.destinationReviewsTotal} reseñas en el destino
                        </span>
                    ) : null}
                </span>
            </span>
        )
    });

    // Line 2 — rating comparison.
    if (row.yourRating !== null && row.destinationAvgRating !== null) {
        const delta = row.yourRating - row.destinationAvgRating;
        lines.push({
            key: 'rating',
            content: (
                <span className="inline-flex items-center gap-1.5">
                    <StarIcon
                        className="size-3.5 shrink-0 text-amber-500"
                        weight="fill"
                    />
                    <span className="truncate">
                        <span className="opacity-70">Tu rating </span>
                        <span className="font-medium text-foreground">
                            {row.yourRating.toFixed(1)}
                        </span>
                        {row.yourReviews > 0 ? (
                            <span className="opacity-70"> ({row.yourReviews})</span>
                        ) : null}
                        <span className="opacity-70"> · Promedio del destino </span>
                        <span className="font-medium text-foreground/80">
                            {row.destinationAvgRating.toFixed(1)}
                        </span>
                        <span className="opacity-70"> · </span>
                        <DeltaIndicator delta={delta} />
                    </span>
                </span>
            )
        });
    } else if (row.yourRating !== null) {
        lines.push({
            key: 'rating',
            content: (
                <span className="inline-flex items-center gap-1.5">
                    <StarIcon
                        className="size-3.5 shrink-0 text-amber-500"
                        weight="fill"
                    />
                    <span className="truncate">
                        <span className="opacity-70">Tu rating </span>
                        <span className="font-medium text-foreground">
                            {row.yourRating.toFixed(1)}
                        </span>
                        {row.yourReviews > 0 ? (
                            <span className="opacity-70"> ({row.yourReviews})</span>
                        ) : null}
                        <span className="opacity-70">
                            {' · '}Sin promedio del destino para comparar
                        </span>
                    </span>
                </span>
            )
        });
    } else if (row.destinationAvgRating !== null) {
        lines.push({
            key: 'rating',
            content: (
                <span className="inline-flex items-center gap-1.5">
                    <StarIcon
                        className="size-3.5 shrink-0 text-amber-500"
                        weight="fill"
                    />
                    <span className="truncate">
                        <span className="opacity-70">Promedio del destino </span>
                        <span className="font-medium text-foreground/80">
                            {row.destinationAvgRating.toFixed(1)}
                        </span>
                        <span className="opacity-70">
                            {' · '}Tu alojamiento aún no tiene reseñas
                        </span>
                    </span>
                </span>
            )
        });
    } else {
        lines.push({
            key: 'rating',
            content: (
                <span className="inline-flex items-center gap-1.5 opacity-70">
                    <StarIcon className="size-3.5 shrink-0" /> Sin reseñas en este destino todavía
                </span>
            )
        });
    }

    // Line 3 — price comparison.
    if (row.yourPrice !== null && row.destinationAvgPrice !== null && row.destinationAvgPrice > 0) {
        const pctDelta =
            ((row.yourPrice - row.destinationAvgPrice) / row.destinationAvgPrice) * 100;
        lines.push({
            key: 'price',
            content: (
                <span className="inline-flex items-center gap-1.5">
                    <PriceIcon
                        className="size-3.5 shrink-0 text-emerald-600"
                        weight="duotone"
                    />
                    <span className="truncate">
                        <span className="opacity-70">Tu precio </span>
                        <span className="font-medium text-foreground">
                            {formatPriceArs(row.yourPrice)}
                        </span>
                        <span className="opacity-70">
                            {' · '}Promedio del mismo tipo en el destino{' '}
                        </span>
                        <span className="font-medium text-foreground/80">
                            {formatPriceArs(row.destinationAvgPrice)}
                        </span>
                        <span className="opacity-70"> · </span>
                        <DeltaIndicator
                            delta={pctDelta}
                            suffix="%"
                        />
                    </span>
                </span>
            )
        });
    } else if (row.yourPrice !== null) {
        lines.push({
            key: 'price',
            content: (
                <span className="inline-flex items-center gap-1.5">
                    <PriceIcon
                        className="size-3.5 shrink-0 text-emerald-600"
                        weight="duotone"
                    />
                    <span className="truncate">
                        <span className="opacity-70">Tu precio </span>
                        <span className="font-medium text-foreground">
                            {formatPriceArs(row.yourPrice)}
                        </span>
                        <span className="opacity-70">
                            {' · '}Sin promedio del mismo tipo para comparar
                        </span>
                    </span>
                </span>
            )
        });
    } else if (row.destinationAvgPrice !== null && row.destinationAvgPrice > 0) {
        lines.push({
            key: 'price',
            content: (
                <span className="inline-flex items-center gap-1.5">
                    <PriceIcon
                        className="size-3.5 shrink-0 text-emerald-600"
                        weight="duotone"
                    />
                    <span className="truncate">
                        <span className="opacity-70">Promedio del mismo tipo en el destino </span>
                        <span className="font-medium text-foreground/80">
                            {formatPriceArs(row.destinationAvgPrice)}
                        </span>
                        <span className="opacity-70">
                            {' · '}Tu alojamiento aún no tiene precio cargado
                        </span>
                    </span>
                </span>
            )
        });
    } else {
        lines.push({
            key: 'price',
            content: (
                <span className="inline-flex items-center gap-1.5 opacity-70">
                    <PriceIcon className="size-3.5 shrink-0" /> Sin precios cargados en este destino
                </span>
            )
        });
    }

    return lines;
}
