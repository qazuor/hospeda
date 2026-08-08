/**
 * HOS-113 T-002 — pgEnum tuple-parity tests.
 *
 * Verifies that Drizzle `pgEnum` definitions in `enums.dbschema.ts` carry the
 * exact same value set as their `@repo/schemas` TypeScript enum counterpart.
 * These are in-process tests — they inspect the `enumValues` metadata that
 * `drizzle-orm/pg-core`'s `pgEnum()` attaches to the returned column builder
 * and do NOT require a running PostgreSQL instance.
 */
import {
    HostTradeUsageChannelEnum,
    HostTradeUsageDeclaredByEnum,
    HostTradeUsageStatusEnum,
    PointOfInterestTypeEnum
} from '@repo/schemas';
import { describe, expect, it } from 'vitest';

import {
    HostTradeUsageChannelPgEnum,
    HostTradeUsageDeclaredByPgEnum,
    HostTradeUsageStatusPgEnum,
    PointOfInterestTypePgEnum
} from '../../src/schemas/enums.dbschema.ts';

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

// HOS-376 T-006/T-007/T-008 — host trade benefit usage enums.
describe('HostTradeUsageStatusPgEnum', () => {
    it('has SQL enum name host_trade_usage_status_enum', () => {
        expect(HostTradeUsageStatusPgEnum.enumName).toBe('host_trade_usage_status_enum');
    });

    it('value tuple matches HostTradeUsageStatusEnum exactly (same values, same order)', () => {
        const expected = Object.values(HostTradeUsageStatusEnum);
        const actual = HostTradeUsageStatusPgEnum.enumValues;
        expect(actual).toEqual(expected);
    });

    it('has exactly 4 values: PENDING, CONFIRMED, REJECTED, EXPIRED', () => {
        expect(HostTradeUsageStatusPgEnum.enumValues).toHaveLength(4);
        expect(HostTradeUsageStatusPgEnum.enumValues).toEqual([
            'PENDING',
            'CONFIRMED',
            'REJECTED',
            'EXPIRED'
        ]);
    });
});

describe('HostTradeUsageDeclaredByPgEnum', () => {
    it('has SQL enum name host_trade_usage_declared_by_enum', () => {
        expect(HostTradeUsageDeclaredByPgEnum.enumName).toBe('host_trade_usage_declared_by_enum');
    });

    it('value tuple matches HostTradeUsageDeclaredByEnum exactly (same values, same order)', () => {
        const expected = Object.values(HostTradeUsageDeclaredByEnum);
        const actual = HostTradeUsageDeclaredByPgEnum.enumValues;
        expect(actual).toEqual(expected);
    });

    it('has exactly 2 values: PROVIDER, HOST', () => {
        expect(HostTradeUsageDeclaredByPgEnum.enumValues).toHaveLength(2);
        expect(HostTradeUsageDeclaredByPgEnum.enumValues).toEqual(['PROVIDER', 'HOST']);
    });
});

describe('HostTradeUsageChannelPgEnum', () => {
    it('has SQL enum name host_trade_usage_channel_enum', () => {
        expect(HostTradeUsageChannelPgEnum.enumName).toBe('host_trade_usage_channel_enum');
    });

    it('value tuple matches HostTradeUsageChannelEnum exactly (same values, same order)', () => {
        const expected = Object.values(HostTradeUsageChannelEnum);
        const actual = HostTradeUsageChannelPgEnum.enumValues;
        expect(actual).toEqual(expected);
    });

    it('has exactly 3 values: QR, LINKED_SELECTOR, EMAIL_LOOKUP', () => {
        expect(HostTradeUsageChannelPgEnum.enumValues).toHaveLength(3);
        expect(HostTradeUsageChannelPgEnum.enumValues).toEqual([
            'QR',
            'LINKED_SELECTOR',
            'EMAIL_LOOKUP'
        ]);
    });
});
