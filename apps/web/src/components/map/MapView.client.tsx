import type { JSX } from 'react';

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
    className = ''
}: MapViewProps): JSX.Element {
    return (
        <div
            className={`relative ${className}`.trim()}
            data-map-provider="leaflet"
        >
            {/* Placeholder Map Container */}
            <div
                className="relative overflow-hidden rounded-lg border border-gray-300 bg-gradient-to-br from-gray-100 to-gray-200"
                style={{ height }}
                role="img"
                aria-label={`Map showing ${markers.length} location${markers.length !== 1 ? 's' : ''}`}
            >
                {/* Map Loading Indicator */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-600">
                    {/* Map Icon */}
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-12 w-12 opacity-40"
                        aria-hidden="true"
                    >
                        <path d="M3 6l6-3v18l-6 3V6z" />
                        <path d="M9 3l6 3v18l-6-3V3z" />
                        <path d="M15 6l6-3v18l-6 3V6z" />
                    </svg>
                    <span className="font-medium text-sm">Map Loading...</span>
                    <span className="text-gray-500 text-xs">
                        Center: {center[0].toFixed(4)}, {center[1].toFixed(4)} | Zoom: {zoom}
                    </span>
                </div>

                {/* Decorative Grid Pattern */}
                <div
                    className="absolute inset-0 opacity-10"
                    style={{
                        backgroundImage:
                            'linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)',
                        backgroundSize: '20px 20px'
                    }}
                    aria-hidden="true"
                />
            </div>

            {/* Marker List (Placeholder) */}
            {markers.length > 0 && (
                <section
                    className="mt-4 rounded-lg border border-gray-200 bg-white p-4"
                    aria-label="Map markers"
                >
                    <h3 className="mb-3 font-semibold text-gray-900 text-sm">
                        Locations ({markers.length})
                    </h3>
                    <ul className="space-y-2">
                        {markers.map((marker) => (
                            <li
                                key={marker.id}
                                className="flex items-start gap-2 rounded border border-gray-200 bg-gray-50 p-3 text-sm transition-colors hover:bg-gray-100"
                            >
                                {/* Marker Icon */}
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                    className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary"
                                    aria-hidden="true"
                                >
                                    <path
                                        fillRule="evenodd"
                                        d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z"
                                        clipRule="evenodd"
                                    />
                                </svg>

                                <div className="flex-1">
                                    <div className="font-medium text-gray-900">{marker.title}</div>
                                    <div className="mt-0.5 text-gray-500 text-xs">
                                        {marker.lat.toFixed(4)}, {marker.lng.toFixed(4)}
                                    </div>
                                    {marker.popup && (
                                        <div className="mt-1 text-gray-600 text-xs">
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
                <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="mx-auto h-8 w-8 text-gray-400"
                        aria-hidden="true"
                    >
                        <path
                            fillRule="evenodd"
                            d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z"
                            clipRule="evenodd"
                        />
                    </svg>
                    <p className="mt-2 text-gray-600 text-sm">No locations to display</p>
                </div>
            )}
        </div>
    );
}
