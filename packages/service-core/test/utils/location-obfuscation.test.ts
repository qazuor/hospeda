import { describe, expect, it } from 'vitest';
import {
    LOCATION_OBFUSCATION_CONSTANTS,
    haversineDistanceMeters,
    obfuscateCoordinates
} from '../../src/utils/location-obfuscation';

const TEST_SALT = 'test-location-salt-fixed-for-deterministic-tests-32+chars';
const ALT_SALT = 'a-completely-different-salt-with-32+chars-for-rotation-test';

describe('obfuscateCoordinates', () => {
    it('produces deterministic output for the same input', () => {
        const args = {
            exactLat: -30.7521,
            exactLng: -58.0429,
            accommodationId: 'acc_01HXZ',
            salt: TEST_SALT
        };

        const a = obfuscateCoordinates(args);
        const b = obfuscateCoordinates(args);

        expect(a).toEqual(b);
    });

    it('produces different output for different accommodation ids', () => {
        const a = obfuscateCoordinates({
            exactLat: -30.7521,
            exactLng: -58.0429,
            accommodationId: 'acc_one',
            salt: TEST_SALT
        });
        const b = obfuscateCoordinates({
            exactLat: -30.7521,
            exactLng: -58.0429,
            accommodationId: 'acc_two',
            salt: TEST_SALT
        });

        expect(a).not.toEqual(b);
    });

    it('produces different output when the salt is rotated', () => {
        const args = {
            exactLat: -30.7521,
            exactLng: -58.0429,
            accommodationId: 'acc_01HXZ'
        };

        const a = obfuscateCoordinates({ ...args, salt: TEST_SALT });
        const b = obfuscateCoordinates({ ...args, salt: ALT_SALT });

        expect(a.lat).not.toBe(b.lat);
        expect(a.lng).not.toBe(b.lng);
    });

    it('keeps the offset within MAX_OFFSET_METERS of the original coordinates', () => {
        const inputs = [
            { lat: -30.7521, lng: -58.0429 },
            { lat: -34.6037, lng: -58.3816 },
            { lat: 0.0, lng: 0.0 },
            { lat: 60.0, lng: 24.0 },
            { lat: -60.0, lng: -120.0 }
        ];

        for (const { lat, lng } of inputs) {
            for (let i = 0; i < 10; i++) {
                const result = obfuscateCoordinates({
                    exactLat: lat,
                    exactLng: lng,
                    accommodationId: `acc_${lat}_${lng}_${i}`,
                    salt: TEST_SALT
                });

                const distance = haversineDistanceMeters({
                    lat1: lat,
                    lng1: lng,
                    lat2: result.lat,
                    lng2: result.lng
                });

                expect(distance).toBeLessThanOrEqual(
                    LOCATION_OBFUSCATION_CONSTANTS.MAX_OFFSET_METERS * Math.SQRT2
                );
            }
        }
    });

    it('always returns the configured radius', () => {
        const result = obfuscateCoordinates({
            exactLat: -30.7521,
            exactLng: -58.0429,
            accommodationId: 'acc_radius',
            salt: TEST_SALT
        });

        expect(result.radiusMeters).toBe(LOCATION_OBFUSCATION_CONSTANTS.APPROXIMATE_RADIUS_METERS);
        expect(result.radiusMeters).toBe(150);
    });

    it('handles equator (lat=0) without dividing by zero or NaN', () => {
        const result = obfuscateCoordinates({
            exactLat: 0,
            exactLng: 0,
            accommodationId: 'acc_equator',
            salt: TEST_SALT
        });

        expect(Number.isFinite(result.lat)).toBe(true);
        expect(Number.isFinite(result.lng)).toBe(true);
    });

    it('produces uniformly distributed offsets across many ids', () => {
        const samples = 200;
        const positiveLatCount = Array.from({ length: samples }, (_, i) =>
            obfuscateCoordinates({
                exactLat: -30,
                exactLng: -58,
                accommodationId: `uniform_${i}`,
                salt: TEST_SALT
            })
        ).filter((r) => r.lat > -30).length;

        expect(positiveLatCount).toBeGreaterThan(samples * 0.35);
        expect(positiveLatCount).toBeLessThan(samples * 0.65);
    });
});

describe('haversineDistanceMeters', () => {
    it('returns 0 for identical coordinates', () => {
        const d = haversineDistanceMeters({
            lat1: -30.7521,
            lng1: -58.0429,
            lat2: -30.7521,
            lng2: -58.0429
        });

        expect(d).toBeCloseTo(0, 5);
    });

    it('approximates 1 degree of latitude as ~111km', () => {
        const d = haversineDistanceMeters({
            lat1: 0,
            lng1: 0,
            lat2: 1,
            lng2: 0
        });

        expect(d).toBeGreaterThan(111_000);
        expect(d).toBeLessThan(112_000);
    });
});
