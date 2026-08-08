import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { HostTradeUsageChannelEnum } from '../../src/enums/host-trade-usage-channel.enum.js';
import { HostTradeUsageChannelEnumSchema } from '../../src/enums/host-trade-usage-channel.schema.js';
import { HostTradeUsageDeclaredByEnum } from '../../src/enums/host-trade-usage-declared-by.enum.js';
import { HostTradeUsageDeclaredByEnumSchema } from '../../src/enums/host-trade-usage-declared-by.schema.js';
import { HostTradeUsageStatusEnum } from '../../src/enums/host-trade-usage-status.enum.js';
import { HostTradeUsageStatusEnumSchema } from '../../src/enums/host-trade-usage-status.schema.js';

// ============================================================================
// HOS-376 T-001 — the three enums of the benefit-usage record.
//
// These three are a closed set on purpose: the usage record is the ONLY thing
// standing between a provider and a public reputation, so every value it can
// take has to be enumerable and reviewable. Free-form strings here would make
// "only confirmed usages count" unverifiable.
// ============================================================================

describe('HostTradeUsageStatusEnum', () => {
    describe('enum values', () => {
        it('should define PENDING', () => {
            expect(HostTradeUsageStatusEnum.PENDING).toBe('PENDING');
        });

        it('should define CONFIRMED', () => {
            expect(HostTradeUsageStatusEnum.CONFIRMED).toBe('CONFIRMED');
        });

        it('should define REJECTED', () => {
            expect(HostTradeUsageStatusEnum.REJECTED).toBe('REJECTED');
        });

        it('should define EXPIRED', () => {
            expect(HostTradeUsageStatusEnum.EXPIRED).toBe('EXPIRED');
        });

        it('should have exactly 4 values', () => {
            expect(Object.values(HostTradeUsageStatusEnum)).toHaveLength(4);
        });

        it('should NOT define an auto-confirmed state (silence never validates)', () => {
            // Deliberate: HOS-376 NG-2 rejected time-based auto-confirmation
            // because it turns silence into consent, which is the exact abuse
            // door the confirmation step exists to close. An elapsed request
            // becomes EXPIRED and counts for nothing.
            expect(Object.values(HostTradeUsageStatusEnum)).not.toContain('AUTO_CONFIRMED');
        });
    });

    describe('HostTradeUsageStatusEnumSchema', () => {
        it('should accept every defined value', () => {
            for (const value of Object.values(HostTradeUsageStatusEnum)) {
                expect(HostTradeUsageStatusEnumSchema.safeParse(value).success).toBe(true);
            }
        });

        it('should reject an unknown status with ZodError', () => {
            const result = HostTradeUsageStatusEnumSchema.safeParse('CANCELLED');
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(ZodError);
            }
        });

        it('should reject a lowercase variant', () => {
            expect(HostTradeUsageStatusEnumSchema.safeParse('pending').success).toBe(false);
        });

        it('should reject an empty string', () => {
            expect(HostTradeUsageStatusEnumSchema.safeParse('').success).toBe(false);
        });

        it('should use the invalid message key on rejection', () => {
            const result = HostTradeUsageStatusEnumSchema.safeParse('INVALID');
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0]?.message).toBe(
                    'zodError.enums.hostTradeUsageStatus.invalid'
                );
            }
        });

        it('should return the enum member when parsing a valid value', () => {
            expect(HostTradeUsageStatusEnumSchema.parse('CONFIRMED')).toBe(
                HostTradeUsageStatusEnum.CONFIRMED
            );
        });
    });
});

describe('HostTradeUsageDeclaredByEnum', () => {
    describe('enum values', () => {
        it('should define PROVIDER', () => {
            expect(HostTradeUsageDeclaredByEnum.PROVIDER).toBe('PROVIDER');
        });

        it('should define HOST', () => {
            expect(HostTradeUsageDeclaredByEnum.HOST).toBe('HOST');
        });

        it('should have exactly 2 values', () => {
            // Both directions exist on purpose (HOS-376 OQ-1): if only the
            // provider could declare, the provider would decide which jobs are
            // reviewable at all and simply never declare the bad ones.
            expect(Object.values(HostTradeUsageDeclaredByEnum)).toHaveLength(2);
        });
    });

    describe('HostTradeUsageDeclaredByEnumSchema', () => {
        it('should accept every defined value', () => {
            for (const value of Object.values(HostTradeUsageDeclaredByEnum)) {
                expect(HostTradeUsageDeclaredByEnumSchema.safeParse(value).success).toBe(true);
            }
        });

        it('should reject an unknown declarer with ZodError', () => {
            const result = HostTradeUsageDeclaredByEnumSchema.safeParse('ADMIN');
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(ZodError);
            }
        });

        it('should reject a lowercase variant', () => {
            expect(HostTradeUsageDeclaredByEnumSchema.safeParse('host').success).toBe(false);
        });

        it('should use the invalid message key on rejection', () => {
            const result = HostTradeUsageDeclaredByEnumSchema.safeParse('INVALID');
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0]?.message).toBe(
                    'zodError.enums.hostTradeUsageDeclaredBy.invalid'
                );
            }
        });

        it('should return the enum member when parsing a valid value', () => {
            expect(HostTradeUsageDeclaredByEnumSchema.parse('HOST')).toBe(
                HostTradeUsageDeclaredByEnum.HOST
            );
        });
    });
});

describe('HostTradeUsageChannelEnum', () => {
    describe('enum values', () => {
        it('should define QR', () => {
            expect(HostTradeUsageChannelEnum.QR).toBe('QR');
        });

        it('should define LINKED_SELECTOR', () => {
            expect(HostTradeUsageChannelEnum.LINKED_SELECTOR).toBe('LINKED_SELECTOR');
        });

        it('should define EMAIL_LOOKUP', () => {
            expect(HostTradeUsageChannelEnum.EMAIL_LOOKUP).toBe('EMAIL_LOOKUP');
        });

        it('should have exactly 3 values', () => {
            expect(Object.values(HostTradeUsageChannelEnum)).toHaveLength(3);
        });

        it('should keep EMAIL_LOOKUP distinguishable from the other two', () => {
            // The channel is not decoration: EMAIL_LOOKUP is the only path where
            // a provider names a host who never scanned anything, so it is the
            // one an admin audits for spray. Collapsing the three into a single
            // "manual" value would erase that signal.
            expect(HostTradeUsageChannelEnum.EMAIL_LOOKUP).not.toBe(
                HostTradeUsageChannelEnum.LINKED_SELECTOR
            );
            expect(HostTradeUsageChannelEnum.EMAIL_LOOKUP).not.toBe(HostTradeUsageChannelEnum.QR);
        });
    });

    describe('HostTradeUsageChannelEnumSchema', () => {
        it('should accept every defined value', () => {
            for (const value of Object.values(HostTradeUsageChannelEnum)) {
                expect(HostTradeUsageChannelEnumSchema.safeParse(value).success).toBe(true);
            }
        });

        it('should reject an unknown channel with ZodError', () => {
            const result = HostTradeUsageChannelEnumSchema.safeParse('SMS');
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(ZodError);
            }
        });

        it('should reject a lowercase variant', () => {
            expect(HostTradeUsageChannelEnumSchema.safeParse('qr').success).toBe(false);
        });

        it('should use the invalid message key on rejection', () => {
            const result = HostTradeUsageChannelEnumSchema.safeParse('INVALID');
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0]?.message).toBe(
                    'zodError.enums.hostTradeUsageChannel.invalid'
                );
            }
        });

        it('should return the enum member when parsing a valid value', () => {
            expect(HostTradeUsageChannelEnumSchema.parse('QR')).toBe(HostTradeUsageChannelEnum.QR);
        });
    });
});
