import { LocationIcon, MapIcon } from '@repo/icons';
import type { JSX } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import type { SupportedLocale } from '../../lib/i18n';

/**
 * Represents a marker on the map
 */
export interface MapMarker {
    /**
     * Unique identifier for the marker
     */
    readonly id: string;

    /**
     * Latitude coordinate
     */
    readonly lat: number;

    /**
     * Longitude coordinate
     */
    readonly lng: number;

    /**
     * Title displayed for the marker
     */
    readonly title: string;

    /**
     * Optional popup content for the marker
     */
    readonly popup?: string;
}

/**
 * Props for the MapView component
 */
export interface MapViewProps {
    /**
     * Array of markers to display on the map
     */
    readonly markers: ReadonlyArray<MapMarker>;

    /**
     * Center coordinates of the map [latitude, longitude]
     * @default [0, 0]
     */
    readonly center?: readonly [number, number];

    /**
     * Initial zoom level
     * @default 13
     */
    readonly zoom?: number;

    /**
     * CSS height of the map container
     * @default '400px'
     */
    readonly height?: string;

    /**
     * Additional CSS classes to apply to the component
     */
    readonly className?: string;

    /**
     * Locale for i18n translations
     * @default 'es'
     */
    readonly locale?: SupportedLocale;
}

/**
 * MapView component
 *
 * PLACEHOLDER IMPLEMENTATION: This component currently renders a placeholder map
 * that displays markers as a list. It is designed to be replaced with a full
 * Leaflet integration (react-leaflet) in the future.
 *
 * The interface and props are production-ready. When Leaflet is integrated,
 * the component implementation can be swapped while maintaining the same API.
 *
 * Future integration will use:
 * - react-leaflet for the map component
 * - leaflet for the underlying map library
 * - OpenStreetMap tiles or similar tile provider
 *
 * @param props - Component props
 * @returns React component
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
            {/* Placeholder Map Container */}
            <div
                className="relative overflow-hidden rounded-lg border border-border bg-gradient-to-br from-surface-alt to-surface-elevated"
                style={{ height }}
                role="img"
                aria-label={t('accessibility.mapShowingLocations', undefined, {
                    count: markers.length
                })}
            >
                {/* Map Loading Indicator */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-text-secondary">
                    {/* Map Icon */}
                    <MapIcon
                        size={48}
                        weight="duotone"
                        className="opacity-40"
                        aria-hidden="true"
                    />
                    <span className="font-medium text-sm">{t('map.loading')}</span>
                    <span className="text-text-tertiary text-xs">
                        Center: {center[0].toFixed(4)}, {center[1].toFixed(4)} | Zoom: {zoom}
                    </span>
                </div>

                {/* Decorative Grid Pattern */}
                <div
                    className="absolute inset-0 opacity-10 [background-image:linear-gradient(var(--color-border)_1px,transparent_1px),linear-gradient(90deg,var(--color-border)_1px,transparent_1px)] [background-size:20px_20px]"
                    aria-hidden="true"
                />
            </div>

            {/* Marker List (Placeholder) */}
            {markers.length > 0 && (
                <section
                    className="mt-4 rounded-lg border border-border bg-surface p-4"
                    aria-label={t('accessibility.mapMarkers')}
                >
                    <h3 className="mb-3 font-semibold text-sm text-text">
                        {t('map.locationsTitle', undefined, { count: markers.length })}
                    </h3>
                    <ul className="space-y-2">
                        {markers.map((marker) => (
                            <li
                                key={marker.id}
                                className="flex items-start gap-2 rounded border border-border bg-surface-alt p-3 text-sm transition-colors hover:bg-surface-elevated"
                            >
                                {/* Marker Icon */}
                                <LocationIcon
                                    size={20}
                                    weight="fill"
                                    className="mt-0.5 flex-shrink-0 text-primary"
                                    aria-hidden="true"
                                />

                                <div className="flex-1">
                                    <div className="font-medium text-text">{marker.title}</div>
                                    <div className="mt-0.5 text-text-tertiary text-xs">
                                        {marker.lat.toFixed(4)}, {marker.lng.toFixed(4)}
                                    </div>
                                    {marker.popup && (
                                        <div className="mt-1 text-text-secondary text-xs">
                                            {marker.popup}
                                        </div>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {/* Empty State */}
            {markers.length === 0 && (
                <div className="mt-4 rounded-lg border border-border bg-surface-alt p-6 text-center">
                    <LocationIcon
                        size={32}
                        weight="duotone"
                        className="mx-auto text-text-tertiary"
                        aria-hidden="true"
                    />
                    <p className="mt-2 text-sm text-text-secondary">{t('map.noLocations')}</p>
                </div>
            )}
        </div>
    );
}
