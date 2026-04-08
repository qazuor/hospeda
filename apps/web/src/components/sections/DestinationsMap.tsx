/**
 * @file DestinationsMap.tsx
 * @description Interactive SVG map of Entre Ríos showing the Río Uruguay coast.
 *
 * Renders two SVG background layers (river + routes) with absolutely-positioned
 * city pins. ALL city pins are clickable and sync the active destination index
 * with the parent carousel. Bridge markers are decorative only.
 *
 * This is a pure React component (no `client:*` directive needed — it lives
 * inside the DestinationsIsland which is already a React island).
 */

import type { DestinationCardData } from '@/data/types';
import { cn } from '@/lib/cn';
import styles from './DestinationsMap.module.css';

// ---------------------------------------------------------------------------
// Pin data (from Figma analysis — coordinates in the 616×793 space)
// ---------------------------------------------------------------------------

/**
 * Unified city pin descriptor.
 *
 * - `size: 'main'` — primary tourist cities: 12px dot, 14px semibold label
 * - `size: 'secondary'` — smaller cities: 8px dot, 13px regular label
 *
 * All cities are clickable when a matching destination exists in the data.
 */
interface City {
    readonly slug: string;
    readonly name: string;
    readonly x: number;
    readonly y: number;
    readonly size: 'main' | 'secondary';
    readonly labelPosition?: 'left' | 'right' | 'top' | 'bottom';
}

interface Bridge {
    readonly name: string;
    readonly subtitle: string;
    readonly x: number;
    readonly y: number;
}

const CITIES: readonly City[] = [
    // ---- Main cities (primary tourist destinations, north → south) ----
    {
        slug: 'federacion',
        name: 'Federación',
        x: 450,
        y: 105,
        size: 'main',
        labelPosition: 'right'
    },
    { slug: 'concordia', name: 'Concordia', x: 360, y: 190, size: 'main', labelPosition: 'left' },
    { slug: 'colon', name: 'Colón', x: 355, y: 380, size: 'main', labelPosition: 'left' },
    { slug: 'san-jose', name: 'San José', x: 400, y: 360, size: 'main', labelPosition: 'right' },
    {
        slug: 'concepcion-del-uruguay',
        name: 'Concepción\ndel Uruguay',
        x: 405,
        y: 430,
        size: 'main',
        labelPosition: 'right'
    },
    {
        slug: 'gualeguaychu',
        name: 'Gualeguaychú',
        x: 366,
        y: 542,
        size: 'main',
        labelPosition: 'right'
    },

    // ---- Secondary cities (all clickable when destination data present) ----
    { slug: 'chajari', name: 'Chajarí', x: 427, y: 54, size: 'secondary', labelPosition: 'right' },
    {
        slug: 'santa-ana',
        name: 'Santa Ana',
        x: 376,
        y: 78,
        size: 'secondary',
        labelPosition: 'left'
    },
    {
        slug: 'san-salvador',
        name: 'San Salvador',
        x: 272,
        y: 241,
        size: 'secondary',
        labelPosition: 'left'
    },
    { slug: 'ubajay', name: 'Ubajay', x: 320, y: 275, size: 'secondary', labelPosition: 'left' },
    {
        slug: 'villaguay',
        name: 'Villaguay',
        x: 252,
        y: 293,
        size: 'secondary',
        labelPosition: 'right'
    },
    {
        slug: 'villa-elisa',
        name: 'Villa Elisa',
        x: 270,
        y: 336,
        size: 'secondary',
        labelPosition: 'left'
    },
    { slug: 'liebig', name: 'Liebig', x: 351, y: 337, size: 'secondary', labelPosition: 'left' },
    {
        slug: 'rosario-del-tala',
        name: 'Rosario del Tala',
        x: 230,
        y: 400,
        size: 'secondary',
        labelPosition: 'right'
    },
    {
        slug: 'san-justo',
        name: 'San Justo',
        x: 327,
        y: 439,
        size: 'secondary',
        labelPosition: 'bottom'
    },
    { slug: 'caseros', name: 'Caseros', x: 285, y: 423, size: 'secondary', labelPosition: 'left' },
    {
        slug: 'urdinarrain',
        name: 'Urdinarrain',
        x: 216,
        y: 472,
        size: 'secondary',
        labelPosition: 'left'
    },
    { slug: 'larroque', name: 'Larroque', x: 229, y: 539, size: 'secondary', labelPosition: 'top' },
    {
        slug: 'gualeguay',
        name: 'Gualeguay',
        x: 215,
        y: 578,
        size: 'secondary',
        labelPosition: 'right'
    },
    { slug: 'ceibas', name: 'Ceibas', x: 235, y: 653, size: 'secondary', labelPosition: 'left' },
    { slug: 'ibicuy', name: 'Ibicuy', x: 180, y: 755, size: 'secondary', labelPosition: 'left' },
    {
        slug: 'villa-paranacito',
        name: 'Villa Paranacito',
        x: 325,
        y: 740,
        size: 'secondary',
        labelPosition: 'right'
    }
] as const;

const BRIDGES: readonly Bridge[] = [
    { name: 'Pte. Salto Grande', subtitle: 'Concordia → Salto', x: 470, y: 203 },
    { name: 'Pte. Gral. Artigas', subtitle: 'Colón → Paysandú', x: 457, y: 390 },
    { name: 'Pte. Libertador San Martín', subtitle: 'Gualeguaychú → Fray Bentos', x: 443, y: 592 }
] as const;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/** Props for the DestinationsMap component. */
interface DestinationsMapProps {
    /** Index of the currently active destination in the destinations array. */
    readonly activeIndex: number;
    /** Callback invoked when a city pin is clicked and a matching destination exists. */
    readonly onSelectDestination: (index: number) => void;
    /** The list of destination cards. Slugs must match `City.slug` values above. */
    readonly destinations: readonly DestinationCardData[];
    /** Accessible label for the map container. */
    readonly mapLabel?: string;
    /** Formatter for individual pin aria-labels. Receives city name. */
    readonly pinLabel?: (name: string) => string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Converts a pixel coordinate from the 616×793 design space to a percentage.
 * This allows the map to scale to any container size.
 */
function toPercent(value: number, max: number): string {
    return `${((value / max) * 100).toFixed(3)}%`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Interactive map of the Entre Ríos Río Uruguay coast.
 *
 * All city pins (main and secondary) are clickable when a destination with
 * a matching slug is present in the `destinations` prop. If no matching
 * destination exists, the pin renders as decorative (non-interactive).
 * Bridge markers are always decorative.
 *
 * @param props - {@link DestinationsMapProps}
 */
export function DestinationsMap({
    activeIndex,
    onSelectDestination,
    destinations,
    mapLabel,
    pinLabel
}: DestinationsMapProps) {
    /**
     * Finds the destination index matching a given city slug.
     * Returns -1 if no destination matches (city is on map but not in data).
     */
    const findDestinationIndex = (slug: string): number =>
        destinations.findIndex((d) => d.slug === slug);

    return (
        <div
            className={styles.mapContainer}
            role="img"
            aria-label={mapLabel ?? 'Interactive map of destinations in Entre Ríos, Argentina'}
        >
            {/* Background: river SVG */}
            <img
                src="/assets/images/destination/rio.svg"
                alt=""
                aria-hidden="true"
                className={styles.bgLayer}
                draggable={false}
            />

            {/* Background: routes SVG */}
            <img
                src="/assets/images/destination/rutas.svg"
                alt=""
                aria-hidden="true"
                className={styles.bgLayerRoutes}
                draggable={false}
            />

            {/* Pins layer */}
            <div
                className={styles.pinsLayer}
                aria-hidden="false"
            >
                {/* Bridge markers — decorative, always non-interactive */}
                {BRIDGES.map((bridge) => (
                    <div
                        key={bridge.name}
                        className={styles.pinWrapper}
                        style={{
                            left: toPercent(bridge.x, 616),
                            top: toPercent(bridge.y, 793)
                        }}
                    >
                        <div className={styles.bridgeMarker}>
                            <span
                                className={styles.bridgeIcon}
                                aria-hidden="true"
                            >
                                🌉
                            </span>
                            <div className={styles.bridgeLabels}>
                                <span className={styles.bridgeName}>{bridge.name}</span>
                                <span className={styles.bridgeSubtitle}>{bridge.subtitle}</span>
                            </div>
                        </div>
                    </div>
                ))}

                {/* All city pins — clickable when a matching destination exists */}
                {CITIES.map((city) => {
                    const destIndex = findDestinationIndex(city.slug);
                    const isActive = destIndex !== -1 && destIndex === activeIndex;
                    const isClickable = destIndex !== -1;
                    const isMain = city.size === 'main';

                    return (
                        <div
                            key={city.slug}
                            className={styles.pinWrapper}
                            style={{
                                left: toPercent(city.x, 616),
                                top: toPercent(city.y, 793)
                            }}
                        >
                            <button
                                type="button"
                                className={cn(
                                    isMain ? styles.mainPin : styles.secondaryPin,
                                    city.labelPosition === 'left' &&
                                        (isMain ? styles.pinLabelLeft : styles.secondaryPinLeft),
                                    city.labelPosition === 'right' &&
                                        (isMain ? styles.pinLabelRight : styles.secondaryPinRight),
                                    city.labelPosition === 'top' &&
                                        (isMain ? styles.pinLabelTop : styles.secondaryPinTop),
                                    city.labelPosition === 'bottom' &&
                                        (isMain ? styles.pinLabelBottom : styles.secondaryPinBottom)
                                )}
                                onClick={() => {
                                    if (isClickable) {
                                        onSelectDestination(destIndex);
                                    }
                                }}
                                aria-pressed={isActive}
                                aria-label={
                                    pinLabel
                                        ? pinLabel(city.name.replace('\n', ' '))
                                        : `View destination ${city.name.replace('\n', ' ')}`
                                }
                                style={
                                    isClickable ? undefined : { cursor: 'default', opacity: 0.5 }
                                }
                                tabIndex={isClickable ? 0 : -1}
                                disabled={!isClickable}
                            >
                                <div
                                    className={cn(
                                        isMain ? styles.mainDot : styles.secondaryDot,
                                        isActive &&
                                            (isMain
                                                ? styles.mainDotActive
                                                : styles.secondaryDotActive)
                                    )}
                                />
                                <span
                                    className={cn(
                                        isMain ? styles.mainLabel : styles.secondaryLabel,
                                        isActive &&
                                            (isMain
                                                ? styles.mainLabelActive
                                                : styles.secondaryLabelActive)
                                    )}
                                >
                                    {city.name}
                                </span>
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
