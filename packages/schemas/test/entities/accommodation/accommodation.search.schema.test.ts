import { describe, expect, it } from 'vitest';
import { AccommodationSearchHttpSchema } from '../../../src/entities/accommodation/accommodation.http.schema.js';
import { AccommodationSearchSchema } from '../../../src/entities/accommodation/accommodation.query.schema.js';

const VALID_UUID_1 = '550e8400-e29b-41d4-a716-446655440000';
const VALID_UUID_2 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const INVALID_UUID = 'not-a-valid-uuid';

describe('AccommodationSearchSchema (domain)', () => {
    describe('amenities field', () => {
        it('should accept an array of valid UUIDs', () => {
            // Arrange
            const input = { amenities: [VALID_UUID_1, VALID_UUID_2] };

            // Act
            const result = AccommodationSearchSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.amenities).toEqual([VALID_UUID_1, VALID_UUID_2]);
            }
        });

        it('should accept an empty array', () => {
            const result = AccommodationSearchSchema.safeParse({ amenities: [] });
            expect(result.success).toBe(true);
        });

        it('should reject non-UUID strings in the array', () => {
            const result = AccommodationSearchSchema.safeParse({
                amenities: [VALID_UUID_1, INVALID_UUID]
            });
            expect(result.success).toBe(false);
        });

        it('should be optional (undefined passes)', () => {
            const result = AccommodationSearchSchema.safeParse({});
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.amenities).toBeUndefined();
            }
        });
    });

    describe('features field', () => {
        it('should accept an array of valid UUIDs', () => {
            // Arrange
            const input = { features: [VALID_UUID_1] };

            // Act
            const result = AccommodationSearchSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.features).toEqual([VALID_UUID_1]);
            }
        });

        it('should reject non-UUID strings in the array', () => {
            const result = AccommodationSearchSchema.safeParse({
                features: [INVALID_UUID]
            });
            expect(result.success).toBe(false);
        });

        it('should be optional (undefined passes)', () => {
            const result = AccommodationSearchSchema.safeParse({});
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.features).toBeUndefined();
            }
        });
    });

    describe('combined filters', () => {
        it('should accept both amenities and features simultaneously', () => {
            const input = {
                amenities: [VALID_UUID_1],
                features: [VALID_UUID_2]
            };
            const result = AccommodationSearchSchema.safeParse(input);
            expect(result.success).toBe(true);
        });
    });
});

describe('AccommodationSearchHttpSchema (HTTP / query-string)', () => {
    describe('amenities field — comma-separated string', () => {
        it('should parse a comma-separated string of UUIDs into an array', () => {
            // Arrange — simulates ?amenities=uuid1,uuid2
            const input = { amenities: `${VALID_UUID_1},${VALID_UUID_2}` };

            // Act
            const result = AccommodationSearchHttpSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.amenities).toEqual([VALID_UUID_1, VALID_UUID_2]);
            }
        });

        it('should parse a single UUID string without comma', () => {
            const result = AccommodationSearchHttpSchema.safeParse({
                amenities: VALID_UUID_1
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.amenities).toEqual([VALID_UUID_1]);
            }
        });

        it('should reject a comma-separated string containing a malformed UUID', () => {
            // Arrange — one valid, one malformed
            const input = { amenities: `${VALID_UUID_1},${INVALID_UUID}` };

            // Act
            const result = AccommodationSearchHttpSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject a string that is just an invalid UUID', () => {
            const result = AccommodationSearchHttpSchema.safeParse({
                amenities: INVALID_UUID
            });
            expect(result.success).toBe(false);
        });
    });

    describe('amenities field — repeated query params (array)', () => {
        it('should accept an array of valid UUIDs (repeated params)', () => {
            // Arrange — simulates ?amenities=uuid1&amenities=uuid2
            const input = { amenities: [VALID_UUID_1, VALID_UUID_2] };

            // Act
            const result = AccommodationSearchHttpSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.amenities).toEqual([VALID_UUID_1, VALID_UUID_2]);
            }
        });

        it('should reject an array containing a malformed UUID', () => {
            const result = AccommodationSearchHttpSchema.safeParse({
                amenities: [VALID_UUID_1, INVALID_UUID]
            });
            expect(result.success).toBe(false);
        });

        it('should accept an empty array', () => {
            const result = AccommodationSearchHttpSchema.safeParse({ amenities: [] });
            expect(result.success).toBe(true);
        });
    });

    describe('amenities field — optional', () => {
        it('should be optional (undefined passes)', () => {
            const result = AccommodationSearchHttpSchema.safeParse({});
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.amenities).toBeUndefined();
            }
        });
    });

    describe('features field — comma-separated string', () => {
        it('should parse a comma-separated string of UUIDs into an array', () => {
            const input = { features: `${VALID_UUID_1},${VALID_UUID_2}` };
            const result = AccommodationSearchHttpSchema.safeParse(input);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.features).toEqual([VALID_UUID_1, VALID_UUID_2]);
            }
        });

        it('should reject a comma-separated string containing a malformed UUID', () => {
            const result = AccommodationSearchHttpSchema.safeParse({
                features: `${VALID_UUID_1},${INVALID_UUID}`
            });
            expect(result.success).toBe(false);
        });
    });

    describe('features field — repeated query params (array)', () => {
        it('should accept an array of valid UUIDs (repeated params)', () => {
            const result = AccommodationSearchHttpSchema.safeParse({
                features: [VALID_UUID_1, VALID_UUID_2]
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.features).toEqual([VALID_UUID_1, VALID_UUID_2]);
            }
        });

        it('should reject an array containing a malformed UUID', () => {
            const result = AccommodationSearchHttpSchema.safeParse({
                features: [INVALID_UUID]
            });
            expect(result.success).toBe(false);
        });
    });

    describe('features field — optional', () => {
        it('should be optional (undefined passes)', () => {
            const result = AccommodationSearchHttpSchema.safeParse({});
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.features).toBeUndefined();
            }
        });
    });

    describe('combined amenities + features', () => {
        it('should accept both fields as comma-separated strings', () => {
            const result = AccommodationSearchHttpSchema.safeParse({
                amenities: VALID_UUID_1,
                features: VALID_UUID_2
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.amenities).toEqual([VALID_UUID_1]);
                expect(result.data.features).toEqual([VALID_UUID_2]);
            }
        });

        it('should reject when either field has a malformed UUID', () => {
            const result = AccommodationSearchHttpSchema.safeParse({
                amenities: VALID_UUID_1,
                features: INVALID_UUID
            });
            expect(result.success).toBe(false);
        });
    });
});
