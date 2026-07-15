/**
 * @file MultiMarkerMapInner.client.tsx
 * @description Leaflet implementation of `LocationMap`'s `mode: 'multi'` — the
 * destination points-of-interest map (HOS-146).
 *
 * This is a SEPARATE async chunk from `LocationMapInner.client.tsx` (the
 * approximate/exact single-point map) on purpose: it is the only map that
 * builds POI pins, and building them pulls in `react-dom/server` plus the whole
 * `@repo/icons` POI-type table. Those cost nothing on an accommodation detail
 * page or a destination mini-map — which is exactly where they'd land if this
 * code shared a chunk with the single-point map. `LocationMap.client.tsx`
 * lazy-dispatches by `mode`, so each page downloads only the map it renders.
 *
 * Do NOT import this file directly from Astro pages or other components;
 * use the `LocationMap` re-export from `LocationMap.client.tsx` instead.
 */
import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';

import { GradientButton } from '@/components/ui/GradientButtonReact';
import { getPointOfInterestTypeIcon } from '@/lib/poi-type-icons';
import type {
    LocationMapBoundsTuple,
    LocationMapMultiMarker,
    LocationMapProps
} from './LocationMap.client';
import styles from './LocationMap.module.css';
import { ScrollWheelZoomController, TILE_URL } from './map-controls.client';

const MULTI_MAX_ZOOM = 17;

// ─── Pin sizing ────────────────────────────────────────────────────────────
// PRIMARY pins are larger + solid-filled; NEARBY pins are smaller + outlined.
// The two relations must be distinguishable by shape/size, not color alone
// (WCAG) — see `getPoiDivIcon`.
const PRIMARY_PIN_PX = 34;
const NEARBY_PIN_PX = 24;
const PRIMARY_GLYPH_PX = 16;
const NEARBY_GLYPH_PX = 12;

/**
 * Process-lifetime cache of POI pin icons, keyed `${type}:${relation}`.
 *
 * The key space is closed and tiny: 9 `PointOfInterestTypeEnum` values × 2
 * relations = 18 icons, ever. Caching them matters because a `L.DivIcon` is
 * compared BY REFERENCE by react-leaflet: a freshly-built icon per marker per
 * render makes every re-render (e.g. the "ver alrededores" toggle) call
 * `setIcon()` on all ~97 markers for zero visual change. Entries are built
 * lazily on first sight, so a map only pays for the types it actually shows.
 */
const poiDivIconCache = new Map<string, L.DivIcon>();

/**
 * Returns the Leaflet divIcon for a POI pin, building it once per
 * `type`/`relation` pair. PRIMARY pins are solid brand-primary circles
 * (larger); NEARBY pins are outlined circles on the card surface (smaller,
 * lower visual weight) — a shape/size distinction, not color alone (WCAG).
 *
 * The glyph reuses `getPointOfInterestTypeIcon` — the SAME type→icon mapping
 * `DestinationPOISection.astro`'s grid uses — so a POI's map pin and its grid
 * card can never drift apart.
 *
 * ## Why `renderToStaticMarkup`, and what it costs
 *
 * Leaflet needs a plain HTML string, not a live React tree, and `@repo/icons`
 * only exposes Phosphor React components — there is no SVG-string form to
 * reuse. So this is NOT the `DESTINATION_ICON` pattern in
 * `ListingMapInner.client.tsx`: that one hand-writes a single literal SVG
 * string because it has exactly one, fixed pin. Hand-writing 9 POI glyphs here
 * would mean a second icon table that silently diverges from the grid's the
 * first time either changes — a worse failure than the bundle cost.
 *
 * The tradeoff we accept instead: `react-dom/server` ships in THIS chunk. It is
 * contained by (a) the module-level cache above, which caps the render work at
 * 18 calls for the lifetime of the page, and (b) this file being its own async
 * chunk, so only the destination POI map pays for it — never the accommodation
 * detail map or the destination mini-map.
 *
 * @param params.type - POI type (resolves the glyph)
 * @param params.relation - PRIMARY | NEARBY (resolves size and fill/outline)
 * @returns The cached (or newly built) divIcon for that combination
 */
function getPoiDivIcon({
    type,
    relation
}: {
    readonly type: string;
    readonly relation: 'PRIMARY' | 'NEARBY';
}): L.DivIcon {
    const cacheKey = `${type}:${relation}`;
    const cached = poiDivIconCache.get(cacheKey);
    if (cached) return cached;

    const Icon = getPointOfInterestTypeIcon({ type });
    const isPrimary = relation === 'PRIMARY';
    const glyph = renderToStaticMarkup(
        <Icon
            size={isPrimary ? PRIMARY_GLYPH_PX : NEARBY_GLYPH_PX}
            weight="fill"
            color={isPrimary ? 'var(--primary-foreground)' : 'var(--brand-primary)'}
            aria-hidden="true"
        />
    );
    const size = isPrimary ? PRIMARY_PIN_PX : NEARBY_PIN_PX;
    const pinClass = isPrimary ? styles.poiPinPrimary : styles.poiPinNearby;
    const icon = L.divIcon({
        className: styles.poiPinReset,
        html: `<span class="${styles.poiPin} ${pinClass}">${glyph}</span>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -(size / 2) - 4]
    });
    poiDivIconCache.set(cacheKey, icon);
    return icon;
}

/**
 * Re-fits the map to `bounds` whenever they change — mount, and every time
 * the "ver alrededores" toggle flips between the PRIMARY-only and full bbox.
 * Unlike `ListingMapInner`'s mount-only `FitBoundsOnce`, this intentionally
 * re-runs on every bounds change; that IS the toggle's effect.
 */
function FitBoundsToggle({
    bounds,
    maxZoom
}: {
    readonly bounds: LocationMapBoundsTuple;
    readonly maxZoom: number;
}) {
    const map = useMap();
    const [[south, west], [north, east]] = bounds;
    // biome-ignore lint/correctness/useExhaustiveDependencies: re-fit is keyed on the bounds VALUES (south/west/north/east); `map`/`maxZoom` are stable across the toggle and including them would not change when to re-fit.
    useEffect(() => {
        map.invalidateSize();
        map.fitBounds(
            [
                [south, west],
                [north, east]
            ],
            { padding: [40, 40], maxZoom }
        );
    }, [south, west, north, east]);
    return null;
}

/**
 * Multi-marker POI map (HOS-146). Renders one pin per marker — NO clustering
 * (deliberate product decision) — initially framed to `initialBounds` (the
 * PRIMARY-only "city view"). The optional "ver alrededores" toggle re-frames
 * to `surroundingsBounds` (PRIMARY + NEARBY) and back; it only renders when
 * `surroundingsBounds` is provided (i.e. there is something extra to
 * reveal). Reuses the same click-to-activate scroll-zoom UX as the
 * approximate/exact modes — but NOT the same implementation of it, see
 * "Activation" below.
 *
 * ## Activation (why this mode diverges from approximate/exact)
 *
 * This map keeps the click-to-activate scroll-zoom UX (it is embedded in page
 * content flow, not a dedicated map page like `ListingMapInner`, so it must not
 * hijack wheel-scrolling before the user opts in). What it does NOT keep is
 * `LocationMapInner`'s way of implementing it: a full-bleed `inset: 0` overlay
 * that receives the click. On a map whose entire point is clicking pins, that
 * overlay eats the FIRST click on every one of the ~97 markers — two clicks to
 * open any popup. It goes unnoticed on approximate/exact because those have 0
 * or 1 marker, so the swallowed click almost never had a target.
 *
 * Instead: the hint is `pointer-events: none` (`.activationHintPassive`, purely
 * visual — hover styling is driven from `.mapWrapper` instead of the overlay
 * itself), and activation hangs off a CAPTURE-phase `pointerdown` on this
 * component's own root. Capture is what makes it reliable: it fires before the
 * event reaches Leaflet, so a click on a marker both opens its popup AND
 * activates the map, and Leaflet's internal `stopPropagation` cannot suppress
 * it. It also pairs symmetrically with the document-level "pointerdown outside
 * → deactivate" effect below: one rule, inside activates / outside deactivates.
 *
 * @param props - the `mode: 'multi'` member of {@link LocationMapProps}
 */
export function MultiMarkerMapInner(props: Extract<LocationMapProps, { mode: 'multi' }>) {
    const { markers, initialBounds, surroundingsBounds, ariaLabel, i18nStrings, className } = props;

    const [showSurroundings, setShowSurroundings] = useState(false);
    const [isActive, setIsActive] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isActive) return;
        const handlePointerDown = (event: PointerEvent): void => {
            if (containerRef.current?.contains(event.target as Node)) return;
            setIsActive(false);
        };
        document.addEventListener('pointerdown', handlePointerDown);
        return () => document.removeEventListener('pointerdown', handlePointerDown);
    }, [isActive]);

    // Self-guards when empty, mirroring DestinationPOISection.astro's grid.
    if (markers.length === 0) return null;

    const mapRoot = `${styles.root}${className ? ` ${className}` : ''}`;
    const activeBounds =
        showSurroundings && surroundingsBounds ? surroundingsBounds : initialBounds;
    const seedCenter: [number, number] = [
        (initialBounds[0][0] + initialBounds[1][0]) / 2,
        (initialBounds[0][1] + initialBounds[1][1]) / 2
    ];
    const interactionHint =
        i18nStrings.interactionHint ?? 'Hacé click en el mapa para activar el zoom';

    // Capture phase: runs before Leaflet sees the event, so activating the map
    // never costs the click that triggered it (a pin click opens its popup on
    // the FIRST click). See the "Activation" section in this file's docs.
    const handleActivate = (): void => {
        if (!isActive) setIsActive(true);
    };

    return (
        // biome-ignore lint/a11y/useSemanticElements: <fieldset> is only for form-control groups; role="group" is the correct ARIA for an interactive map widget that contains focusable Leaflet controls.
        <div
            role="group"
            ref={containerRef}
            className={mapRoot}
            aria-label={ariaLabel}
            onPointerDownCapture={handleActivate}
        >
            <div className={styles.mapWrapper}>
                <MapContainer
                    center={seedCenter}
                    zoom={13}
                    maxZoom={MULTI_MAX_ZOOM}
                    scrollWheelZoom={false}
                    className={styles.container}
                >
                    <TileLayer
                        attribution={i18nStrings.attribution}
                        url={TILE_URL}
                        maxZoom={MULTI_MAX_ZOOM}
                    />
                    <FitBoundsToggle
                        bounds={activeBounds}
                        maxZoom={MULTI_MAX_ZOOM}
                    />
                    <ScrollWheelZoomController active={isActive} />
                    {markers.map((marker: LocationMapMultiMarker) => (
                        <Marker
                            key={marker.id}
                            position={[marker.lat, marker.long]}
                            icon={getPoiDivIcon({ type: marker.type, relation: marker.relation })}
                            // Leaflet renders every marker as a focusable
                            // `role="button"` element. Without this it is a tab
                            // stop with NO accessible name — ~97 unnamed buttons
                            // per destination (WCAG 2.1 A, 4.1.2 Name/Role/Value).
                            // `title` is the only lever that works here: Leaflet
                            // applies `alt` ONLY when the icon is an <img>, and a
                            // DivIcon never is.
                            title={marker.label}
                        >
                            <Popup>
                                <strong className={styles.poiPopupTitle}>{marker.label}</strong>
                                <br />
                                <span className={styles.poiPopupType}>{marker.typeLabel}</span>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>
                {!isActive && (
                    // Purely visual, click-through hint (aria-hidden +
                    // pointer-events: none): it must never intercept a pin
                    // click. Activation is handled by the root's capture-phase
                    // pointerdown instead — see this file's "Activation" docs.
                    <div
                        className={`${styles.activationHint} ${styles.activationHintPassive}`}
                        aria-hidden="true"
                    >
                        <span className={styles.activationHintText}>{interactionHint}</span>
                    </div>
                )}
                {surroundingsBounds && (
                    <div className={styles.surroundingsToggleWrapper}>
                        {/*
                         * No `aria-pressed`: this control CHANGES ITS NAME
                         * ("Ver alrededores" → "Volver a la ciudad"). The
                         * WAI-ARIA APG allows exactly one of the two toggle
                         * patterns — stable name + `aria-pressed`, or mutating
                         * name and no `aria-pressed`. Doing both announces
                         * "Volver a la ciudad, pressed", which reads as the
                         * opposite of the state it is in.
                         */}
                        <GradientButton
                            as="button"
                            type="button"
                            variant="outline-primary"
                            size="sm"
                            onClick={() => setShowSurroundings((prev) => !prev)}
                            label={
                                showSurroundings
                                    ? (i18nStrings.hideSurroundingsLabel ??
                                      i18nStrings.showSurroundingsLabel)
                                    : i18nStrings.showSurroundingsLabel
                            }
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
