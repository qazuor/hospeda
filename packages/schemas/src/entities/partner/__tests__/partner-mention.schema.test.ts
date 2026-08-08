import { describe, expect, it } from 'vitest';
import { PartnerMentionChannelEnum } from '../../../enums/partner-mention-channel.enum.js';
import {
    PARTNER_MENTION_ADMIN_ONLY_MASK,
    partnerMentionPublicSchema,
    partnerMentionSchema
} from '../partner-mention.schema.js';

// ============================================================================
// partnerMentionSchema — HOS-377 T-005
// ============================================================================

const UUID_A = 'a3f1c2d4-0000-4000-8000-000000000001';
const UUID_B = 'a3f1c2d4-0000-4000-8000-000000000002';
const UUID_C = 'a3f1c2d4-0000-4000-8000-000000000003';

const validMention = () => ({
    id: UUID_A,
    partnerId: UUID_B,
    channel: PartnerMentionChannelEnum.INSTAGRAM,
    batchId: UUID_C,
    mentionedAt: new Date('2026-08-01T12:00:00.000Z'),
    url: 'https://instagram.com/p/abc123',
    internalNote: 'agreed with the owner',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: null,
    updatedById: null
});

describe('partnerMentionSchema', () => {
    it('parses a fully populated mention', () => {
        const result = partnerMentionSchema.safeParse(validMention());
        expect(result.success).toBe(true);
    });

    it('accepts a null batchId — a mention logged on its own', () => {
        const result = partnerMentionSchema.safeParse({ ...validMention(), batchId: null });
        expect(result.success).toBe(true);
    });

    it('accepts a null url — WHATSAPP and OTHER have no permalink', () => {
        const result = partnerMentionSchema.safeParse({
            ...validMention(),
            channel: PartnerMentionChannelEnum.WHATSAPP,
            url: null
        });
        expect(result.success).toBe(true);
    });

    it('rejects an unknown channel', () => {
        const result = partnerMentionSchema.safeParse({ ...validMention(), channel: 'LINKEDIN' });
        expect(result.success).toBe(false);
    });

    it('rejects a url that is not a URL', () => {
        const result = partnerMentionSchema.safeParse({ ...validMention(), url: 'not-a-url' });
        expect(result.success).toBe(false);
    });

    it('requires mentionedAt', () => {
        const { mentionedAt: _omitted, ...withoutDate } = validMention();
        const result = partnerMentionSchema.safeParse(withoutDate);
        expect(result.success).toBe(false);
    });

    it('coerces an ISO string into a Date for mentionedAt', () => {
        // Query params and JSON bodies both arrive as strings.
        const result = partnerMentionSchema.safeParse({
            ...validMention(),
            mentionedAt: '2026-08-01T12:00:00.000Z'
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.mentionedAt).toBeInstanceOf(Date);
        }
    });

    it('keeps mentionedAt and createdAt as independent fields', () => {
        // A mention logged a week after it happened must keep the real date.
        const happened = new Date('2026-08-01T12:00:00.000Z');
        const logged = new Date('2026-08-08T09:00:00.000Z');
        const result = partnerMentionSchema.safeParse({
            ...validMention(),
            mentionedAt: happened,
            createdAt: logged
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.mentionedAt).toEqual(happened);
            expect(result.data.createdAt).toEqual(logged);
        }
    });

    it('is sliceable — no .refine() blocking .omit()/.pick()/.partial()', () => {
        // Zod 4 refuses these on a refined object, and every write-side schema is
        // derived from this one. If a cross-field rule is ever added here, T-006
        // and T-007 stop compiling — this test says why before that happens.
        expect(() => partnerMentionSchema.omit({ id: true })).not.toThrow();
        expect(() => partnerMentionSchema.pick({ channel: true })).not.toThrow();
        expect(() => partnerMentionSchema.partial()).not.toThrow();
    });
});

describe('partnerMentionPublicSchema', () => {
    it('masks exactly the five admin-only fields, named literally', () => {
        // Spelled out rather than derived from the mask on purpose. A loop over
        // PARTNER_MENTION_ADMIN_ONLY_MASK checks less as the mask SHRINKS: drop
        // internalNote from it and the loop simply stops testing internalNote,
        // reporting green while the note starts reaching the partner. Verified by
        // mutation — that exact edit left this suite 12/13 green until this
        // assertion was written as a literal.
        expect(Object.keys(PARTNER_MENTION_ADMIN_ONLY_MASK).sort()).toEqual([
            'createdById',
            'deletedAt',
            'deletedById',
            'internalNote',
            'updatedById'
        ]);
    });

    it('strips every field the mask names', () => {
        const result = partnerMentionPublicSchema.safeParse(validMention());

        expect(result.success).toBe(true);
        if (result.success) {
            for (const field of Object.keys(PARTNER_MENTION_ADMIN_ONLY_MASK)) {
                expect(result.data).not.toHaveProperty(field);
            }
        }
    });

    it('does not expose internalNote even when the input carries one', () => {
        // The partner-facing payload must not contain the note at all — hiding it
        // in the UI is not the same guarantee.
        const result = partnerMentionPublicSchema.safeParse({
            ...validMention(),
            internalNote: 'do not show this to the partner'
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(JSON.stringify(result.data)).not.toContain('do not show this to the partner');
        }
    });

    it('keeps the fields the partner needs to verify a mention', () => {
        const result = partnerMentionPublicSchema.safeParse(validMention());

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.channel).toBe(PartnerMentionChannelEnum.INSTAGRAM);
            expect(result.data.url).toBe('https://instagram.com/p/abc123');
            expect(result.data.batchId).toBe(UUID_C);
            expect(result.data.mentionedAt).toBeInstanceOf(Date);
        }
    });

    it('is derived from the entity, so a new entity field cannot bypass the mask', () => {
        // Guards the derivation itself: public = entity minus mask, exactly.
        const entityKeys = Object.keys(partnerMentionSchema.shape);
        const publicKeys = Object.keys(partnerMentionPublicSchema.shape);
        const masked = Object.keys(PARTNER_MENTION_ADMIN_ONLY_MASK);

        expect(publicKeys.sort()).toEqual(entityKeys.filter((k) => !masked.includes(k)).sort());
    });
});
