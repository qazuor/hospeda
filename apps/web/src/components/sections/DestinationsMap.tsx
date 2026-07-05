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
import { BridgeIcon } from '@repo/icons';
import { type MouseEvent as ReactMouseEvent, useCallback, useRef, useState } from 'react';
import styles from './DestinationsMap.module.css';

// ---------------------------------------------------------------------------
// Design-space constants
// ---------------------------------------------------------------------------

/** Width of the original Figma design space the pin coordinates live in. */
const DESIGN_WIDTH = 616;
/** Height of the original Figma design space the pin coordinates live in. */
const DESIGN_HEIGHT = 793;

/**
 * Maximum distance (in design-space units) between a pointer and a city dot for
 * a click/hover to resolve to that city. Clicks farther than this from every
 * clickable dot select nothing. Large enough to cover the dot and its adjacent
 * label, small enough that empty regions of the map stay inert.
 */
const MAX_HIT_RADIUS = 45;

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
    const pinsLayerRef = useRef<HTMLDivElement>(null);
    const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);

    /**
     * Finds the destination index matching a given city slug.
     * Returns -1 if no destination matches (city is on map but not in data).
     */
    const findDestinationIndex = useCallback(
        (slug: string): number => destinations.findIndex((d) => d.slug === slug),
        [destinations]
    );

    /**
     * Resolve the clickable city whose dot is nearest to a pointer position,
     * within {@link MAX_HIT_RADIUS} design units. Returns `null` when the
     * pointer is not near any clickable city.
     *
     * This is the core of the collision-proof interaction (BETA-109): rather
     * than letting the topmost overlapping pin capture the pointer (which made
     * a nearby main pin swallow a smaller neighbour's clicks), EVERY pointer
     * event is resolved to the nearest clickable dot. No matter how densely
     * pins overlap, the click always lands on the closest one.
     */
    const nearestClickable = useCallback(
        (clientX: number, clientY: number): { slug: string; index: number } | null => {
            const layer = pinsLayerRef.current;
            if (!layer) return null;
            const rect = layer.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return null;

            // Pointer position expressed in the 616×793 design space.
            const px = ((clientX - rect.left) / rect.width) * DESIGN_WIDTH;
            const py = ((clientY - rect.top) / rect.height) * DESIGN_HEIGHT;

            let best: { slug: string; index: number } | null = null;
            let bestDistSq = MAX_HIT_RADIUS * MAX_HIT_RADIUS;
            for (const city of CITIES) {
                const index = findDestinationIndex(city.slug);
                if (index === -1) continue; // decorative-only pin, never selectable
                const dx = city.x - px;
                const dy = city.y - py;
                const distSq = dx * dx + dy * dy;
                if (distSq <= bestDistSq) {
                    bestDistSq = distSq;
                    best = { slug: city.slug, index };
                }
            }
            return best;
        },
        [findDestinationIndex]
    );

    /** Pointer click / tap on the map → select the nearest clickable city. */
    const handlePointerSelect = useCallback(
        (event: ReactMouseEvent<HTMLDivElement>): void => {
            const hit = nearestClickable(event.clientX, event.clientY);
            if (hit) onSelectDestination(hit.index);
        },
        [nearestClickable, onSelectDestination]
    );

    /** Pointer move over the map → highlight the nearest clickable city. */
    const handlePointerMove = useCallback(
        (event: ReactMouseEvent<HTMLDivElement>): void => {
            const hit = nearestClickable(event.clientX, event.clientY);
            setHoveredSlug(hit?.slug ?? null);
        },
        [nearestClickable]
    );

    const handlePointerLeave = useCallback((): void => setHoveredSlug(null), []);

    return (
        // biome-ignore lint/a11y/useSemanticElements: <fieldset> is only for form-control groups; role="group" is the correct ARIA for an interactive map widget that contains focusable destination pins.
        <div
            role="group"
            className={styles.mapContainer}
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

            {/* Pins layer — owns pointer interaction and resolves it by
                proximity to the nearest clickable dot (BETA-109). The pin
                wrappers are pointer-events:none so mouse/touch fall through to
                this handler; the buttons stay keyboard-focusable for a11y. */}
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: this div is a pointer-only proximity hit-surface; keyboard users tab to and activate the focusable <button> pins inside it, which carry their own keyboard handling. A key handler here would be meaningless (proximity needs pointer coordinates). */}
            <div
                ref={pinsLayerRef}
                className={cn(styles.pinsLayer, hoveredSlug && styles.pinsLayerInteractive)}
                aria-hidden="false"
                onClick={handlePointerSelect}
                onMouseMove={handlePointerMove}
                onMouseLeave={handlePointerLeave}
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
                                <BridgeIcon
                                    size={20}
                                    weight="regular"
                                    aria-hidden="true"
                                />
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
                    // Active state dominates; only highlight hover when not active.
                    const isHovered = isClickable && !isActive && hoveredSlug === city.slug;

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
                                onClick={(event) => {
                                    // Mouse/touch never reaches this button (the pin
                                    // wrapper is pointer-events:none and the layer
                                    // resolves the click by proximity). This fires
                                    // ONLY for keyboard activation of the focused pin,
                                    // which selects itself directly; stop it so the
                                    // layer's proximity handler doesn't also run on a
                                    // zero-coordinate synthetic click.
                                    event.stopPropagation();
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
                                                : styles.secondaryDotActive),
                                        isHovered &&
                                            (isMain
                                                ? styles.mainDotHovered
                                                : styles.secondaryDotHovered)
                                    )}
                                />
                                <span
                                    className={cn(
                                        isMain ? styles.mainLabel : styles.secondaryLabel,
                                        isActive &&
                                            (isMain
                                                ? styles.mainLabelActive
                                                : styles.secondaryLabelActive),
                                        isHovered &&
                                            (isMain
                                                ? styles.mainLabelHovered
                                                : styles.secondaryLabelHovered)
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
