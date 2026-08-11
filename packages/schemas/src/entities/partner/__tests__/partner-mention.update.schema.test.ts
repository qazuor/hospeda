import { describe, expect, it } from 'vitest';
import { PartnerMentionChannelEnum } from '../../../enums/partner-mention-channel.enum.js';
import { adminSearchPartnerMentionSchema } from '../partner-mention.admin-search.schema.js';
import { updatePartnerMentionSchema } from '../partner-mention.update.schema.js';

// ============================================================================
// updatePartnerMentionSchema / adminSearchPartnerMentionSchema — HOS-377 T-007
// ============================================================================

const URL = 'https://instagram.com/p/abc123';

describe('updatePartnerMentionSchema', () => {
    it('accepts an empty patch', () => {
        expect(updatePartnerMentionSchema.safeParse({}).success).toBe(true);
    });

    it('accepts a date-only correction — the most common fix', () => {
        const result = updatePartnerMentionSchema.safeParse({
            mentionedAt: '2026-07-30T10:00:00.000Z'
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.mentionedAt).toBeInstanceOf(Date);
        }
    });

    it('accepts a url-only correction — the pasted-wrong-link fix', () => {
        expect(updatePartnerMentionSchema.safeParse({ url: URL }).success).toBe(true);
    });

    it('accepts an internalNote-only correction', () => {
        expect(updatePartnerMentionSchema.safeParse({ internalNote: 'fixed' }).success).toBe(true);
    });

    it('rejects a channel switch to a permalink channel with no url in the patch', () => {
        // The schema never sees the stored row, so a bare channel switch could turn
        // a WHATSAPP row with no url into an INSTAGRAM row with no url — breaking
        // AC-8 on a record that already passed validation on the way in.
        const result = updatePartnerMentionSchema.safeParse({
            channel: PartnerMentionChannelEnum.INSTAGRAM
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0]?.path).toEqual(['url']);
            expect(result.error.issues[0]?.message).toBe(
                'zodError.partnerMention.url.requiredForChannel'
            );
        }
    });

    it('accepts a channel switch that carries the url along', () => {
        const result = updatePartnerMentionSchema.safeParse({
            channel: PartnerMentionChannelEnum.FACEBOOK,
            url: 'https://facebook.com/p/xyz'
        });
        expect(result.success).toBe(true);
    });

    it('rejects a channel switch whose url is explicitly null', () => {
        const result = updatePartnerMentionSchema.safeParse({
            channel: PartnerMentionChannelEnum.YOUTUBE,
            url: null
        });
        expect(result.success).toBe(false);
    });

    it.each([
        PartnerMentionChannelEnum.WHATSAPP,
        PartnerMentionChannelEnum.OTHER
    ])('accepts a bare switch to %s, which needs no permalink', (channel) => {
        expect(updatePartnerMentionSchema.safeParse({ channel }).success).toBe(true);
    });

    it('does not accept partnerId — moving a mention is not a correction', () => {
        // It would hand one partner's proof of service to another.
        const result = updatePartnerMentionSchema.safeParse({
            partnerId: 'a3f1c2d4-0000-4000-8000-0000000000aa'
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).not.toHaveProperty('partnerId');
        }
    });

    it('does not accept batchId — regrouping a sent campaign is not a correction', () => {
        const result = updatePartnerMentionSchema.safeParse({
            batchId: 'a3f1c2d4-0000-4000-8000-0000000000bb'
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).not.toHaveProperty('batchId');
        }
    });

    it.each([
        'id',
        'createdAt',
        'createdById',
        'deletedAt',
        'deletedById'
    ])('does not accept %s', (field) => {
        const result = updatePartnerMentionSchema.safeParse({ [field]: 'anything' });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).not.toHaveProperty(field);
        }
    });

    it('rejects a malformed url', () => {
        expect(updatePartnerMentionSchema.safeParse({ url: 'not-a-url' }).success).toBe(false);
    });

    it('rejects an unknown channel', () => {
        expect(updatePartnerMentionSchema.safeParse({ channel: 'LINKEDIN' }).success).toBe(false);
    });
});

describe('adminSearchPartnerMentionSchema', () => {
    it('defaults to page 1 with a page size, never a limit', () => {
        const result = adminSearchPartnerMentionSchema.safeParse({});

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.page).toBe(1);
            expect(result.data.pageSize).toBeGreaterThan(0);
            expect(result.data).not.toHaveProperty('limit');
        }
    });

    it('declares the channel filter', () => {
        // An undeclared filter is dropped silently and the endpoint answers with an
        // unfiltered list that looks perfectly legitimate.
        const result = adminSearchPartnerMentionSchema.safeParse({
            channel: PartnerMentionChannelEnum.TIKTOK
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.channel).toBe(PartnerMentionChannelEnum.TIKTOK);
        }
    });

    it('declares the batchId filter', () => {
        const batchId = 'a3f1c2d4-0000-4000-8000-0000000000bb';
        const result = adminSearchPartnerMentionSchema.safeParse({ batchId });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.batchId).toBe(batchId);
        }
    });

    it('declares a mentionedAt range separate from the createdAt range', () => {
        // "when it happened" and "when we logged it" are different questions and
        // give different answers for anything entered after the fact.
        const result = adminSearchPartnerMentionSchema.safeParse({
            mentionedAfter: '2026-07-01T00:00:00.000Z',
            mentionedBefore: '2026-08-01T00:00:00.000Z',
            createdAfter: '2026-07-15T00:00:00.000Z'
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.mentionedAfter).toBeInstanceOf(Date);
            expect(result.data.mentionedBefore).toBeInstanceOf(Date);
            expect(result.data.createdAfter).toBeDefined();
        }
    });

    it('rejects an unknown channel filter', () => {
        expect(adminSearchPartnerMentionSchema.safeParse({ channel: 'LINKEDIN' }).success).toBe(
            false
        );
    });

    it('does not declare partnerId — the URL path is the authoritative scope', () => {
        const result = adminSearchPartnerMentionSchema.safeParse({
            partnerId: 'a3f1c2d4-0000-4000-8000-0000000000aa'
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).not.toHaveProperty('partnerId');
        }
    });
});
