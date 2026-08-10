import { describe, expect, it } from 'vitest';
import {
    HostTradeReviewAdminSchema,
    HostTradeReviewAdminSearchSchema,
    HostTradeReviewCreateBodySchema,
    HostTradeReviewCreateInputSchema,
    HostTradeReviewProtectedSchema,
    HostTradeReviewSchema,
    HostTradeReviewUpdateBodySchema
} from '../index.js';

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';
const UUID_C = '33333333-3333-4333-8333-333333333333';

function validEntity() {
    return {
        id: UUID_A,
        hostTradeId: UUID_B,
        hostUserId: UUID_C,
        overallRating: 4,
        rating: { workQuality: 5, punctuality: 4, treatment: 4 },
        averageRating: 4.33,
        respectedBenefit: true,
        content: 'Trabajo prolijo, llegó a horario y respetó el descuento.',
        lifecycleState: 'ACTIVE',
        moderationState: 'APPROVED',
        moderatedById: null,
        moderatedAt: null,
        moderationReason: null,
        editedAt: null,
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

describe('HostTradeReviewSchema', () => {
    it('parses a complete valid row', () => {
        expect(HostTradeReviewSchema.safeParse(validEntity()).success).toBe(true);
    });

    it('parses a row with no breakdown and no average', () => {
        const result = HostTradeReviewSchema.safeParse({
            ...validEntity(),
            rating: null,
            averageRating: null
        });
        expect(result.success).toBe(true);
    });

    it.each([0, 6, 2.5, -1])('rejects an overallRating of %s', (value) => {
        const result = HostTradeReviewSchema.safeParse({ ...validEntity(), overallRating: value });
        expect(result.success).toBe(false);
    });

    it.each([
        'workQuality',
        'punctuality',
        'treatment'
    ])('rejects a %s breakdown dimension outside 1-5', (dimension) => {
        const result = HostTradeReviewSchema.safeParse({
            ...validEntity(),
            rating: { [dimension]: 9 }
        });
        expect(result.success).toBe(false);
    });

    it('has no title field — the shape deliberately omits one', () => {
        expect(Object.keys(HostTradeReviewSchema.shape)).not.toContain('title');
    });
});

// ---------------------------------------------------------------------------
// Create body
// ---------------------------------------------------------------------------

describe('HostTradeReviewCreateBodySchema', () => {
    const minimal = { overallRating: 5, respectedBenefit: true };

    it('accepts the minimal payload: a rating and the benefit answer', () => {
        expect(HostTradeReviewCreateBodySchema.safeParse(minimal).success).toBe(true);
    });

    it('accepts the optional breakdown', () => {
        const result = HostTradeReviewCreateBodySchema.safeParse({
            ...minimal,
            rating: { workQuality: 4, treatment: 5 }
        });
        expect(result.success).toBe(true);
    });

    /**
     * The benefit answer is REQUIRED and is not a star dimension. A provider is
     * in the directory *because* of the benefit, so "excellent work, ignored the
     * discount" is the failure mode this field exists to expose — a default
     * would let it pass silently (§6.3).
     */
    it('rejects a payload with no respectedBenefit', () => {
        const result = HostTradeReviewCreateBodySchema.safeParse({ overallRating: 5 });
        expect(result.success).toBe(false);
    });

    it('does not default respectedBenefit to either value', () => {
        const parsed = HostTradeReviewCreateBodySchema.safeParse({
            ...minimal,
            respectedBenefit: false
        });
        expect(parsed.success).toBe(true);
        if (parsed.success) expect(parsed.data.respectedBenefit).toBe(false);
    });

    it('rejects a payload with no overallRating', () => {
        const result = HostTradeReviewCreateBodySchema.safeParse({ respectedBenefit: true });
        expect(result.success).toBe(false);
    });

    it.each([0, 6])('rejects an overallRating of %s', (value) => {
        const result = HostTradeReviewCreateBodySchema.safeParse({
            ...minimal,
            overallRating: value
        });
        expect(result.success).toBe(false);
    });

    it('rejects a content of 5 characters', () => {
        const result = HostTradeReviewCreateBodySchema.safeParse({ ...minimal, content: 'corto' });
        expect(result.success).toBe(false);
    });

    it('accepts a content of exactly 10 characters', () => {
        const result = HostTradeReviewCreateBodySchema.safeParse({
            ...minimal,
            content: 'x'.repeat(10)
        });
        expect(result.success).toBe(true);
    });

    it('rejects a content longer than 2000 characters', () => {
        const result = HostTradeReviewCreateBodySchema.safeParse({
            ...minimal,
            content: 'x'.repeat(2001)
        });
        expect(result.success).toBe(false);
    });

    it.each([
        ['hostTradeId', UUID_B],
        ['hostUserId', UUID_C],
        ['moderationState', 'APPROVED'],
        ['moderatedById', UUID_A],
        ['moderatedAt', '2026-08-01T00:00:00Z'],
        ['moderationReason', 'porque si'],
        ['averageRating', 5],
        ['editedAt', '2026-08-01T00:00:00Z'],
        ['lifecycleState', 'ARCHIVED']
    ])('REJECTS an injected %s', (field, value) => {
        const result = HostTradeReviewCreateBodySchema.safeParse({ ...minimal, [field]: value });
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Create input (service layer)
// ---------------------------------------------------------------------------

describe('HostTradeReviewCreateInputSchema', () => {
    it.each([
        'id',
        'moderationState',
        'moderatedById',
        'moderatedAt',
        'moderationReason',
        'averageRating',
        'editedAt',
        'createdAt',
        'deletedAt'
    ])('does not declare the server-managed field %s', (field) => {
        expect(Object.keys(HostTradeReviewCreateInputSchema.shape)).not.toContain(field);
    });
});

// ---------------------------------------------------------------------------
// Update body
// ---------------------------------------------------------------------------

describe('HostTradeReviewUpdateBodySchema', () => {
    it('accepts a partial edit', () => {
        const result = HostTradeReviewUpdateBodySchema.safeParse({ overallRating: 3 });
        expect(result.success).toBe(true);
    });

    it('still enforces the bounds on the fields it does accept', () => {
        expect(HostTradeReviewUpdateBodySchema.safeParse({ overallRating: 6 }).success).toBe(false);
        expect(HostTradeReviewUpdateBodySchema.safeParse({ content: 'corto' }).success).toBe(false);
    });

    it.each([
        'moderationState',
        'editedAt',
        'averageRating',
        'hostUserId'
    ])('REJECTS the managed field %s', (field) => {
        const result = HostTradeReviewUpdateBodySchema.safeParse({ [field]: 'whatever' });
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Access tiers
// ---------------------------------------------------------------------------

describe('access tiers', () => {
    it('the protected tier hides moderation internals and the audit trail', () => {
        const keys = Object.keys(HostTradeReviewProtectedSchema.shape);
        for (const hidden of [
            'moderatedById',
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
        const keys = Object.keys(HostTradeReviewProtectedSchema.shape);
        for (const shown of [
            'id',
            'hostTradeId',
            'hostUserId',
            'overallRating',
            'rating',
            'averageRating',
            'respectedBenefit',
            'content',
            'editedAt',
            'createdAt'
        ]) {
            expect(keys).toContain(shown);
        }
    });

    it('the admin tier is the full row', () => {
        expect(HostTradeReviewAdminSchema.safeParse(validEntity()).success).toBe(true);
        expect(Object.keys(HostTradeReviewAdminSchema.shape)).toContain('moderationReason');
    });

    /** Same reasoning as the usage schemas: §7.5 has no public tier. */
    it('exposes no public tier', async () => {
        const barrel = await import('../index.js');
        expect(Object.keys(barrel)).not.toContain('HostTradeReviewPublicSchema');
    });
});

// ---------------------------------------------------------------------------
// Admin search
// ---------------------------------------------------------------------------

describe('HostTradeReviewAdminSearchSchema', () => {
    it('accepts the moderationState filter', () => {
        const result = HostTradeReviewAdminSearchSchema.safeParse({ moderationState: 'PENDING' });
        expect(result.success).toBe(true);
    });

    it('rejects a moderationState outside the enum', () => {
        const result = HostTradeReviewAdminSearchSchema.safeParse({ moderationState: 'MAYBE' });
        expect(result.success).toBe(false);
    });

    it('accepts the provider and host filters', () => {
        const result = HostTradeReviewAdminSearchSchema.safeParse({
            hostTradeId: UUID_B,
            hostUserId: UUID_C,
            respectedBenefit: false
        });
        expect(result.success).toBe(true);
    });
});
