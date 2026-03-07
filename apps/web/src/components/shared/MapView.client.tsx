/**
 * @file MapView.client.tsx
 * @description Placeholder map component with production-ready API surface.
 *
 * PLACEHOLDER IMPLEMENTATION: Renders markers as an accessible list instead of
 * a real map. Designed to be replaced with a full Leaflet/react-leaflet
 * integration in the future without changing the public API.
 *
 * Future integration will use:
 * - react-leaflet for the map component
 * - leaflet for the underlying map library
 * - OpenStreetMap tiles or similar tile provider
 */

import { LocationIcon, MapIcon } from '@repo/icons';
import type { JSX } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import type { SupportedLocale } from '../../lib/i18n';

/**
 * Represents a single marker to be displayed on the map.
 */
export interface MapMarker {
    /**
     * Unique identifier for the marker.
     */
    readonly id: string;

    /**
     * Latitude coordinate.
     */
    readonly lat: number;

    /**
     * Longitude coordinate.
     */
    readonly lng: number;

    /**
     * Title displayed for the marker.
     */
    readonly title: string;

    /**
     * Optional popup content shown when the marker is selected.
     */
    readonly popup?: string;
}

/**
 * Props for the MapView component.
 */
export interface MapViewProps {
    /**
     * Array of markers to display on the map.
     */
    readonly markers: ReadonlyArray<MapMarker>;

    /**
     * Center coordinates of the map as [latitude, longitude].
     * @default [0, 0]
     */
    readonly center?: readonly [number, number];

    /**
     * Initial zoom level.
     * @default 13
     */
    readonly zoom?: number;

    /**
     * CSS height of the map container.
     * @default '400px'
     */
    readonly height?: string;

    /**
     * Additional CSS classes applied to the outermost wrapper element.
     */
    readonly className?: string;

    /**
     * Locale used for i18n translations.
     * @default 'es'
     */
    readonly locale?: SupportedLocale;
}

/**
 * Placeholder map component with a production-ready API.
 *
 * Renders a styled placeholder container and an accessible list of markers.
 * When Leaflet is integrated, the internals can be swapped while keeping
 * the same `MapViewProps` interface.
 *
 * @param props - Component props defined by {@link MapViewProps}.
 * @returns A React element containing the placeholder map and marker list.
 *
 * @example
 * ```tsx
 * <MapView
 *   markers={[
 *     { id: '1', lat: -32.4833, lng: -58.2333, title: 'Hotel Example' },
 *     { id: '2', lat: -32.4900, lng: -58.2400, title: 'Cabaña Example', popup: 'Beautiful cabin' }
 *   ]}
 *   center={[-32.4833, -58.2333]}
 *   zoom={13}
 *   height="500px"
 *   locale="es"
 * />
 * ```
 */
export function MapView({
    markers,
    center = [0, 0],
    zoom = 13,
    height = '400px',
    className = '',
    locale = 'es'
}: MapViewProps): JSX.Element {
    const { t } = useTranslation({ locale, namespace: 'ui' });

    return (
        <div
            className={`relative ${className}`.trim()}
            data-map-provider="leaflet"
        >
            {/* Placeholder map container */}
            <div
                className="relative overflow-hidden rounded-lg border border-border bg-gradient-to-br from-muted to-muted/50"
                style={{ height }}
                role="img"
                aria-label={t('accessibility.mapShowingLocations', undefined, {
                    count: markers.length
                })}
            >
                {/* Centered placeholder icon and metadata */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <MapIcon
                        size={48}
                        weight="duotone"
                        className="opacity-40"
                        aria-hidden="true"
                    />
                    <span className="font-medium text-sm">{t('map.loading')}</span>
                    <span className="text-muted-foreground/70 text-xs">
                        Center: {center[0].toFixed(4)}, {center[1].toFixed(4)} | Zoom: {zoom}
                    </span>
                </div>

                {/* Decorative grid overlay */}
                <div
                    className="absolute inset-0 opacity-10 [background-image:linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [background-size:20px_20px]"
                    aria-hidden="true"
                />
            </div>

            {/* Marker list — shown when at least one marker is present */}
            {markers.length > 0 && (
                <section
                    className="mt-4 rounded-lg border border-border bg-card p-4"
                    aria-label={t('accessibility.mapMarkers')}
                >
                    <h3 className="mb-3 font-semibold text-foreground text-sm">
                        {t('map.locationsTitle', undefined, { count: markers.length })}
                    </h3>
                    <ul className="space-y-2">
                        {markers.map((marker) => (
                            <li
                                key={marker.id}
                                className="flex items-start gap-2 rounded border border-border bg-muted p-3 text-sm transition-colors hover:bg-muted/60"
                            >
                                <LocationIcon
                                    size={20}
                                    weight="fill"
                                    className="mt-0.5 flex-shrink-0 text-primary"
                                    aria-hidden="true"
                                />
                                <div className="flex-1">
                                    <div className="font-medium text-foreground">
                                        {marker.title}
                                    </div>
                                    <div className="mt-0.5 text-muted-foreground text-xs">
                                        {marker.lat.toFixed(4)}, {marker.lng.toFixed(4)}
                                    </div>
                                    {marker.popup && (
                                        <div className="mt-1 text-muted-foreground text-xs">
                                            {marker.popup}
                                        </div>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {/* Empty state — shown when no markers are provided */}
            {markers.length === 0 && (
                <div className="mt-4 rounded-lg border border-border bg-muted p-6 text-center">
                    <LocationIcon
                        size={32}
                        weight="duotone"
                        className="mx-auto text-muted-foreground"
                        aria-hidden="true"
                    />
                    <p className="mt-2 text-muted-foreground text-sm">{t('map.noLocations')}</p>
                </div>
            )}
        </div>
    );
}
