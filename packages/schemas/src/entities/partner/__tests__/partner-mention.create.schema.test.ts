import { describe, expect, it } from 'vitest';
import { PartnerMentionChannelEnum } from '../../../enums/partner-mention-channel.enum.js';
import {
    createPartnerMentionBatchSchema,
    partnerMentionEntrySchema
} from '../partner-mention.create.schema.js';

// ============================================================================
// createPartnerMentionBatchSchema — HOS-377 T-006
// ============================================================================

const URL = 'https://instagram.com/p/abc123';
const MENTIONED_AT = '2026-08-01T12:00:00.000Z';

/** The six channels that publish something with a public permalink. */
const CHANNELS_NEEDING_URL = [
    PartnerMentionChannelEnum.INSTAGRAM,
    PartnerMentionChannelEnum.FACEBOOK,
    PartnerMentionChannelEnum.TWITTER,
    PartnerMentionChannelEnum.YOUTUBE,
    PartnerMentionChannelEnum.TIKTOK,
    PartnerMentionChannelEnum.NEWSLETTER
] as const;

/** The two that legitimately have no link to show. */
const CHANNELS_WITHOUT_URL = [
    PartnerMentionChannelEnum.WHATSAPP,
    PartnerMentionChannelEnum.OTHER
] as const;

describe('partnerMentionEntrySchema — per-channel URL rule', () => {
    it.each(CHANNELS_NEEDING_URL)('%s accepts an entry carrying a url', (channel) => {
        expect(partnerMentionEntrySchema.safeParse({ channel, url: URL }).success).toBe(true);
    });

    it.each(CHANNELS_NEEDING_URL)('%s REJECTS an entry with no url', (channel) => {
        const result = partnerMentionEntrySchema.safeParse({ channel, url: null });
        expect(result.success).toBe(false);
    });

    it.each(CHANNELS_NEEDING_URL)('%s rejects an entry with the url key absent', (channel) => {
        expect(partnerMentionEntrySchema.safeParse({ channel }).success).toBe(false);
    });

    it.each(CHANNELS_WITHOUT_URL)('%s accepts an entry with no url', (channel) => {
        expect(partnerMentionEntrySchema.safeParse({ channel, url: null }).success).toBe(true);
    });

    it.each(
        CHANNELS_WITHOUT_URL
    )('%s still accepts an entry that happens to have one', (channel) => {
        // Optional means optional — a WhatsApp campaign that did produce a public
        // link should not be blocked from recording it.
        expect(partnerMentionEntrySchema.safeParse({ channel, url: URL }).success).toBe(true);
    });

    it('covers every channel in the enum — none is left untested', () => {
        // If a channel is added and neither list above is updated, this fails
        // rather than leaving the new channel silently unverified.
        const tested = [...CHANNELS_NEEDING_URL, ...CHANNELS_WITHOUT_URL].sort();
        expect(tested).toEqual(Object.values(PartnerMentionChannelEnum).sort());
    });

    it('reports the missing url on the url path, not at the entry root', () => {
        // With N channels selected the admin form renders N url inputs; an error
        // without a path cannot be shown next to the one that is actually missing.
        const result = partnerMentionEntrySchema.safeParse({
            channel: PartnerMentionChannelEnum.INSTAGRAM,
            url: null
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0]?.path).toEqual(['url']);
            expect(result.error.issues[0]?.message).toBe(
                'zodError.partnerMention.url.requiredForChannel'
            );
        }
    });

    it('rejects a malformed url even on a channel that requires one', () => {
        const result = partnerMentionEntrySchema.safeParse({
            channel: PartnerMentionChannelEnum.INSTAGRAM,
            url: 'not-a-url'
        });
        expect(result.success).toBe(false);
    });
});

describe('createPartnerMentionBatchSchema', () => {
    it('accepts a single-entry submission', () => {
        const result = createPartnerMentionBatchSchema.safeParse({
            mentionedAt: MENTIONED_AT,
            entries: [{ channel: PartnerMentionChannelEnum.INSTAGRAM, url: URL }]
        });
        expect(result.success).toBe(true);
    });

    it('accepts a four-network campaign in one submission', () => {
        const result = createPartnerMentionBatchSchema.safeParse({
            mentionedAt: MENTIONED_AT,
            internalNote: 'spring campaign',
            entries: [
                { channel: PartnerMentionChannelEnum.INSTAGRAM, url: 'https://ig.com/p/1' },
                { channel: PartnerMentionChannelEnum.FACEBOOK, url: 'https://fb.com/p/2' },
                { channel: PartnerMentionChannelEnum.TIKTOK, url: 'https://tiktok.com/p/3' },
                { channel: PartnerMentionChannelEnum.WHATSAPP, url: null }
            ]
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.entries).toHaveLength(4);
        }
    });

    it('rejects an empty entries array', () => {
        const result = createPartnerMentionBatchSchema.safeParse({
            mentionedAt: MENTIONED_AT,
            entries: []
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0]?.message).toBe('zodError.partnerMention.entries.empty');
        }
    });

    it('rejects the whole submission when ONE entry breaks the url rule', () => {
        // All-or-nothing: the service writes the batch in a single transaction, so
        // a partially valid submission must not reach it.
        const result = createPartnerMentionBatchSchema.safeParse({
            mentionedAt: MENTIONED_AT,
            entries: [
                { channel: PartnerMentionChannelEnum.INSTAGRAM, url: URL },
                { channel: PartnerMentionChannelEnum.YOUTUBE, url: null }
            ]
        });
        expect(result.success).toBe(false);
    });

    it('points the error at the offending entry index', () => {
        const result = createPartnerMentionBatchSchema.safeParse({
            mentionedAt: MENTIONED_AT,
            entries: [
                { channel: PartnerMentionChannelEnum.WHATSAPP, url: null },
                { channel: PartnerMentionChannelEnum.FACEBOOK, url: null }
            ]
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0]?.path).toEqual(['entries', 1, 'url']);
        }
    });

    it('requires mentionedAt', () => {
        const result = createPartnerMentionBatchSchema.safeParse({
            entries: [{ channel: PartnerMentionChannelEnum.WHATSAPP, url: null }]
        });
        expect(result.success).toBe(false);
    });

    it('coerces mentionedAt from an ISO string', () => {
        const result = createPartnerMentionBatchSchema.safeParse({
            mentionedAt: MENTIONED_AT,
            entries: [{ channel: PartnerMentionChannelEnum.WHATSAPP, url: null }]
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.mentionedAt).toBeInstanceOf(Date);
        }
    });
});

describe('createPartnerMentionBatchSchema — server-owned fields (R-5)', () => {
    it('drops a client-supplied batchId from the parsed output', () => {
        // The guarantee is that the PARSED object carries no batchId, so a service
        // that inserts from `result.data` cannot file this mention into someone
        // else's batch. Inserting from the raw body would bypass this entirely.
        const result = createPartnerMentionBatchSchema.safeParse({
            mentionedAt: MENTIONED_AT,
            batchId: 'a3f1c2d4-0000-4000-8000-0000000000ff',
            entries: [{ channel: PartnerMentionChannelEnum.WHATSAPP, url: null }]
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).not.toHaveProperty('batchId');
            expect(JSON.stringify(result.data)).not.toContain('0000000000ff');
        }
    });

    it('drops a client-supplied partnerId — the URL path is authoritative', () => {
        const result = createPartnerMentionBatchSchema.safeParse({
            mentionedAt: MENTIONED_AT,
            partnerId: 'a3f1c2d4-0000-4000-8000-0000000000ee',
            entries: [{ channel: PartnerMentionChannelEnum.WHATSAPP, url: null }]
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).not.toHaveProperty('partnerId');
        }
    });

    it('drops client-supplied audit fields', () => {
        const result = createPartnerMentionBatchSchema.safeParse({
            mentionedAt: MENTIONED_AT,
            id: 'a3f1c2d4-0000-4000-8000-0000000000dd',
            createdById: 'a3f1c2d4-0000-4000-8000-0000000000cc',
            deletedAt: new Date(),
            entries: [{ channel: PartnerMentionChannelEnum.WHATSAPP, url: null }]
        });

        expect(result.success).toBe(true);
        if (result.success) {
            for (const field of ['id', 'createdById', 'deletedAt']) {
                expect(result.data).not.toHaveProperty(field);
            }
        }
    });

    it('drops a batchId smuggled inside an entry', () => {
        // The entry is picked down to channel+url, so per-entry smuggling is closed
        // by the same mechanism as the body-level one.
        const result = createPartnerMentionBatchSchema.safeParse({
            mentionedAt: MENTIONED_AT,
            entries: [
                {
                    channel: PartnerMentionChannelEnum.WHATSAPP,
                    url: null,
                    batchId: 'a3f1c2d4-0000-4000-8000-0000000000bb',
                    partnerId: 'a3f1c2d4-0000-4000-8000-0000000000aa'
                }
            ]
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.entries[0]).not.toHaveProperty('batchId');
            expect(result.data.entries[0]).not.toHaveProperty('partnerId');
        }
    });
});
