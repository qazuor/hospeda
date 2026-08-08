/**
 * pgEnum tuple-parity tests (HOS-113 T-002, extended by HOS-377 T-002).
 *
 * Verifies that Drizzle `pgEnum` definitions in `enums.dbschema.ts` carry the
 * exact same value set as their `@repo/schemas` TypeScript enum counterpart.
 * These are in-process tests — they inspect the `enumValues` metadata that
 * `drizzle-orm/pg-core`'s `pgEnum()` attaches to the returned column builder
 * and do NOT require a running PostgreSQL instance.
 *
 * NOTE: `test/enum-consistency.test.ts` checks the same enums against a LIVE
 * database, but it is excluded in `vitest.config.ts` and therefore never runs
 * in the normal suite. These in-process tests are the coverage that actually
 * executes — do not assume the live-DB file has your back.
 */
import { PartnerMentionChannelEnum, PointOfInterestTypeEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';

import {
    PartnerMentionChannelPgEnum,
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

describe('PartnerMentionChannelPgEnum', () => {
    it('has SQL enum name partner_mention_channel_enum', () => {
        // The name is a hand-typed literal, NOT derived from the TS enum. It is
        // what the migration writes into Postgres and what the (excluded) live-DB
        // consistency check reconstructs by snake_casing `PartnerMentionChannelEnum`.
        // A typo here is only discoverable at migrate time.
        expect(PartnerMentionChannelPgEnum.enumName).toBe('partner_mention_channel_enum');
    });

    it('value tuple matches PartnerMentionChannelEnum exactly (same values, same order)', () => {
        // Arrange
        const expected = Object.values(PartnerMentionChannelEnum);

        // Act
        const actual = PartnerMentionChannelPgEnum.enumValues;

        // Assert
        expect(actual).toEqual(expected);
    });

    it('has exactly 8 values', () => {
        expect(PartnerMentionChannelPgEnum.enumValues).toHaveLength(8);
    });

    it('carries TWITTER, not X — the social pipeline naming must not leak in', () => {
        // `SocialPlatformEnum` calls the same platform `X`. These literals are
        // written into a Postgres type by the migration, so correcting a wrong
        // one later is a data migration, not an edit.
        expect(PartnerMentionChannelPgEnum.enumValues).toContain('TWITTER');
        expect(PartnerMentionChannelPgEnum.enumValues).not.toContain('X');
    });
});
