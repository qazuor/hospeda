/**
 * @file DestinationPOIMap.client.tsx
 * @description Multi-marker map of a destination's points of interest
 * (HOS-146). Renders every POI that has coordinates as a pin, distinguishing
 * PRIMARY (city-core landmarks, median 0.3-4.6km from center) from NEARBY
 * (far-out landmarks, median 9-55km away, up to 134km) both visually — see
 * `MultiMarkerMapInner.client.tsx`'s `getPoiDivIcon` — and via the initial
 * viewport: the map opens framed on the destination's own coordinates
 * ("city view"); a "ver alrededores" toggle re-frames to the full
 * PRIMARY+NEARBY bbox.
 *
 * ## Where the two relation kinds come from
 *
 * PRIMARY POIs arrive as a prop, from the destination detail payload the page
 * already fetched server-side (the same array the SSR grid renders — one
 * source, no divergence). NEARBY POIs are fetched LAZILY from
 * `GET /destinations/:id/points-of-interest?relation=NEARBY` — only once the
 * visitor activates "ver alrededores", never on mount (HOS-181). They are
 * needed ONLY by this optional, below-the-fold widget, and only when the user
 * asks to step out from the city view: a default page view ships zero NEARBY
 * request, and bundling them into every destination detail response would
 * inflate the payload for every consumer (Colón alone has 57 of them) to serve
 * one toggle. The fetch degrades gracefully — while it is in flight, and forever
 * if it fails, the map keeps the PRIMARY pins. A failed enrichment fetch must
 * never break the map.
 *
 * The initial frame is anchored to the destination's coordinates plus an
 * adaptive radius, NOT to the bbox of its PRIMARY POIs. A plain bbox fit was
 * tried first and fails on 20 of 22 destinations: the HOS-141 pipeline marks
 * POIs up to 39km away as PRIMARY, so min/max framing yields viewports of
 * 100-200km that put the destination off-centre. Two distinct data problems
 * feed that (removable outliers on some destinations, systematic dispersion
 * on others such as ceibas/villaguay), so no percentile trick on the bbox
 * fixes it — only ignoring POI extent for the initial frame does.
 *
 * `client:only="react"` — Leaflet needs `window`. The list/grid section
 * (`DestinationPOISection.astro`, SSR, PRIMARY-only) remains the indexable
 * content source for POIs (SSR-first principle, apps/web/CLAUDE.md) — this
 * map is enrichment only, never the sole place a POI's name/type appears.
 *
 * Self-guards: renders nothing when no POI has coordinates, mirroring the
 * grid's empty-array guard.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LocationMapMultiMarker } from '@/components/maps/LocationMap.client';
import { LocationMap } from '@/components/maps/LocationMap.client';
import { destinationsApi } from '@/lib/api/endpoints';
import type { DestinationPointOfInterestItem } from '@/lib/api/transforms';
import { toDestinationPointOfInterestListProps } from '@/lib/api/transforms';
import { FACET_CONFIG_BY_ID } from '@/lib/filters/facet-config';
import { matchesActivePoiCategories } from '@/lib/filters/match-poi-category-filter';
import { POI_CATEGORY_FILTER_EVENT } from '@/lib/filters/poi-category-filter-event';
import { readFacetActiveValues } from '@/lib/filters/read-facet-active-values';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { translatePoiName, translatePoiTypeLabel } from '@/lib/poi-labels';
import {
    computeBounds,
    computeBoundsAround,
    computeFrameRadiusKm,
    computeSurroundingsBounds
} from '@/lib/poi-map-bounds';

export interface DestinationPOIMapProps {
    /**
     * The destination's PRIMARY points of interest, already transformed —
     * the same array the SSR grid renders.
     */
    readonly pointsOfInterest: ReadonlyArray<DestinationPointOfInterestItem>;
    /**
     * The destination's id — used to fetch its NEARBY POIs after mount (the
     * detail payload carries PRIMARY only).
     */
    readonly destinationId: string;
    /**
     * The destination's own coordinates — the anchor for the initial frame.
     * When absent, the map falls back to framing the PRIMARY POIs.
     */
    readonly center?: { readonly lat: number; readonly long: number } | null;
    readonly locale: SupportedLocale;
    /**
     * Whether the thematic category filter is active on this page (HOS-147) —
     * the page passes `true` only when the filter chip island is actually
     * mounted (>=2 present categories). When `false`, the map ignores any
     * `?categories=` URL param so it can never filter its markers while the
     * grid (which has no filter UI) shows everything — that would desync the
     * two. Defaults to `true` (back-compat for callers/tests without a filter).
     */
    readonly filterEnabled?: boolean;
}

/**
 * A POI narrowed to have real coordinates (used internally after filtering).
 */
type GeolocatedPoi = DestinationPointOfInterestItem & {
    readonly lat: number;
    readonly long: number;
};

const EMPTY_POIS: ReadonlyArray<DestinationPointOfInterestItem> = [];

/**
 * Lazily fetches the destination's NEARBY POIs — ONLY once `requestNearby` is
 * called (HOS-181), not on mount. A default destination-page view therefore
 * ships zero NEARBY request; the fetch fires only when the visitor activates
 * "ver alrededores". The first `requestNearby` arms the fetch; further calls are
 * no-ops (idempotent).
 *
 * Never throws and never surfaces an error state: `destinationsApi` returns an
 * `ApiResult`, and a failure simply leaves the list empty, which downstream
 * degrades to "PRIMARY pins only". Aborts its own state write on unmount so a
 * slow response cannot set state on a torn-down island.
 *
 * @param params.destinationId - The destination whose NEARBY POIs to load
 * @returns `nearby` (empty until requested / while loading / on failure) and
 *          `requestNearby` (arms the one-time fetch)
 */
function useNearbyPointsOfInterest({ destinationId }: { readonly destinationId: string }): {
    readonly nearby: ReadonlyArray<DestinationPointOfInterestItem>;
    readonly requestNearby: () => void;
} {
    const [nearby, setNearby] = useState<ReadonlyArray<DestinationPointOfInterestItem>>(EMPTY_POIS);
    const [requested, setRequested] = useState(false);

    const requestNearby = useCallback(() => setRequested(true), []);

    useEffect(() => {
        if (!requested) return;
        let active = true;
        const load = async (): Promise<void> => {
            const result = await destinationsApi.getPointsOfInterest({
                id: destinationId,
                relation: 'NEARBY'
            });
            if (!active || !result.ok) return;
            setNearby(
                toDestinationPointOfInterestListProps({
                    pointsOfInterest: result.data as ReadonlyArray<Record<string, unknown>>
                })
                    // These rows are NEARBY by construction — the request
                    // filtered on it. Re-asserting it here rather than trusting
                    // the payload is what makes that an invariant: `relation` is
                    // `.optional()` in the schema, and the transform defaults
                    // ANY non-'NEARBY' value (including a missing one) to
                    // 'PRIMARY'. So an API that stopped emitting the field would
                    // silently relabel every fetched POI as PRIMARY, which reads
                    // downstream as "nothing extra to show" and makes the "ver
                    // alrededores" toggle vanish — no error, no failing test.
                    // The caller already knows the answer; zero cost to say it.
                    .map((poi) => ({ ...poi, relation: 'NEARBY' as const }))
            );
        };
        void load();
        return () => {
            active = false;
        };
    }, [requested, destinationId]);

    return { nearby, requestNearby };
}

const POI_CATEGORY_PARAM = FACET_CONFIG_BY_ID.pointOfInterestCategory.paramKey;

/** Reads the active POI category slugs from `window.location` (empty on SSR). */
function readActivePoiCategories(): string[] {
    if (typeof window === 'undefined') return [];
    return [
        ...readFacetActiveValues({
            searchParams: new URLSearchParams(window.location.search),
            paramKey: POI_CATEGORY_PARAM
        })
    ];
}

/**
 * Tracks the active thematic category selection (HOS-147) so the map filters
 * its markers in lock-step with the SSR card grid. Seeds from the URL on mount
 * (honors a deep-link even if the map hydrates before the filter island — R-2),
 * then follows live changes broadcast by `DestinationPOIFilter` via the
 * `POI_CATEGORY_FILTER_EVENT` and browser back/forward via `popstate`.
 */
function useActivePoiCategoryFilter(enabled: boolean): readonly string[] {
    const [active, setActive] = useState<readonly string[]>([]);
    useEffect(() => {
        // When the filter UI is absent (page gated it off), never honor the URL
        // param or events — the grid isn't filtering, so the map must not either.
        if (!enabled) {
            setActive([]);
            return;
        }
        const syncFromUrl = () => setActive(readActivePoiCategories());
        const onFilter = (event: Event) => {
            const detail = (event as CustomEvent<{ categories?: string[] }>).detail;
            setActive(detail?.categories ?? []);
        };
        syncFromUrl();
        window.addEventListener(POI_CATEGORY_FILTER_EVENT, onFilter);
        window.addEventListener('popstate', syncFromUrl);
        return () => {
            window.removeEventListener(POI_CATEGORY_FILTER_EVENT, onFilter);
            window.removeEventListener('popstate', syncFromUrl);
        };
    }, [enabled]);
    return active;
}

/**
 * Destination points-of-interest map island.
 *
 * @param props - {@link DestinationPOIMapProps}
 */
export function DestinationPOIMap({
    pointsOfInterest,
    destinationId,
    center,
    locale,
    filterEnabled = true
}: DestinationPOIMapProps) {
    const { t } = createTranslations(locale);
    const { nearby, requestNearby } = useNearbyPointsOfInterest({ destinationId });
    const activeCategories = useActivePoiCategoryFilter(filterEnabled);

    // `nearby` rows carry an explicitly re-asserted relation (see
    // useNearbyPointsOfInterest) — the PRIMARY/NEARBY split below cannot drift
    // with the payload.
    const allPois = useMemo(() => [...pointsOfInterest, ...nearby], [pointsOfInterest, nearby]);

    const geolocated = useMemo<ReadonlyArray<GeolocatedPoi>>(
        () => allPois.filter((poi): poi is GeolocatedPoi => poi.lat != null && poi.long != null),
        [allPois]
    );

    // biome-ignore lint/correctness/useExhaustiveDependencies: `t` is derived from `locale` (already a dep) via createTranslations above; re-listing it would just re-run this memo on every render since createTranslations returns a fresh function each time.
    const markers = useMemo<ReadonlyArray<LocationMapMultiMarker>>(
        () =>
            geolocated.map((poi) => ({
                id: poi.id,
                lat: poi.lat,
                long: poi.long,
                type: poi.type,
                categorySlug: poi.primaryCategory?.slug ?? null,
                relation: poi.relation,
                label: translatePoiName({ slug: poi.slug, nameI18n: poi.nameI18n, locale }),
                typeLabel: translatePoiTypeLabel({ t, type: poi.type })
            })),
        [geolocated, locale]
    );

    const primaryMarkers = useMemo(
        () => markers.filter((marker) => marker.relation === 'PRIMARY'),
        [markers]
    );

    // HOS-147: apply the thematic category filter to the DISPLAYED markers only
    // (OR/any-of — a POI matches when it belongs to ANY selected category,
    // tested against ALL of its categories — the same shared predicate the SSR
    // grid uses, R-3). Filtering by visible POI id reuses the existing
    // marker mapping. The bounds/toggle below stay computed from the UNFILTERED
    // set so the frame doesn't jump and "ver alrededores" availability is stable
    // as the user toggles categories.
    const visibleMarkerIds = useMemo(() => {
        if (activeCategories.length === 0) return null; // null = show all
        return new Set(
            geolocated
                .filter((poi) =>
                    matchesActivePoiCategories({
                        poiCategorySlugs: (poi.categories ?? []).map((c) => c.slug),
                        activeCategorySlugs: activeCategories
                    })
                )
                .map((poi) => poi.id)
        );
    }, [geolocated, activeCategories]);

    const visibleMarkers = useMemo(
        () =>
            visibleMarkerIds === null ? markers : markers.filter((m) => visibleMarkerIds.has(m.id)),
        [markers, visibleMarkerIds]
    );

    // Frame on the destination itself, sized to hold ~90% of its PRIMARY POIs.
    // Falls back to a plain bbox fit only when the destination has no
    // coordinates of its own — then POI extent is the only signal available.
    const initialBounds = useMemo(() => {
        if (center) {
            return computeBoundsAround({
                center,
                radiusKm: computeFrameRadiusKm({
                    center,
                    points: primaryMarkers.length > 0 ? primaryMarkers : markers
                })
            });
        }
        return computeBounds({ points: primaryMarkers.length > 0 ? primaryMarkers : markers });
    }, [center, primaryMarkers, markers]);
    // "Ver alrededores" is a short step out from the city view, not a jump to
    // the whole province: capped at 50km around the destination. An uncapped
    // bbox of every marker reaches 256km on ceibas and 214km on san-justo,
    // where the destination is a dot (HOS-146 review). Falls back to the plain
    // bbox only when the destination has no coordinates to cap around.
    const fullBounds = useMemo(
        () =>
            center
                ? computeSurroundingsBounds({ center, points: markers })
                : computeBounds({ points: markers }),
        [center, markers]
    );

    if (markers.length === 0 || !initialBounds) return null;

    return (
        <LocationMap
            mode="multi"
            markers={visibleMarkers}
            initialBounds={initialBounds}
            // HOS-181 (lazy NEARBY): we no longer fetch NEARBY on mount, so
            // pre-fetch we cannot know whether the destination has any. The "ver
            // alrededores" toggle is therefore offered whenever there's a frame to
            // widen to (`fullBounds`); activating it fires the fetch
            // (onShowSurroundings → requestNearby). If nothing comes back the frame
            // just widens around the PRIMARY set. Trades a slightly less precise
            // toggle for not fetching NEARBY on every page view (perf, D-2).
            surroundingsBounds={fullBounds ?? undefined}
            onShowSurroundings={requestNearby}
            ariaLabel={t('maps.ariaLabelPointsOfInterest', 'Mapa de puntos de interés')}
            i18nStrings={{
                attribution: t('maps.attribution'),
                showSurroundingsLabel: t('maps.showSurroundings', 'Ver alrededores'),
                hideSurroundingsLabel: t('maps.hideSurroundings', 'Volver a la ciudad')
            }}
        />
    );
}
