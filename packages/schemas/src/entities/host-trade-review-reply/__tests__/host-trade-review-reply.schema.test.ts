import { describe, expect, it } from 'vitest';
import {
    HostTradeReviewReplyAdminSchema,
    HostTradeReviewReplyAdminSearchSchema,
    HostTradeReviewReplyCreateBodySchema,
    HostTradeReviewReplyCreateInputSchema,
    HostTradeReviewReplyProtectedSchema,
    HostTradeReviewReplySchema,
    HostTradeReviewReplyUpdateBodySchema
} from '../index.js';

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';
const UUID_C = '33333333-3333-4333-8333-333333333333';

function validEntity() {
    return {
        id: UUID_A,
        reviewId: UUID_B,
        authorUserId: UUID_C,
        content: 'Lamento la demora, tuvimos un imprevisto con la camioneta ese día.',
        moderationState: 'PENDING',
        moderatedById: null,
        moderatedAt: null,
        moderationReason: null,
        reviewEditedAfterReply: false,
        createdAt: new Date('2026-08-01T00:00:00Z'),
        updatedAt: new Date('2026-08-01T00:00:00Z'),
        createdById: UUID_C,
        updatedById: UUID_C,
        deletedAt: null,
        deletedById: null
    };
}

// ---------------------------------------------------------------------------
// Entity
// ---------------------------------------------------------------------------

describe('HostTradeReviewReplySchema', () => {
    it('parses a complete valid row', () => {
        expect(HostTradeReviewReplySchema.safeParse(validEntity()).success).toBe(true);
    });

    it('parses a moderated row', () => {
        const result = HostTradeReviewReplySchema.safeParse({
            ...validEntity(),
            moderationState: 'REJECTED',
            moderatedById: UUID_A,
            moderatedAt: new Date('2026-08-02T00:00:00Z'),
            moderationReason: 'Menciona la dirección del anfitrión.'
        });
        expect(result.success).toBe(true);
    });

    it('requires content — a reply is never empty', () => {
        const { content: _content, ...withoutContent } = validEntity();
        expect(HostTradeReviewReplySchema.safeParse(withoutContent).success).toBe(false);
    });

    it('rejects a moderationState outside the enum', () => {
        const result = HostTradeReviewReplySchema.safeParse({
            ...validEntity(),
            moderationState: 'MAYBE'
        });
        expect(result.success).toBe(false);
    });

    /**
     * `reviewEditedAfterReply` is the AC-22 marker. It is a plain boolean on the
     * entity and, crucially, absent from every write shape below: only the
     * review-edit path may raise it.
     */
    it('carries the review-edited marker as a boolean', () => {
        const result = HostTradeReviewReplySchema.safeParse({
            ...validEntity(),
            reviewEditedAfterReply: 'yes'
        });
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Create body
// ---------------------------------------------------------------------------

describe('HostTradeReviewReplyCreateBodySchema', () => {
    const minimal = { content: 'x'.repeat(20) };

    it('accepts a body carrying only the text', () => {
        expect(HostTradeReviewReplyCreateBodySchema.safeParse(minimal).success).toBe(true);
    });

    it('rejects an empty body — the reply IS its content', () => {
        expect(HostTradeReviewReplyCreateBodySchema.safeParse({}).success).toBe(false);
    });

    it('rejects an empty string', () => {
        expect(HostTradeReviewReplyCreateBodySchema.safeParse({ content: '' }).success).toBe(false);
    });

    it('rejects a content of 9 characters', () => {
        const result = HostTradeReviewReplyCreateBodySchema.safeParse({ content: 'x'.repeat(9) });
        expect(result.success).toBe(false);
    });

    it('accepts a content of exactly 10 characters', () => {
        const result = HostTradeReviewReplyCreateBodySchema.safeParse({ content: 'x'.repeat(10) });
        expect(result.success).toBe(true);
    });

    it('accepts a content of exactly 1000 characters', () => {
        const result = HostTradeReviewReplyCreateBodySchema.safeParse({
            content: 'x'.repeat(1000)
        });
        expect(result.success).toBe(true);
    });

    it('rejects a content of 1001 characters', () => {
        const result = HostTradeReviewReplyCreateBodySchema.safeParse({
            content: 'x'.repeat(1001)
        });
        expect(result.success).toBe(false);
    });

    /**
     * The review comes from the path and the author from row ownership, so a
     * body that names either is an impersonation attempt, not a convenience.
     */
    it.each([
        ['reviewId', UUID_B],
        ['authorUserId', UUID_C],
        ['moderationState', 'APPROVED'],
        ['moderatedById', UUID_A],
        ['moderatedAt', '2026-08-01T00:00:00Z'],
        ['moderationReason', 'porque si'],
        ['reviewEditedAfterReply', true]
    ])('REJECTS an injected %s', (field, value) => {
        const result = HostTradeReviewReplyCreateBodySchema.safeParse({
            ...minimal,
            [field]: value
        });
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Create input (service layer)
// ---------------------------------------------------------------------------

describe('HostTradeReviewReplyCreateInputSchema', () => {
    it('declares exactly what the service supplies', () => {
        expect(Object.keys(HostTradeReviewReplyCreateInputSchema.shape).sort()).toEqual([
            'authorUserId',
            'content',
            'reviewId'
        ]);
    });

    /**
     * `moderationState` is absent on purpose: a reply is born PENDING by the
     * column default (§6.4), and a create input that could name it would let a
     * caller publish a reply that skipped moderation entirely.
     */
    it.each([
        'id',
        'moderationState',
        'moderatedById',
        'moderatedAt',
        'moderationReason',
        'reviewEditedAfterReply',
        'createdAt',
        'deletedAt'
    ])('does not declare the server-managed field %s', (field) => {
        expect(Object.keys(HostTradeReviewReplyCreateInputSchema.shape)).not.toContain(field);
    });
});

// ---------------------------------------------------------------------------
// Update body
// ---------------------------------------------------------------------------

describe('HostTradeReviewReplyUpdateBodySchema', () => {
    it('accepts a new text', () => {
        const result = HostTradeReviewReplyUpdateBodySchema.safeParse({ content: 'x'.repeat(20) });
        expect(result.success).toBe(true);
    });

    /**
     * Unlike the review's PATCH, this one has a single editable field, so
     * "partial" and "complete" are the same body. An empty one would send an
     * unchanged reply back to PENDING (AC-23) for nothing.
     */
    it('rejects an empty body', () => {
        expect(HostTradeReviewReplyUpdateBodySchema.safeParse({}).success).toBe(false);
    });

    it('still enforces the bounds', () => {
        expect(
            HostTradeReviewReplyUpdateBodySchema.safeParse({ content: 'x'.repeat(9) }).success
        ).toBe(false);
        expect(
            HostTradeReviewReplyUpdateBodySchema.safeParse({ content: 'x'.repeat(1001) }).success
        ).toBe(false);
    });

    it.each([
        ['moderationState', 'APPROVED'],
        ['reviewEditedAfterReply', false],
        ['moderationReason', 'listo'],
        ['authorUserId', UUID_C]
    ])('REJECTS the managed field %s', (field, value) => {
        const result = HostTradeReviewReplyUpdateBodySchema.safeParse({
            content: 'x'.repeat(20),
            [field]: value
        });
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Access tiers
// ---------------------------------------------------------------------------

describe('access tiers', () => {
    it('the protected tier hides the moderator and their private reason', () => {
        const keys = Object.keys(HostTradeReviewReplyProtectedSchema.shape);
        for (const hidden of [
            'moderatedById',
            'moderatedAt',
            'moderationReason',
            'createdById',
            'updatedById',
            'deletedById',
            'deletedAt'
        ]) {
            expect(keys).not.toContain(hidden);
        }
    });

    it('the protected tier carries what the directory renders', () => {
        const keys = Object.keys(HostTradeReviewReplyProtectedSchema.shape);
        for (const shown of [
            'id',
            'reviewId',
            'content',
            'moderationState',
            'reviewEditedAfterReply',
            'createdAt'
        ]) {
            expect(keys).toContain(shown);
        }
    });

    it('the admin tier is the full row', () => {
        expect(HostTradeReviewReplyAdminSchema.safeParse(validEntity()).success).toBe(true);
        expect(Object.keys(HostTradeReviewReplyAdminSchema.shape)).toContain('moderationReason');
    });

    /** Same reasoning as the review and usage schemas: §7.5 has no public tier. */
    it('exposes no public tier', async () => {
        const barrel = await import('../index.js');
        expect(Object.keys(barrel)).not.toContain('HostTradeReviewReplyPublicSchema');
    });
});

// ---------------------------------------------------------------------------
// Admin search
// ---------------------------------------------------------------------------

describe('HostTradeReviewReplyAdminSearchSchema', () => {
    it('accepts the moderationState filter the PENDING queue is built on', () => {
        const result = HostTradeReviewReplyAdminSearchSchema.safeParse({
            moderationState: 'PENDING'
        });
        expect(result.success).toBe(true);
    });

    it('rejects a moderationState outside the enum', () => {
        const result = HostTradeReviewReplyAdminSearchSchema.safeParse({
            moderationState: 'MAYBE'
        });
        expect(result.success).toBe(false);
    });

    it('accepts the review and author filters', () => {
        const result = HostTradeReviewReplyAdminSearchSchema.safeParse({
            reviewId: UUID_B,
            authorUserId: UUID_C
        });
        expect(result.success).toBe(true);
    });
});
