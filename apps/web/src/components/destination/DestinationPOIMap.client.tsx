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
 * source, no divergence). NEARBY POIs are fetched on mount from
 * `GET /destinations/:id/points-of-interest?relation=NEARBY`, because they are
 * needed ONLY by this optional, below-the-fold widget: bundling them into every
 * destination detail response would inflate the payload for every consumer
 * (Colón alone has 57 of them) to serve one toggle. The fetch degrades
 * gracefully — while it is in flight, and forever if it fails, the map renders
 * the PRIMARY pins and simply does not offer the toggle. A failed enrichment
 * fetch must never break the map.
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
import { useEffect, useMemo, useState } from 'react';
import type { LocationMapMultiMarker } from '@/components/maps/LocationMap.client';
import { LocationMap } from '@/components/maps/LocationMap.client';
import { destinationsApi } from '@/lib/api/endpoints';
import type { DestinationPointOfInterestItem } from '@/lib/api/transforms';
import { toDestinationPointOfInterestListProps } from '@/lib/api/transforms';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { translatePoiName, translatePoiTypeLabel } from '@/lib/poi-labels';
import { computeBounds, computeBoundsAround, computeFrameRadiusKm } from '@/lib/poi-map-bounds';

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
 * Fetches the destination's NEARBY POIs once after mount.
 *
 * Never throws and never surfaces an error state: `destinationsApi` returns an
 * `ApiResult`, and a failure simply leaves the list empty, which downstream
 * degrades to "PRIMARY pins, no toggle". Aborts its own state write on unmount
 * so a slow response cannot set state on a torn-down island.
 *
 * @param params.destinationId - The destination whose NEARBY POIs to load
 * @returns The transformed NEARBY POI list (empty while loading or on failure)
 */
function useNearbyPointsOfInterest({
    destinationId
}: {
    readonly destinationId: string;
}): ReadonlyArray<DestinationPointOfInterestItem> {
    const [nearby, setNearby] = useState<ReadonlyArray<DestinationPointOfInterestItem>>(EMPTY_POIS);

    useEffect(() => {
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
    }, [destinationId]);

    return nearby;
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
    locale
}: DestinationPOIMapProps) {
    const { t } = createTranslations(locale);
    const nearby = useNearbyPointsOfInterest({ destinationId });

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
    const fullBounds = useMemo(() => computeBounds({ points: markers }), [markers]);

    if (markers.length === 0 || !initialBounds) return null;

    // Only offer "ver alrededores" when it would actually reveal more — i.e.
    // the NEARBY fetch landed and returned something. Until then (and forever,
    // if it failed) the map is a plain PRIMARY-pin city view.
    const hasSurroundings = primaryMarkers.length > 0 && primaryMarkers.length < markers.length;

    return (
        <LocationMap
            mode="multi"
            markers={markers}
            initialBounds={initialBounds}
            surroundingsBounds={hasSurroundings && fullBounds ? fullBounds : undefined}
            ariaLabel={t('maps.ariaLabelPointsOfInterest', 'Mapa de puntos de interés')}
            i18nStrings={{
                attribution: t('maps.attribution'),
                showSurroundingsLabel: t('maps.showSurroundings', 'Ver alrededores'),
                hideSurroundingsLabel: t('maps.hideSurroundings', 'Volver a la ciudad')
            }}
        />
    );
}
