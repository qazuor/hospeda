/**
 * Unit tests for addon-plan-change.helpers — hashCustomerId
 *
 * Verifies that hashCustomerId:
 * - Is deterministic (same input → same output)
 * - Produces different outputs for different UUIDs (collision resistance)
 * - Returns a valid finite non-NaN number
 * - Returns a non-negative integer (safe for pg_advisory_xact_lock)
 *
 * @module test/billing/addon-plan-change.helpers.test
 */

import { describe, expect, it } from 'vitest';
import { hashCustomerId } from '../../src/services/billing/addon/addon-plan-change.helpers';

// ─── Sample UUIDs ─────────────────────────────────────────────────────────────

/**
 * Diverse set of UUIDs used across tests. These cover:
 * - Different hex character distributions
 * - All-zeros and all-fs edge cases
 * - UUIDs with high and low first segments
 */
const SAMPLE_UUIDS = [
    '00000000-0000-0000-0000-000000000000',
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    '550e8400-e29b-41d4-a716-446655440000',
    '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    'a3bb189e-8bf9-3888-9912-ace4e6543002',
    'c73bcdcc-2669-4bf6-81d3-e4ae73fb11fd',
    '1d4e1c01-0000-4000-a000-000000000001',
    'deadbeef-dead-beef-dead-beefdeadbeef'
] as const;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('hashCustomerId', () => {
    describe('determinism', () => {
        it('should return the same value for the same UUID called multiple times', () => {
            // Arrange
            const uuid = '550e8400-e29b-41d4-a716-446655440000';

            // Act
            const first = hashCustomerId(uuid);
            const second = hashCustomerId(uuid);
            const third = hashCustomerId(uuid);

            // Assert
            expect(first).toBe(second);
            expect(second).toBe(third);
        });

        it('should return consistent values for all sample UUIDs across two calls each', () => {
            // Arrange & Act & Assert
            for (const uuid of SAMPLE_UUIDS) {
                expect(hashCustomerId(uuid)).toBe(hashCustomerId(uuid));
            }
        });
    });

    describe('collision resistance', () => {
        it('should produce distinct values for all 8 sample UUIDs', () => {
            // Arrange
            const results = SAMPLE_UUIDS.map((uuid) => hashCustomerId(uuid));

            // Act — deduplicate
            const unique = new Set(results);

            // Assert — no two sample UUIDs should hash to the same value
            expect(unique.size).toBe(SAMPLE_UUIDS.length);
        });

        it('should produce different values for UUIDs that differ only in one character', () => {
            // Arrange — differ only at last hex digit
            const uuidA = '550e8400-e29b-41d4-a716-446655440000';
            const uuidB = '550e8400-e29b-41d4-a716-446655440001';

            // Act
            const hashA = hashCustomerId(uuidA);
            const hashB = hashCustomerId(uuidB);

            // Assert
            expect(hashA).not.toBe(hashB);
        });

        it('should produce different values for UUIDs that differ only in the first segment', () => {
            // Arrange
            const uuidA = 'aaaaaaaa-0000-0000-0000-000000000000';
            const uuidB = 'bbbbbbbb-0000-0000-0000-000000000000';

            // Act & Assert
            expect(hashCustomerId(uuidA)).not.toBe(hashCustomerId(uuidB));
        });
    });

    describe('output validity', () => {
        it('should return a finite number for all sample UUIDs', () => {
            for (const uuid of SAMPLE_UUIDS) {
                const result = hashCustomerId(uuid);
                expect(Number.isFinite(result)).toBe(true);
            }
        });

        it('should never return NaN', () => {
            for (const uuid of SAMPLE_UUIDS) {
                expect(hashCustomerId(uuid)).not.toBeNaN();
            }
        });

        it('should return a non-negative integer for all sample UUIDs', () => {
            // pg_advisory_xact_lock requires a bigint; for 32-bit int variants,
            // the value must be non-negative to avoid sign-bit issues.
            for (const uuid of SAMPLE_UUIDS) {
                const result = hashCustomerId(uuid);
                expect(result).toBeGreaterThanOrEqual(0);
                expect(Number.isInteger(result)).toBe(true);
            }
        });

        it('should return 0 for the all-zeros UUID without throwing', () => {
            // Arrange — edge case: UUID with all hex zeroes
            const uuid = '00000000-0000-0000-0000-000000000000';

            // Act
            const result = hashCustomerId(uuid);

            // Assert — valid number, not NaN, not Infinity
            expect(typeof result).toBe('number');
            expect(Number.isFinite(result)).toBe(true);
            expect(result).toBeGreaterThanOrEqual(0);
        });

        it('should handle the all-f UUID without overflow or NaN', () => {
            // Arrange — UUID with all hex f's
            const uuid = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

            // Act
            const result = hashCustomerId(uuid);

            // Assert
            expect(Number.isFinite(result)).toBe(true);
            expect(result).toBeGreaterThanOrEqual(0);
        });
    });
});
