import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { PartnerMentionChannelEnum } from '../../src/enums/partner-mention-channel.enum.js';
import {
    PARTNER_MENTION_CHANNELS_REQUIRING_URL,
    PartnerMentionChannelEnumSchema,
    requiresMentionUrl
} from '../../src/enums/partner-mention-channel.schema.js';

// ============================================================================
// PartnerMentionChannelEnum — HOS-377 T-001
// ============================================================================

describe('PartnerMentionChannelEnum', () => {
    describe('enum values', () => {
        it('should define INSTAGRAM', () => {
            expect(PartnerMentionChannelEnum.INSTAGRAM).toBe('INSTAGRAM');
        });

        it('should define FACEBOOK', () => {
            expect(PartnerMentionChannelEnum.FACEBOOK).toBe('FACEBOOK');
        });

        it('should define TWITTER', () => {
            expect(PartnerMentionChannelEnum.TWITTER).toBe('TWITTER');
        });

        it('should define YOUTUBE', () => {
            expect(PartnerMentionChannelEnum.YOUTUBE).toBe('YOUTUBE');
        });

        it('should define TIKTOK', () => {
            expect(PartnerMentionChannelEnum.TIKTOK).toBe('TIKTOK');
        });

        it('should define NEWSLETTER', () => {
            expect(PartnerMentionChannelEnum.NEWSLETTER).toBe('NEWSLETTER');
        });

        it('should define WHATSAPP', () => {
            expect(PartnerMentionChannelEnum.WHATSAPP).toBe('WHATSAPP');
        });

        it('should define OTHER', () => {
            expect(PartnerMentionChannelEnum.OTHER).toBe('OTHER');
        });

        it('should have exactly 8 values', () => {
            expect(Object.values(PartnerMentionChannelEnum)).toHaveLength(8);
        });

        it('should NOT define PRESS — dropped by the owner from the original draft', () => {
            // Guards against someone re-adding the draft value from the spec's first
            // revision. A stray channel here would be silently accepted everywhere.
            expect(Object.values(PartnerMentionChannelEnum)).not.toContain('PRESS');
        });
    });

    describe('PartnerMentionChannelEnumSchema', () => {
        it('should accept all defined enum values', () => {
            // Arrange
            const values = Object.values(PartnerMentionChannelEnum);
            // Act / Assert
            for (const value of values) {
                expect(PartnerMentionChannelEnumSchema.safeParse(value).success).toBe(true);
            }
        });

        it('should reject an unknown channel with ZodError', () => {
            // Arrange / Act
            const result = PartnerMentionChannelEnumSchema.safeParse('LINKEDIN');
            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(ZodError);
            }
        });

        it('should reject "PRESS"', () => {
            expect(PartnerMentionChannelEnumSchema.safeParse('PRESS').success).toBe(false);
        });

        it('should reject "X" — this enum names the platform TWITTER', () => {
            // SocialPlatformEnum uses `X` for the same platform. The two lists are
            // independent on purpose; accepting `X` here would let the wrong one leak in.
            expect(PartnerMentionChannelEnumSchema.safeParse('X').success).toBe(false);
        });

        it('should reject lowercase variant', () => {
            expect(PartnerMentionChannelEnumSchema.safeParse('instagram').success).toBe(false);
        });

        it('should reject empty string', () => {
            expect(PartnerMentionChannelEnumSchema.safeParse('').success).toBe(false);
        });

        it('should return the enum member when parsing a valid value', () => {
            // Arrange / Act
            const parsed = PartnerMentionChannelEnumSchema.parse('NEWSLETTER');
            // Assert
            expect(parsed).toBe(PartnerMentionChannelEnum.NEWSLETTER);
        });

        it('should throw ZodError on parse of an invalid value', () => {
            expect(() => PartnerMentionChannelEnumSchema.parse('INVALID')).toThrowError(ZodError);
        });
    });

    describe('PARTNER_MENTION_CHANNELS_REQUIRING_URL', () => {
        it('should require a URL for exactly the six permalink channels', () => {
            // Arrange / Act / Assert
            expect([...PARTNER_MENTION_CHANNELS_REQUIRING_URL]).toEqual([
                PartnerMentionChannelEnum.INSTAGRAM,
                PartnerMentionChannelEnum.FACEBOOK,
                PartnerMentionChannelEnum.TWITTER,
                PartnerMentionChannelEnum.YOUTUBE,
                PartnerMentionChannelEnum.TIKTOK,
                PartnerMentionChannelEnum.NEWSLETTER
            ]);
        });

        it('should partition every channel — no member is left undecided', () => {
            // Arrange: the union of "requires URL" and "does not" must be the whole enum.
            // Adding a channel without deciding its URL rule fails here rather than
            // silently defaulting to optional at the batch-schema refinement.
            const all = Object.values(PartnerMentionChannelEnum);
            // Act
            const notRequiring = all.filter((channel) => !requiresMentionUrl({ channel }));
            // Assert
            expect(notRequiring).toEqual([
                PartnerMentionChannelEnum.WHATSAPP,
                PartnerMentionChannelEnum.OTHER
            ]);
            expect(PARTNER_MENTION_CHANNELS_REQUIRING_URL.length + notRequiring.length).toBe(
                all.length
            );
        });
    });

    describe('requiresMentionUrl', () => {
        it('should return true for INSTAGRAM', () => {
            expect(requiresMentionUrl({ channel: PartnerMentionChannelEnum.INSTAGRAM })).toBe(true);
        });

        it('should return true for NEWSLETTER', () => {
            expect(requiresMentionUrl({ channel: PartnerMentionChannelEnum.NEWSLETTER })).toBe(
                true
            );
        });

        it('should return false for WHATSAPP — a broadcast has no public permalink', () => {
            expect(requiresMentionUrl({ channel: PartnerMentionChannelEnum.WHATSAPP })).toBe(false);
        });

        it('should return false for OTHER — unknown channel, unknowable URL', () => {
            expect(requiresMentionUrl({ channel: PartnerMentionChannelEnum.OTHER })).toBe(false);
        });
    });
});
