/**
 * Unit tests for `TourProgressBodySchema` (SPEC-174 T-001).
 *
 * Covers the HTTP request body schema defined in
 * `packages/schemas/src/entities/user/user.tour-progress.schema.ts`.
 *
 * Mirrors the structure of `whats-new.http.schema.test.ts` (SPEC-175 T-001).
 */
import { describe, expect, it } from 'vitest';
import { TourProgressBodySchema } from '../../../src/entities/user/user.tour-progress.schema.js';

describe('TourProgressBodySchema', () => {
    describe('when given valid input', () => {
        it('should parse a typical tour id and version', () => {
            // Arrange
            const input = { tourId: 'host.welcome', version: 1 };

            // Act
            const result = TourProgressBodySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.tourId).toBe('host.welcome');
                expect(result.data.version).toBe(1);
            }
        });

        it('should parse version = 0 (non-negative lower bound)', () => {
            // Arrange
            const input = { tourId: 'admin.welcome', version: 0 };

            // Act
            const result = TourProgressBodySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.version).toBe(0);
            }
        });

        it('should parse a contextual tour id at max version', () => {
            // Arrange
            const input = { tourId: 'editor.analisis', version: 99 };

            // Act
            const result = TourProgressBodySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should parse a tourId exactly 100 characters long', () => {
            // Arrange — 100-char id is at the boundary and must be accepted
            const input = { tourId: 'a'.repeat(100), version: 1 };

            // Act
            const result = TourProgressBodySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });
    });

    describe('when given invalid input', () => {
        it('should reject an empty tourId', () => {
            // Arrange
            const input = { tourId: '', version: 1 };

            // Act
            const result = TourProgressBodySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject a tourId longer than 100 characters', () => {
            // Arrange — 101 chars exceeds the defensive cap
            const input = { tourId: 'a'.repeat(101), version: 1 };

            // Act
            const result = TourProgressBodySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject a negative version', () => {
            // Arrange
            const input = { tourId: 'host.welcome', version: -1 };

            // Act
            const result = TourProgressBodySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject a float version', () => {
            // Arrange — must be an integer
            const input = { tourId: 'host.welcome', version: 1.5 };

            // Act
            const result = TourProgressBodySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject when tourId is missing', () => {
            // Arrange
            const input = { version: 1 };

            // Act
            const result = TourProgressBodySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject when version is missing', () => {
            // Arrange
            const input = { tourId: 'host.welcome' };

            // Act
            const result = TourProgressBodySchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });
});
