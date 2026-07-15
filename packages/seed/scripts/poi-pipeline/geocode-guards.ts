/**
 * HOS-177 — destination-aware geocode guards.
 *
 * The pipeline trusts `destinationSlug` as the authoritative destination and
 * uses these guards to reject geocoder matches that contradict that assignment
 * (far-away homonyms, town-centroid collapses, etc.). A missing coordinate is
 * better than a confidently wrong one.
 */

import {
    DESTINATION_CENTROID_GUARD_METERS,
    DESTINATION_RADIUS_GUARD_KM,
    EXPLICIT_DISTANCE_TOLERANCE_KM
} from './constants.js';
import type { RawGeocodeHit } from './geocoder.js';

/** Destination context needed to validate a geocoded hit. */
export interface DestinationGuardContext {
    readonly destinationNames: readonly string[];
    readonly destinationCenter: {
        readonly lat: number;
        readonly long: number;
    };
    readonly rowAddress: string;
}

/** Guard evaluation output: the accepted hit, or `null` if rejected. */
export interface DestinationGuardResult {
    readonly hit: RawGeocodeHit | null;
    readonly reason: 'outside-radius' | 'town-centroid' | null;
}

/** Lowercases and strips diacritics for accent-insensitive matching. */
function normalize(value: string): string {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

/** Simplifies free-text addresses for broad place-name comparisons. */
function simplifyPlaceText(value: string): string {
    return normalize(value)
        .replace(/\b(argentina|entre rios)\b/g, ' ')
        .replace(/\b(ciudad|centro|casco|urbano|zona|de|del|la|el)\b/g, ' ')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Keeps connective words like `de` intact for explicit-distance parsing. */
function normalizeDistancePatternText(value: string): string {
    return normalize(value)
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Great-circle distance in km. */
function haversineKm(params: {
    readonly a: { readonly lat: number; readonly long: number };
    readonly b: { readonly lat: number; readonly long: number };
}): number {
    const { a, b } = params;
    const earthRadiusKm = 6371;
    const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
    const dLat = toRadians(b.lat - a.lat);
    const dLong = toRadians(b.long - a.long);
    const lat1 = toRadians(a.lat);
    const lat2 = toRadians(b.lat);
    const sinLat = Math.sin(dLat / 2);
    const sinLong = Math.sin(dLong / 2);
    const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLong * sinLong;
    return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

function uniqueDestinationAliases(destinationNames: readonly string[]): readonly string[] {
    const seen = new Set<string>();
    const aliases: string[] = [];
    for (const name of destinationNames) {
        const trimmed = name.trim();
        if (trimmed.length === 0) {
            continue;
        }
        const key = normalize(trimmed);
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        aliases.push(trimmed);
    }
    return aliases;
}

/**
 * Extracts a stated "a N km de <destino>" distance from the address itself.
 *
 * Only this pattern is trusted. Route markers like `Ruta 23 km 28` must NOT be
 * treated as a destination-distance hint.
 */
export function extractExplicitDestinationDistanceKm(params: {
    readonly rowAddress: string;
    readonly destinationNames: readonly string[];
}): number | null {
    const { rowAddress, destinationNames } = params;
    const normalizedAddress = normalizeDistancePatternText(rowAddress);

    for (const destinationName of uniqueDestinationAliases(destinationNames)) {
        const normalizedDestination = normalizeDistancePatternText(destinationName).replace(
            /[.*+?^${}()|[\]\\]/g,
            '\\$&'
        );
        const match = normalizedAddress.match(
            new RegExp(
                `(?:^|\\b)a?\\s*(\\d{1,3}(?:[.,]\\d+)?)\\s*km\\s+de\\s+${normalizedDestination}(?:\\b|$)`
            )
        );
        if (!match?.[1]) {
            continue;
        }

        const parsed = Number(match[1].replace(',', '.'));
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }

    return null;
}

/**
 * True when the row address is just the town (or its center), not a specific
 * POI address.
 */
export function isGenericDestinationAddress(params: {
    readonly rowAddress: string;
    readonly destinationNames: readonly string[];
}): boolean {
    const { rowAddress, destinationNames } = params;
    const simplifiedAddress = simplifyPlaceText(rowAddress);
    return uniqueDestinationAliases(destinationNames).some(
        (destinationName) => simplifiedAddress === simplifyPlaceText(destinationName)
    );
}

/** True when the geocoder's own label looks like the destination name. */
export function isDestinationNameLikeMatch(params: {
    readonly displayName: string;
    readonly destinationNames: readonly string[];
}): boolean {
    const { displayName, destinationNames } = params;
    const primaryLabel = normalize(displayName).split(',')[0]?.trim() ?? '';
    return uniqueDestinationAliases(destinationNames).some(
        (destinationName) => primaryLabel === normalize(destinationName)
    );
}

/**
 * Validates a raw geocode hit against the POI's assigned destination.
 *
 * @param params.hit - The provider hit to validate.
 * @param params.context - The destination + row context.
 * @returns The accepted hit, or `null` when the match is clearly wrong.
 */
export function applyDestinationGuards(params: {
    readonly hit: RawGeocodeHit | null;
    readonly context: DestinationGuardContext;
}): DestinationGuardResult {
    const { hit, context } = params;
    if (hit === null) {
        return { hit: null, reason: null };
    }

    const distanceKm = haversineKm({
        a: { lat: hit.lat, long: hit.long },
        b: context.destinationCenter
    });
    const explicitDistanceKm = extractExplicitDestinationDistanceKm({
        rowAddress: context.rowAddress,
        destinationNames: context.destinationNames
    });
    const maxAllowedKm =
        explicitDistanceKm === null
            ? DESTINATION_RADIUS_GUARD_KM
            : Math.max(
                  DESTINATION_RADIUS_GUARD_KM,
                  explicitDistanceKm + EXPLICIT_DISTANCE_TOLERANCE_KM
              );

    if (distanceKm > maxAllowedKm) {
        return { hit: null, reason: 'outside-radius' };
    }

    const distanceMeters = distanceKm * 1000;
    if (
        distanceMeters <= DESTINATION_CENTROID_GUARD_METERS &&
        (isDestinationNameLikeMatch({
            displayName: hit.displayName,
            destinationNames: context.destinationNames
        }) ||
            isGenericDestinationAddress({
                rowAddress: context.rowAddress,
                destinationNames: context.destinationNames
            }))
    ) {
        return { hit: null, reason: 'town-centroid' };
    }

    return { hit, reason: null };
}
