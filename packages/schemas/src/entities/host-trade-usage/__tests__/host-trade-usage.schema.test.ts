import { describe, expect, it } from 'vitest';
import {
    HostTradeBenefitUsageAdminSchema,
    HostTradeBenefitUsageAdminSearchSchema,
    HostTradeBenefitUsageCreateInputSchema,
    HostTradeBenefitUsageHostCreateBodySchema,
    HostTradeBenefitUsageProtectedSchema,
    HostTradeBenefitUsageProviderCreateBodySchema,
    HostTradeBenefitUsageRejectBodySchema,
    HostTradeBenefitUsageSchema,
    HostTradeBenefitUsageUpdateInputSchema
} from '../index.js';

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';
const UUID_C = '33333333-3333-4333-8333-333333333333';

/** A complete, valid usage row as the DB would return it. */
function validEntity() {
    return {
        id: UUID_A,
        hostTradeId: UUID_B,
        hostUserId: UUID_C,
        declaredBy: 'PROVIDER',
        declaredById: UUID_B,
        creationChannel: 'LINKED_SELECTOR',
        status: 'PENDING',
        servicedAt: '2026-08-01',
        note: 'Cambio de cerradura',
        expiresAt: new Date('2026-09-01T00:00:00Z'),
        reminderSentAt: null,
        confirmedAt: null,
        confirmedById: null,
        rejectedAt: null,
        rejectedById: null,
        rejectionNote: null,
        createdAt: new Date('2026-08-01T00:00:00Z'),
        updatedAt: new Date('2026-08-01T00:00:00Z'),
        createdById: UUID_B,
        updatedById: UUID_B,
        deletedAt: null,
        deletedById: null
    };
}

// ---------------------------------------------------------------------------
// Entity schema
// ---------------------------------------------------------------------------

describe('HostTradeBenefitUsageSchema', () => {
    it('parses a complete valid row', () => {
        const result = HostTradeBenefitUsageSchema.safeParse(validEntity());
        expect(result.success).toBe(true);
    });

    it('rejects a status outside the state machine', () => {
        const result = HostTradeBenefitUsageSchema.safeParse({
            ...validEntity(),
            status: 'AUTO_CONFIRMED'
        });
        expect(result.success).toBe(false);
    });

    it('rejects a servicedAt that is not a YYYY-MM-DD calendar date', () => {
        const result = HostTradeBenefitUsageSchema.safeParse({
            ...validEntity(),
            servicedAt: '01/08/2026'
        });
        expect(result.success).toBe(false);
    });

    it('rejects a declaredBy outside PROVIDER | HOST', () => {
        const result = HostTradeBenefitUsageSchema.safeParse({
            ...validEntity(),
            declaredBy: 'ADMIN'
        });
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Create input (service layer)
// ---------------------------------------------------------------------------

describe('HostTradeBenefitUsageCreateInputSchema', () => {
    it('accepts the fields the service supplies', () => {
        const result = HostTradeBenefitUsageCreateInputSchema.safeParse({
            hostTradeId: UUID_B,
            hostUserId: UUID_C,
            declaredBy: 'HOST',
            declaredById: UUID_C,
            creationChannel: 'QR',
            servicedAt: '2026-08-01'
        });
        expect(result.success).toBe(true);
    });

    it.each([
        'id',
        'status',
        'expiresAt',
        'reminderSentAt',
        'confirmedAt',
        'confirmedById',
        'rejectedAt',
        'rejectedById',
        'rejectionNote',
        'createdAt',
        'createdById',
        'deletedAt'
    ])('does not declare the server-managed field %s', (field) => {
        expect(Object.keys(HostTradeBenefitUsageCreateInputSchema.shape)).not.toContain(field);
    });
});

// ---------------------------------------------------------------------------
// Host create body — the QR path
// ---------------------------------------------------------------------------

describe('HostTradeBenefitUsageHostCreateBodySchema', () => {
    it('accepts the minimal QR payload', () => {
        const result = HostTradeBenefitUsageHostCreateBodySchema.safeParse({
            servicedAt: '2026-08-01',
            note: 'Destapación de cocina'
        });
        expect(result.success).toBe(true);
    });

    it('accepts a payload with no note', () => {
        const result = HostTradeBenefitUsageHostCreateBodySchema.safeParse({
            servicedAt: '2026-08-01'
        });
        expect(result.success).toBe(true);
    });

    it.each([
        ['hostUserId', UUID_C],
        ['hostTradeId', UUID_B],
        ['declaredBy', 'PROVIDER'],
        ['declaredById', UUID_B],
        ['creationChannel', 'EMAIL_LOOKUP'],
        ['status', 'CONFIRMED'],
        ['confirmedAt', '2026-08-01T00:00:00Z'],
        ['expiresAt', '2099-01-01T00:00:00Z']
    ])('REJECTS an injected %s instead of silently stripping it', (field, value) => {
        const result = HostTradeBenefitUsageHostCreateBodySchema.safeParse({
            servicedAt: '2026-08-01',
            [field]: value
        });
        expect(result.success).toBe(false);
    });

    it('rejects a note longer than 300 characters', () => {
        const result = HostTradeBenefitUsageHostCreateBodySchema.safeParse({
            servicedAt: '2026-08-01',
            note: 'x'.repeat(301)
        });
        expect(result.success).toBe(false);
    });

    it('accepts a note of exactly 300 characters', () => {
        const result = HostTradeBenefitUsageHostCreateBodySchema.safeParse({
            servicedAt: '2026-08-01',
            note: 'x'.repeat(300)
        });
        expect(result.success).toBe(true);
    });

    it('requires servicedAt', () => {
        const result = HostTradeBenefitUsageHostCreateBodySchema.safeParse({
            note: 'sin fecha'
        });
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Provider create body — selector or email fallback
// ---------------------------------------------------------------------------

describe('HostTradeBenefitUsageProviderCreateBodySchema', () => {
    it('accepts the scoped-selector shape (hostUserId)', () => {
        const result = HostTradeBenefitUsageProviderCreateBodySchema.safeParse({
            servicedAt: '2026-08-01',
            hostUserId: UUID_C
        });
        expect(result.success).toBe(true);
    });

    it('accepts the email-fallback shape (hostEmail)', () => {
        const result = HostTradeBenefitUsageProviderCreateBodySchema.safeParse({
            servicedAt: '2026-08-01',
            hostEmail: 'anfitrion@example.com'
        });
        expect(result.success).toBe(true);
    });

    it('rejects a payload carrying BOTH identifiers', () => {
        const result = HostTradeBenefitUsageProviderCreateBodySchema.safeParse({
            servicedAt: '2026-08-01',
            hostUserId: UUID_C,
            hostEmail: 'anfitrion@example.com'
        });
        expect(result.success).toBe(false);
    });

    it('rejects a payload carrying NEITHER identifier', () => {
        const result = HostTradeBenefitUsageProviderCreateBodySchema.safeParse({
            servicedAt: '2026-08-01'
        });
        expect(result.success).toBe(false);
    });

    it('rejects a malformed hostEmail', () => {
        const result = HostTradeBenefitUsageProviderCreateBodySchema.safeParse({
            servicedAt: '2026-08-01',
            hostEmail: 'no-es-un-email'
        });
        expect(result.success).toBe(false);
    });

    it.each([
        ['hostTradeId', UUID_B],
        ['declaredBy', 'HOST'],
        ['creationChannel', 'QR'],
        ['status', 'CONFIRMED']
    ])('REJECTS an injected %s', (field, value) => {
        const result = HostTradeBenefitUsageProviderCreateBodySchema.safeParse({
            servicedAt: '2026-08-01',
            hostUserId: UUID_C,
            [field]: value
        });
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Reject body
// ---------------------------------------------------------------------------

describe('HostTradeBenefitUsageRejectBodySchema', () => {
    it('accepts an empty body — a rejection needs no reason', () => {
        expect(HostTradeBenefitUsageRejectBodySchema.safeParse({}).success).toBe(true);
    });

    it('accepts a note within bounds', () => {
        const result = HostTradeBenefitUsageRejectBodySchema.safeParse({
            note: 'Nunca vino a casa'
        });
        expect(result.success).toBe(true);
    });

    it('rejects a note longer than 300 characters', () => {
        const result = HostTradeBenefitUsageRejectBodySchema.safeParse({
            note: 'x'.repeat(301)
        });
        expect(result.success).toBe(false);
    });

    it('REJECTS an injected rejectedById', () => {
        const result = HostTradeBenefitUsageRejectBodySchema.safeParse({
            rejectedById: UUID_C
        });
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Update input
// ---------------------------------------------------------------------------

describe('HostTradeBenefitUsageUpdateInputSchema', () => {
    it('accepts a partial payload', () => {
        const result = HostTradeBenefitUsageUpdateInputSchema.safeParse({
            note: 'Corrijo la nota'
        });
        expect(result.success).toBe(true);
    });

    it.each([
        'status',
        'confirmedAt',
        'confirmedById',
        'expiresAt',
        'reminderSentAt'
    ])('REJECTS the state-machine field %s', (field) => {
        const result = HostTradeBenefitUsageUpdateInputSchema.safeParse({
            [field]: 'CONFIRMED'
        });
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Access tiers
// ---------------------------------------------------------------------------

describe('access tiers', () => {
    it('the protected tier hides the audit trail of who acted', () => {
        const keys = Object.keys(HostTradeBenefitUsageProtectedSchema.shape);
        expect(keys).not.toContain('createdById');
        expect(keys).not.toContain('updatedById');
        expect(keys).not.toContain('deletedById');
        expect(keys).not.toContain('deletedAt');
    });

    it('the protected tier still carries what the pending list renders', () => {
        const keys = Object.keys(HostTradeBenefitUsageProtectedSchema.shape);
        for (const field of [
            'id',
            'hostTradeId',
            'hostUserId',
            'declaredBy',
            'status',
            'servicedAt',
            'note',
            'expiresAt'
        ]) {
            expect(keys).toContain(field);
        }
    });

    it('the admin tier is the full row', () => {
        const result = HostTradeBenefitUsageAdminSchema.safeParse(validEntity());
        expect(result.success).toBe(true);
        expect(Object.keys(HostTradeBenefitUsageAdminSchema.shape)).toContain('deletedById');
    });

    /**
     * There is deliberately NO public tier. Spec §7.5: the directory has no
     * public route ("Sin tier público"), and the only usage data that reaches
     * an anonymous visitor is the AGGREGATE counter denormalised onto
     * `host_trades` — never a usage row, which names two identifiable people.
     * A public schema with no public route is the dead scaffold the spec §5
     * calls out in `hasOwnerResponse`/`responseAfter`.
     */
    it('exposes no public tier', async () => {
        const barrel = await import('../index.js');
        expect(Object.keys(barrel)).not.toContain('HostTradeBenefitUsagePublicSchema');
    });
});

// ---------------------------------------------------------------------------
// Admin search
// ---------------------------------------------------------------------------

describe('HostTradeBenefitUsageAdminSearchSchema', () => {
    it('applies the pagination defaults from the base schema', () => {
        const result = HostTradeBenefitUsageAdminSearchSchema.safeParse({});
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.page).toBe(1);
        }
    });

    it('accepts the domain filters', () => {
        const result = HostTradeBenefitUsageAdminSearchSchema.safeParse({
            hostTradeId: UUID_B,
            hostUserId: UUID_C,
            status: 'REJECTED',
            declaredBy: 'PROVIDER',
            creationChannel: 'EMAIL_LOOKUP'
        });
        expect(result.success).toBe(true);
    });

    it('rejects a status outside the enum', () => {
        const result = HostTradeBenefitUsageAdminSearchSchema.safeParse({
            status: 'AUTO_CONFIRMED'
        });
        expect(result.success).toBe(false);
    });

    /**
     * Pins the `status` override. `AdminSearchBaseSchema.status` is a LIFECYCLE
     * filter (`z.enum(['all', ...LifecycleStatusEnum]).default('all')`), so
     * dropping the override silently swaps this field's vocabulary: `PENDING`
     * would start 400-ing and `ACTIVE` would start passing. Asserting only the
     * happy path would not notice — both directions are checked here.
     */
    it.each([
        'all',
        'ACTIVE',
        'DRAFT',
        'ARCHIVED'
    ])('no longer accepts the inherited lifecycle value %s', (value) => {
        const result = HostTradeBenefitUsageAdminSearchSchema.safeParse({ status: value });
        expect(result.success).toBe(false);
    });

    it('leaves status absent when not provided — the base default("all") is dropped', () => {
        const result = HostTradeBenefitUsageAdminSearchSchema.safeParse({});
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.status).toBeUndefined();
        }
    });

    it('rejects a creationChannel outside the enum', () => {
        const result = HostTradeBenefitUsageAdminSearchSchema.safeParse({
            creationChannel: 'SMS'
        });
        expect(result.success).toBe(false);
    });
});
