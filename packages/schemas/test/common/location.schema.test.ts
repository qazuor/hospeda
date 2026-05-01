import { describe, expect, it } from 'vitest';
import { ApproximateLocationSchema } from '../../src/common/location.schema';

describe('ApproximateLocationSchema', () => {
    it('accepts a valid approximate location', () => {
        const result = ApproximateLocationSchema.safeParse({
            lat: -30.7521,
            lng: -58.0429,
            radiusMeters: 500
        });

        expect(result.success).toBe(true);
    });

    it('rejects lat outside [-90, 90]', () => {
        expect(
            ApproximateLocationSchema.safeParse({
                lat: 91,
                lng: 0,
                radiusMeters: 500
            }).success
        ).toBe(false);
        expect(
            ApproximateLocationSchema.safeParse({
                lat: -91,
                lng: 0,
                radiusMeters: 500
            }).success
        ).toBe(false);
    });

    it('rejects lng outside [-180, 180]', () => {
        expect(
            ApproximateLocationSchema.safeParse({
                lat: 0,
                lng: 181,
                radiusMeters: 500
            }).success
        ).toBe(false);
        expect(
            ApproximateLocationSchema.safeParse({
                lat: 0,
                lng: -181,
                radiusMeters: 500
            }).success
        ).toBe(false);
    });

    it('rejects non-positive or non-integer radius', () => {
        expect(
            ApproximateLocationSchema.safeParse({
                lat: 0,
                lng: 0,
                radiusMeters: 0
            }).success
        ).toBe(false);
        expect(
            ApproximateLocationSchema.safeParse({
                lat: 0,
                lng: 0,
                radiusMeters: -10
            }).success
        ).toBe(false);
        expect(
            ApproximateLocationSchema.safeParse({
                lat: 0,
                lng: 0,
                radiusMeters: 500.5
            }).success
        ).toBe(false);
    });

    it('rejects string lat/lng (must be numbers, not the legacy string format)', () => {
        expect(
            ApproximateLocationSchema.safeParse({
                lat: '-30.7521',
                lng: '-58.0429',
                radiusMeters: 500
            }).success
        ).toBe(false);
    });
});
