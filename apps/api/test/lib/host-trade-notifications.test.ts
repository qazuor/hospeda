/**
 * The emails the benefit chain runs on (HOS-376 T-041).
 *
 * Two properties, and neither is "an email goes out".
 *
 * WHO GETS IT IS DECIDED BY `declaredBy`. A provider declared it, so the host
 * answers; a host declared it, so the provider does. Getting this backwards
 * would send every request to the person who already knows, and the whole
 * chain would stall with nobody noticing — the confirmations simply would not
 * arrive.
 *
 * NOTHING HERE CAN BREAK THE REQUEST. Every send is wrapped: a missing account
 * row, a listing that vanished, a transport that throws — all of them resolve
 * to silence, because the row is already written and failing afterwards would
 * report recorded work as an error.
 *
 * @module test/lib/host-trade-notifications
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockTrySend, mockSelect } = vi.hoisted(() => ({
    mockTrySend: vi.fn(),
    mockSelect: vi.fn()
}));

vi.mock('../../src/utils/notification-helper', () => ({
    trySendNotification: mockTrySend
}));

// `@repo/db` is replaced WHOLESALE rather than partially: its tables are
// re-exported with `export *`, which does not survive the spread of
// `importActual`, and reading one off a partial mock throws — an error `safely`
// then swallows, so every send vanishes and the failure reads like a routing
// bug rather than a mock problem.
//
// The tables are opaque here, and `eq` is stubbed with them, because what this
// file tests is WHO the email goes to. Whether the SQL is right is not
// something a mocked query builder could tell us either way.
// `eq` carries the VALUE it was given, which is what makes the stub below a
// lookup rather than a queue. With a blind stub the recipient tests pass no
// matter which id the code asks for — mutation testing proved it: inverting
// who receives the confirmation request changed nothing.
vi.mock('drizzle-orm', () => ({ eq: (_column: unknown, value: unknown) => ({ value }) }));

vi.mock('@repo/db', () => ({
    getDb: () => ({ select: mockSelect }),
    hostTrades: {},
    hostTradeReviews: {},
    users: {}
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

vi.mock('../../src/utils/env', () => ({
    env: { HOSPEDA_SITE_URL: 'https://hospeda.com.ar' }
}));

const {
    notifyReplyModerated,
    notifyReviewCreated,
    notifyUsageConfirmed,
    notifyUsageDeclared,
    notifyUsageRejected
} = await import('../../src/lib/host-trade-notifications.js');

const HOST_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_ID = '22222222-2222-4222-8222-222222222222';
const HT_ID = '33333333-3333-4333-8333-333333333333';
const REVIEW_ID = '44444444-4444-4444-8444-444444444444';

const LISTING = { name: 'Plomería Acme', slug: 'plomeria-acme', ownerUserId: OWNER_ID };
const HOST = { id: HOST_ID, email: 'anfitrion@example.com', displayName: 'Marta Giménez' };
const OWNER = { id: OWNER_ID, email: 'plomero@example.com', displayName: 'Juan Pérez' };

/**
 * A fake database keyed by id, not a queue of rows.
 *
 * Every read in this module is `select(...).from(x).where(eq(col, id)).limit(1)`,
 * so keying on the id the code asked for is what lets these tests observe WHO
 * was looked up. A stub that served rows in call order answers the same thing
 * however the recipient is chosen, which makes the routing untestable.
 */
function stubDb(rows: Record<string, unknown>) {
    mockSelect.mockImplementation(() => ({
        from: () => ({
            where: (clause: { value?: string }) => ({
                limit: async () => {
                    const row = clause?.value ? rows[clause.value] : undefined;
                    return row ? [row] : [];
                }
            })
        })
    }));
}

const usage = (declaredBy: 'PROVIDER' | 'HOST') => ({
    id: '55555555-5555-4555-8555-555555555555',
    hostTradeId: HT_ID,
    hostUserId: HOST_ID,
    declaredBy,
    servicedAt: '2026-08-01',
    expiresAt: '2026-08-31T00:00:00.000Z'
});

beforeEach(() => {
    vi.clearAllMocks();
    mockTrySend.mockResolvedValue({ delivered: true });
});

describe('notifyUsageDeclared', () => {
    /** A provider declared, so the HOST is the one who has to answer. */
    it('asks the host when the provider declared', async () => {
        stubDb({ [HT_ID]: LISTING, [HOST_ID]: HOST, [OWNER_ID]: OWNER });

        await notifyUsageDeclared(usage('PROVIDER'));

        expect(mockTrySend).toHaveBeenCalledTimes(1);
        const sent = mockTrySend.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(sent.type).toBe('host_trade_usage_confirmation_request');
        expect(sent.recipientEmail).toBe(HOST.email);
        expect(sent.counterpartName).toBe(LISTING.name);
    });

    /** A host declared, so the PROVIDER's owner has to answer. */
    it('asks the provider when the host declared', async () => {
        stubDb({ [HT_ID]: LISTING, [HOST_ID]: HOST, [OWNER_ID]: OWNER });

        await notifyUsageDeclared(usage('HOST'));

        expect(mockTrySend).toHaveBeenCalledTimes(1);
        const sent = mockTrySend.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(sent.recipientEmail).toBe(OWNER.email);
        expect(sent.counterpartName).toBe(HOST.displayName);
    });

    it('sends nothing when the recipient has no account row', async () => {
        stubDb({ [HT_ID]: LISTING });

        await notifyUsageDeclared(usage('PROVIDER'));

        expect(mockTrySend).not.toHaveBeenCalled();
    });

    /** The listing could have been hard-deleted between write and send. */
    it('sends nothing when the listing is gone', async () => {
        stubDb({});

        await notifyUsageDeclared(usage('PROVIDER'));

        expect(mockTrySend).not.toHaveBeenCalled();
    });

    /** NOTHING HERE MAY BREAK THE REQUEST. */
    it('swallows a transport that throws', async () => {
        stubDb({ [HT_ID]: LISTING, [HOST_ID]: HOST, [OWNER_ID]: OWNER });
        mockTrySend.mockRejectedValue(new Error('smtp down'));

        await expect(notifyUsageDeclared(usage('PROVIDER'))).resolves.toBeUndefined();
    });
});

describe('notifyUsageConfirmed', () => {
    /**
     * The review invitation only rides along for a HOST declarant: a provider
     * cannot review his own listing, so inviting him would point at a form the
     * eligibility gates refuse.
     */
    it('invites the host to review when the host declared', async () => {
        stubDb({ [HT_ID]: LISTING, [HOST_ID]: HOST, [OWNER_ID]: OWNER });

        await notifyUsageConfirmed(usage('HOST'));

        const sent = mockTrySend.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(sent.type).toBe('host_trade_usage_confirmed');
        expect(sent.recipientEmail).toBe(HOST.email);
        expect(sent.canReview).toBe(true);
        expect(sent.reviewUrl).toContain(LISTING.slug);
    });

    it('does not invite the provider to review himself', async () => {
        stubDb({ [HT_ID]: LISTING, [HOST_ID]: HOST, [OWNER_ID]: OWNER });

        await notifyUsageConfirmed(usage('PROVIDER'));

        const sent = mockTrySend.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(sent.recipientEmail).toBe(OWNER.email);
        expect(sent.canReview).toBe(false);
        expect(sent.reviewUrl).toBeUndefined();
    });
});

describe('notifyUsageRejected', () => {
    it('tells the declarant and carries the note', async () => {
        stubDb({ [HT_ID]: LISTING, [HOST_ID]: HOST, [OWNER_ID]: OWNER });

        await notifyUsageRejected(usage('HOST'), 'Nunca vino a casa.');

        expect(mockTrySend).toHaveBeenCalledTimes(1);
        const sent = mockTrySend.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(sent.type).toBe('host_trade_usage_rejected');
        expect(sent.recipientEmail).toBe(HOST.email);
        expect(sent.note).toBe('Nunca vino a casa.');
    });

    it('sends without a note when there was none', async () => {
        stubDb({ [HT_ID]: LISTING, [HOST_ID]: HOST, [OWNER_ID]: OWNER });

        await notifyUsageRejected(usage('HOST'));

        const sent = mockTrySend.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(sent.note).toBeUndefined();
    });
});

describe('notifyReviewCreated', () => {
    it('tells the provider what was published about his listing', async () => {
        stubDb({ [HT_ID]: LISTING, [OWNER_ID]: OWNER });

        await notifyReviewCreated({
            hostTradeId: HT_ID,
            overallRating: 2,
            respectedBenefit: false
        });

        expect(mockTrySend).toHaveBeenCalledTimes(1);
        const sent = mockTrySend.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(sent.type).toBe('host_trade_review_received');
        expect(sent.recipientEmail).toBe(OWNER.email);
        expect(sent.overallRating).toBe(2);
        expect(sent.respectedBenefit).toBe(false);
    });
});

describe('notifyReplyModerated', () => {
    /**
     * A reply hangs off the REVIEW, not off the listing — there is no
     * `hostTradeId` on the row. Reading one straight off the reply resolves to
     * nothing and drops this email in silence, which is exactly the bug this
     * test exists to keep out: AC-24 makes this the only place a rejected
     * provider ever sees the moderator's reason.
     */
    it('reaches the provider through the review the reply answers', async () => {
        stubDb({ [REVIEW_ID]: { hostTradeId: HT_ID }, [HT_ID]: LISTING, [OWNER_ID]: OWNER });

        await notifyReplyModerated({
            reviewId: REVIEW_ID,
            outcome: 'rejected',
            reason: 'Incluía un domicilio.'
        });

        expect(mockTrySend).toHaveBeenCalledTimes(1);
        const sent = mockTrySend.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(sent.type).toBe('host_trade_reply_moderated');
        expect(sent.recipientEmail).toBe(OWNER.email);
        expect(sent.outcome).toBe('rejected');
        expect(sent.reason).toBe('Incluía un domicilio.');
    });

    it('sends nothing when the review is gone', async () => {
        stubDb({});

        await notifyReplyModerated({ reviewId: REVIEW_ID, outcome: 'approved' });

        expect(mockTrySend).not.toHaveBeenCalled();
    });
});
