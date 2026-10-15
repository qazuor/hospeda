import type { SelectProviderLink, SelectSubscription, SyncNextChargeAtInput } from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { describe, expect, it, vi } from 'vitest';
import {
    createNextChargeSync,
    decideNextChargeWrite
} from '../../../../src/services/billing/reconciliation/sweep/next-charge-sync.js';
import type { ReconciliationComparisonInput } from '../../../../src/services/billing/reconciliation/sweep/reconciliation-divergence.js';

const next = '2026-10-16T15:00:00.000Z';

function input(
    overrides: {
        readonly status?: string;
        readonly paymentMethod?: string | null;
        readonly class?: string;
        readonly nextChargeAt?: Date | null;
        readonly providerStatus?: string;
        readonly providerNextChargeAt?: string | null;
    } = {}
) {
    return {
        subscription: {
            status: overrides.status ?? 'ACTIVE',
            paymentMethod: overrides.paymentMethod ?? 'CARD',
            class: overrides.class ?? 'PRINCIPAL',
            nextChargeAt: overrides.nextChargeAt ?? null
        },
        providerStatus: overrides.providerStatus ?? 'active',
        providerNextChargeAt:
            overrides.providerNextChargeAt === undefined ? next : overrides.providerNextChargeAt
    };
}

function subscription(overrides: Partial<SelectSubscription> = {}): SelectSubscription {
    const now = new Date('2026-10-15T12:00:00.000Z');
    return {
        id: '00000000-0000-4000-8000-000000000001',
        userId: '00000000-0000-4000-8000-000000000002',
        vertical: 'accommodation',
        planVersionId: '00000000-0000-4000-8000-000000000003',
        billingOptionId: '00000000-0000-4000-8000-000000000004',
        paymentMethod: 'CARD',
        status: 'ACTIVE',
        class: 'PRINCIPAL',
        nextChargeAt: null,
        serviceEndsAt: null,
        firstChargeAt: null,
        authorizationWindowDeadlineVersion: null,
        authorizationWindowEndsAt: null,
        graceStartedAt: null,
        graceEndsAt: null,
        renewalNoticeDeadlineVersion: null,
        renewalNoticeChargeAt: null,
        succeedsId: null,
        succeededById: null,
        createdAt: now,
        updatedAt: now,
        ...overrides
    };
}

function providerLink(providerId: string): SelectProviderLink {
    return {
        id: '00000000-0000-4000-8000-000000000005',
        subscriptionId: subscription().id,
        provider: 'MERCADO_PAGO',
        providerId,
        lastAppliedVersion: null,
        lastModified: null,
        cancelledSeenAt: null
    };
}

describe('TEST:1685:2 the next charge decision', () => {
    it('writes a distinct provider date for an ACTIVE CARD PRINCIPAL', () => {
        expect(decideNextChargeWrite(input())).toEqual(new Date(next));
    });

    it('writes a distinct provider date for an ACTIVE CARD COMPLEMENTO', () => {
        expect(decideNextChargeWrite(input({ class: 'COMPLEMENTO' }))).toEqual(new Date(next));
    });

    it('copies a past provider date without applying the notice horizon', () => {
        const past = '2026-10-01T15:00:00.000Z';
        expect(decideNextChargeWrite(input({ providerNextChargeAt: past }))).toEqual(
            new Date(past)
        );
    });

    it('does not write when the dates match by instant', () => {
        expect(
            decideNextChargeWrite(input({ nextChargeAt: new Date('2026-10-16T12:00:00-03:00') }))
        ).toBeNull();
    });

    it.each([
        null,
        'not-a-date'
    ])('does not write an absent or invalid provider date (%s)', (value) => {
        expect(decideNextChargeWrite(input({ providerNextChargeAt: value }))).toBeNull();
    });

    it.each([
        'paused',
        'cancelled',
        'pending'
    ])('does not write for provider status %s', (providerStatus) => {
        expect(decideNextChargeWrite(input({ providerStatus }))).toBeNull();
    });

    it.each([
        'GRACE_PERIOD',
        'SUSPENDED',
        'PAUSED',
        'CANCEL_SCHEDULED',
        'CANCELLED',
        'PENDING_AUTHORIZATION'
    ])('does not write for local status %s', (status) => {
        expect(decideNextChargeWrite(input({ status }))).toBeNull();
    });

    it('does not write for a MANUAL subscription', () => {
        expect(decideNextChargeWrite(input({ paymentMethod: 'MANUAL' }))).toBeNull();
    });

    it('TEST:1685:2 calls sync once with the provider date and act start', async () => {
        const now = new Date('2026-10-15T12:00:00.000Z');
        const fake = new FakePaymentProvider({ clock: { now: () => now } });
        const authorization = await fake.authorize({
            reference: subscription().id,
            amount: { amountMinor: 1500, currency: 'ARS' },
            cadence: { everyMonths: 1 },
            reason: 'test subscription',
            returnUrl: 'https://example.test/return'
        });
        await fake.approve({ authorizationId: authorization.authorizationId });
        const read = await fake.readAuthorization({
            authorizationId: authorization.authorizationId
        });
        const row: ReconciliationComparisonInput = {
            subscription: subscription(),
            providerLink: providerLink(authorization.authorizationId),
            read,
            act: { kind: 'decision', startedAt: now }
        };
        const sync = vi.fn(async (_input: SyncNextChargeAtInput) => true);

        await createNextChargeSync({ sync })(row);

        expect(sync).toHaveBeenCalledTimes(1);
        expect(sync).toHaveBeenCalledWith({
            subscriptionId: row.subscription.id,
            nextChargeAt: now,
            now
        });
    });

    it('TEST:1685:2 does not call sync when the decision has no date', async () => {
        const now = new Date('2026-10-15T12:00:00.000Z');
        const fake = new FakePaymentProvider({ clock: { now: () => now } });
        const authorization = await fake.authorize({
            reference: subscription().id,
            amount: { amountMinor: 1500, currency: 'ARS' },
            cadence: { everyMonths: 1 },
            reason: 'test subscription',
            returnUrl: 'https://example.test/return'
        });
        const read = await fake.readAuthorization({
            authorizationId: authorization.authorizationId
        });
        const sync = vi.fn(async (_input: SyncNextChargeAtInput) => true);
        await createNextChargeSync({ sync })({
            subscription: subscription(),
            providerLink: providerLink(authorization.authorizationId),
            read,
            act: { kind: 'decision', startedAt: now }
        });
        expect(sync).not.toHaveBeenCalled();
    });

    it('TEST:1685:2 refuses a stale read before sync', async () => {
        const now = new Date('2026-10-15T12:00:00.000Z');
        const fake = new FakePaymentProvider({ clock: { now: () => now } });
        const authorization = await fake.authorize({
            reference: subscription().id,
            amount: { amountMinor: 1500, currency: 'ARS' },
            cadence: { everyMonths: 1 },
            reason: 'test subscription',
            returnUrl: 'https://example.test/return'
        });
        await fake.approve({ authorizationId: authorization.authorizationId });
        const read = await fake.readAuthorization({
            authorizationId: authorization.authorizationId
        });
        const sync = vi.fn(async (_input: SyncNextChargeAtInput) => true);
        await expect(
            createNextChargeSync({ sync })({
                subscription: subscription(),
                providerLink: providerLink(authorization.authorizationId),
                read,
                act: { kind: 'decision', startedAt: new Date(now.getTime() + 1) }
            })
        ).rejects.toThrow();
        expect(sync).not.toHaveBeenCalled();
    });

    it('TEST:1685:2 propagates a sync port failure', async () => {
        const now = new Date('2026-10-15T12:00:00.000Z');
        const fake = new FakePaymentProvider({ clock: { now: () => now } });
        const authorization = await fake.authorize({
            reference: subscription().id,
            amount: { amountMinor: 1500, currency: 'ARS' },
            cadence: { everyMonths: 1 },
            reason: 'test subscription',
            returnUrl: 'https://example.test/return'
        });
        await fake.approve({ authorizationId: authorization.authorizationId });
        const read = await fake.readAuthorization({
            authorizationId: authorization.authorizationId
        });
        const failure = new Error('sync failed');
        const sync = vi.fn(async (_input: SyncNextChargeAtInput) => {
            throw failure;
        });
        await expect(
            createNextChargeSync({ sync })({
                subscription: subscription(),
                providerLink: providerLink(authorization.authorizationId),
                read,
                act: { kind: 'decision', startedAt: now }
            })
        ).rejects.toBe(failure);
    });
});
