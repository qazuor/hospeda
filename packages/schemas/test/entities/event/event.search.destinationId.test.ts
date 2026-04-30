/**
 * Tests for destinationId filter in EventSearchSchema and EventSearchHttpSchema
 * (SPEC-096 / REQ-096-02 — Zod-only portion, T-004 partial).
 *
 * Both schemas already expose `destinationId: z.string().uuid().optional()`.
 * These tests verify that the field is accepted, validated as UUID, and optional.
 */
import { describe, expect, it } from 'vitest';
import { EventSearchHttpSchema } from '../../../src/entities/event/event.http.schema.js';
import { EventSearchSchema } from '../../../src/entities/event/event.query.schema.js';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const INVALID_UUID = 'not-a-uuid';

// ---------------------------------------------------------------------------
// EventSearchSchema (domain)
// ---------------------------------------------------------------------------

describe('EventSearchSchema — destinationId', () => {
    describe('happy path', () => {
        it('should accept a valid UUID as destinationId', () => {
            // Arrange
            const input = { destinationId: VALID_UUID };

            // Act
            const result = EventSearchSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.destinationId).toBe(VALID_UUID);
            }
        });

        it('should be optional — omitting destinationId passes', () => {
            const result = EventSearchSchema.safeParse({});
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.destinationId).toBeUndefined();
            }
        });

        it('should coexist with other filters without interference', () => {
            const result = EventSearchSchema.safeParse({
                destinationId: VALID_UUID,
                q: 'festival',
                page: 1,
                pageSize: 10
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.destinationId).toBe(VALID_UUID);
                expect(result.data.q).toBe('festival');
            }
        });
    });

    describe('validation', () => {
        it('should reject a malformed (non-UUID) destinationId', () => {
            // Arrange
            const result = EventSearchSchema.safeParse({ destinationId: INVALID_UUID });

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues.some((i) => i.path.includes('destinationId'))).toBe(
                    true
                );
            }
        });

        it('should reject a plain integer as destinationId', () => {
            const result = EventSearchSchema.safeParse({ destinationId: 42 });
            expect(result.success).toBe(false);
        });
    });
});

// ---------------------------------------------------------------------------
// EventSearchHttpSchema (HTTP / query-string)
// ---------------------------------------------------------------------------

describe('EventSearchHttpSchema — destinationId', () => {
    describe('happy path', () => {
        it('should accept a valid UUID as destinationId', () => {
            // Arrange
            const input = { destinationId: VALID_UUID };

            // Act
            const result = EventSearchHttpSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.destinationId).toBe(VALID_UUID);
            }
        });

        it('should be optional — omitting destinationId passes', () => {
            const result = EventSearchHttpSchema.safeParse({});
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.destinationId).toBeUndefined();
            }
        });

        it('should coexist with other HTTP filters', () => {
            const result = EventSearchHttpSchema.safeParse({
                destinationId: VALID_UUID,
                category: 'MUSIC',
                isFeatured: 'true',
                page: '1',
                pageSize: '10'
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.destinationId).toBe(VALID_UUID);
            }
        });
    });

    describe('validation', () => {
        it('should reject a malformed destinationId', () => {
            // Arrange
            const result = EventSearchHttpSchema.safeParse({ destinationId: INVALID_UUID });

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues.some((i) => i.path.includes('destinationId'))).toBe(
                    true
                );
            }
        });
    });
});
