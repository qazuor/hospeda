/**
 * HOS-113 T-002 — pgEnum tuple-parity tests.
 *
 * Verifies that Drizzle `pgEnum` definitions in `enums.dbschema.ts` carry the
 * exact same value set as their `@repo/schemas` TypeScript enum counterpart.
 * These are in-process tests — they inspect the `enumValues` metadata that
 * `drizzle-orm/pg-core`'s `pgEnum()` attaches to the returned column builder
 * and do NOT require a running PostgreSQL instance.
 */
import { PointOfInterestTypeEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';

import { PointOfInterestTypePgEnum } from '../../src/schemas/enums.dbschema.ts';

describe('PointOfInterestTypePgEnum', () => {
    it('has SQL enum name point_of_interest_type_enum', () => {
        expect(PointOfInterestTypePgEnum.enumName).toBe('point_of_interest_type_enum');
    });

    it('value tuple matches PointOfInterestTypeEnum exactly (same values, same order)', () => {
        // Arrange
        const expected = Object.values(PointOfInterestTypeEnum);

        // Act
        const actual = PointOfInterestTypePgEnum.enumValues;

        // Assert
        expect(actual).toEqual(expected);
    });

    it('has exactly 9 values', () => {
        expect(PointOfInterestTypePgEnum.enumValues).toHaveLength(9);
    });
});
