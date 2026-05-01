import { createHmac } from 'node:crypto';

/**
 * Approximate location representation for privacy-aware public exposure.
 *
 * The lat/lng pair is the deterministically obfuscated center of a circle
 * containing the real location. The real coordinates are NEVER exposed in
 * shapes that include this object.
 */
export interface ApproximateLocation {
    /** Latitude of the obfuscated circle center, in decimal degrees. */
    lat: number;
    /** Longitude of the obfuscated circle center, in decimal degrees. */
    lng: number;
    /** Visual radius of the circle, in meters. */
    radiusMeters: number;
}

const APPROXIMATE_RADIUS_METERS = 150;
const MAX_OFFSET_METERS = 100;
const METERS_PER_DEGREE_LATITUDE = 111_111;

/**
 * Reads 8 bytes from a Buffer at the given offset and converts them to a
 * uniformly distributed float in [0, 1).
 */
const readFloat01 = (buf: Buffer, offset: number): number => {
    const high = buf.readUInt32BE(offset);
    const low = buf.readUInt32BE(offset + 4);
    const combined = high * 0x1_00_00_00_00 + low;
    return combined / 2 ** 64;
};

/**
 * Computes a deterministic, irreversible approximate location for an
 * accommodation given its exact coordinates and a server-side secret salt.
 *
 * Properties:
 * - Determinism: same `(accommodationId, salt)` always produces the same offset.
 * - Irreversibility: without the salt, the original coordinates cannot be
 *   recovered from the obfuscated ones.
 * - Bounded: offset is at most `MAX_OFFSET_METERS` (100m), and the visual
 *   radius is `APPROXIMATE_RADIUS_METERS` (150m), guaranteeing the real
 *   location falls inside the displayed circle.
 * - Salt rotation invalidates all previous offsets (expected behavior).
 *
 * @example
 * ```ts
 * obfuscateCoordinates({
 *   exactLat: -30.7521,
 *   exactLng: -58.0429,
 *   accommodationId: 'acc_01HXZ...',
 *   salt: process.env.HOSPEDA_LOCATION_SALT!,
 * });
 * // → { lat: -30.7515, lng: -58.0435, radiusMeters: 150 }
 * ```
 */
export const obfuscateCoordinates = (args: {
    exactLat: number;
    exactLng: number;
    accommodationId: string;
    salt: string;
}): ApproximateLocation => {
    const { exactLat, exactLng, accommodationId, salt } = args;

    const hmac = createHmac('sha256', salt).update(accommodationId).digest();
    const latRand = readFloat01(hmac, 0);
    const lngRand = readFloat01(hmac, 8);

    const latOffsetMeters = (latRand * 2 - 1) * MAX_OFFSET_METERS;
    const lngOffsetMeters = (lngRand * 2 - 1) * MAX_OFFSET_METERS;

    const latOffsetDeg = latOffsetMeters / METERS_PER_DEGREE_LATITUDE;
    const lngOffsetDeg =
        lngOffsetMeters / (METERS_PER_DEGREE_LATITUDE * Math.cos((exactLat * Math.PI) / 180));

    return {
        lat: exactLat + latOffsetDeg,
        lng: exactLng + lngOffsetDeg,
        radiusMeters: APPROXIMATE_RADIUS_METERS
    };
};

/**
 * Computes the great-circle distance in meters between two coordinates using
 * the haversine formula. Exposed for use in tests and to verify that obfuscation
 * outputs stay within the bounded distance from the original.
 */
export const haversineDistanceMeters = (args: {
    lat1: number;
    lng1: number;
    lat2: number;
    lng2: number;
}): number => {
    const { lat1, lng1, lat2, lng2 } = args;
    const earthRadiusMeters = 6_371_000;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusMeters * c;
};

/**
 * Constants exported for tests and consumers that need to align UI bounds
 * with the algorithm's invariants.
 */
export const LOCATION_OBFUSCATION_CONSTANTS = {
    APPROXIMATE_RADIUS_METERS,
    MAX_OFFSET_METERS
} as const;
