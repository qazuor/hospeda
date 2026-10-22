import {
    billingDeadlineVersions,
    domainEvent,
    eq,
    getDb,
    idempotencyKeys,
    providerLinks,
    subscriptions,
    users
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import type { BillingDeadlineValues } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { handleUnknownAuthorization } from '../../../src/services/billing/reconciliation/handle-unknown-authorization.service';
import { retryOurCancellation } from '../../../src/services/billing/reconciliation/sweep/our-cancellation-retry';
import { cancelPendingAttempt } from '../../../src/services/billing/subscription/cancel-pending-attempt.service';
import { startSubscription } from '../../../src/services/billing/subscription/start-subscription.service';
import { closeServiceTestPool, getServiceTestDb, getServiceTestPool } from './helpers';
import { namespaceFake } from './support/payment-provider';
import { noTouristVip } from './support/tourist-vip.ts';

const clock = { now: () => new Date('2026-10-08T20:00:00.000Z') };
const deadlines = {
    '10': { cardHours: 72, manualDays: 7 },
    '11': { noticeDays: 60, contactDays: [30, 7] },
    '12': { noticeDays: 60, contactDays: [30, 7] },
    '13': { daysBefore: [5, 1] },
    '14': { daysBefore: 7 },
    '15': { hoursRemaining: 24 },
    '16': { days: 7 },
    '17': { days: 7 },
    '18': { days: 180 },
    '19': { minutes: 60 }
} satisfies BillingDeadlineValues;

async function ensureBillingDeadlineVersion1() {
    await getServiceTestDb()
        .insert(billingDeadlineVersions)
        .values({ version: 1, values: deadlines })
        .onConflictDoNothing();
}
beforeAll(ensureBillingDeadlineVersion1);
afterAll(closeServiceTestPool);

async function seedChoice() {
    const [user] = await getServiceTestDb()
        .insert(users)
        .values({
            email: `b3-cancel-${crypto.randomUUID()}@example.test`,
            displayName: 'B3 cancel user',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('No user');
    const planId = (
        await getServiceTestPool().query<{ id: string }>(
            'INSERT INTO plan (vertical, slug, name) VALUES ($1, $2, $3) RETURNING id',
            ['accommodation', `b3-cancel-${crypto.randomUUID()}`, 'Basic']
        )
    ).rows[0]?.id;
    if (!planId) throw new Error('No plan');
    const versionId = (
        await getServiceTestPool().query<{ id: string }>(
            "INSERT INTO plan_version (plan_id, vertical, rank, sellable, current, trial_days, allows_pause) VALUES ($1, 'accommodation', $2, true, true, 0, false) RETURNING id",
            [planId, Math.floor(Math.random() * 100000000) + 1000]
        )
    ).rows[0]?.id;
    if (!versionId) throw new Error('No version');
    const optionIds = await Promise.all(
        ['monthly', 'annually'].map(
            async (cycle) =>
                (
                    await getServiceTestPool().query<{ id: string }>(
                        "INSERT INTO billing_option (plan_version_id, cycle, amount, currency) VALUES ($1, $2, 250000, 'ARS') RETURNING id",
                        [versionId, cycle]
                    )
                ).rows[0]!.id
        )
    );
    return { user, optionIds };
}

function ports(fake: FakePaymentProvider, beforeCancel = vi.fn(async () => 'SENT' as const)) {
    return {
        provider: namespaceFake(fake),
        clock,
        beforeCancelNotice: { beforeCancel },
        planPolicy: async () => ({
            graceDays: 10,
            allowsPause: false,
            current: true,
            sellable: true
        }),
        touristVipInheritance: noTouristVip
    };
}

async function start(fake: FakePaymentProvider, userId: string, billingOptionId: string) {
    return startSubscription(
        {
            userId,
            billingOptionId,
            returnUrl: 'https://hospeda.example/account',
            payerEmail: 'buyer@example.test'
        },
        ports(fake)
    );
}

async function saved(subscriptionId: string) {
    const row = (
        await getDb().select().from(subscriptions).where(eq(subscriptions.id, subscriptionId))
    )[0]!;
    const link = (
        await getDb()
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, subscriptionId))
    )[0]!;
    const key = (
        await getDb()
            .select()
            .from(idempotencyKeys)
            .where(eq(idempotencyKeys.subjectId, subscriptionId))
    )[0]!;
    return { row, link, key };
}

describe('TEST:1735:1 AC:1735:1 cancelPendingAttempt closes the pending attempt and releases the vertical commitment', () => {
    it('preserves the provider link, records S40 and allows another option to start', async () => {
        const choice = await seedChoice();
        const fake = new FakePaymentProvider({
            idNamespace: crypto.randomUUID(),
            clock,
            honestAbout: [{ lie: 'M1', why: 'provide an applied authorization' }]
        });
        const pending = await start(fake, choice.user.id, choice.optionIds[0]!);
        const original = await saved(pending.subscriptionId);
        const result = await cancelPendingAttempt(
            { subscriptionId: pending.subscriptionId, userId: choice.user.id },
            ports(fake)
        );
        expect(result).toEqual({ subscriptionId: pending.subscriptionId, outcome: 'ABANDONED' });
        const closed = await saved(pending.subscriptionId);
        expect(closed.row.status).toBe('ABANDONED');
        expect(closed.link.providerId).toBe(original.link.providerId);
        expect(closed.key.key).toBe(original.key.key);
        const events = await getDb()
            .select()
            .from(domainEvent)
            .where(eq(domainEvent.entityId, pending.subscriptionId));
        expect(events).toEqual(
            expect.arrayContaining([expect.objectContaining({ reason: 'S40' })])
        );
        const next = await start(fake, choice.user.id, choice.optionIds[1]!);
        expect(next.subscriptionId).not.toBe(pending.subscriptionId);
        expect(next.checkoutUrl).toBeTruthy();
    });
});

describe('TEST:1735:2 AC:1735:2 cancellation waits for the before-cancel notice and the sweep retries S40', () => {
    it('closes despite a pending notice and retries with ATTEMPT_CANCELLED', async () => {
        const choice = await seedChoice();
        const fake = new FakePaymentProvider({
            idNamespace: crypto.randomUUID(),
            clock,
            honestAbout: [{ lie: 'M1', why: 'provide an applied authorization' }]
        });
        const pending = await start(fake, choice.user.id, choice.optionIds[0]!);
        const { row, link } = await saved(pending.subscriptionId);
        const beforeCancel = vi
            .fn()
            .mockResolvedValueOnce('NOT_YET_SENT')
            .mockResolvedValueOnce('SENT');
        const cancel = vi.spyOn(fake, 'cancel');
        expect(
            await cancelPendingAttempt(
                { subscriptionId: pending.subscriptionId, userId: choice.user.id },
                ports(fake, beforeCancel)
            )
        ).toEqual({ subscriptionId: pending.subscriptionId, outcome: 'ABANDONED' });
        expect(beforeCancel).toHaveBeenCalledWith(
            expect.objectContaining({ kind: 'ATTEMPT_CANCELLED' })
        );
        expect(cancel).not.toHaveBeenCalled();
        await retryOurCancellation(
            {
                subscription: row,
                providerLink: link,
                decision: { transition: 'S40', decidedAt: clock.now() },
                correlationId: crypto.randomUUID()
            },
            { provider: namespaceFake(fake), clock, beforeCancelNotice: { beforeCancel } }
        );
        expect(beforeCancel).toHaveBeenLastCalledWith(
            expect.objectContaining({ kind: 'ATTEMPT_CANCELLED' })
        );
        expect(cancel).toHaveBeenCalledOnce();
    });
});

describe('TEST:1735:3 AC:1735:3 provider reread controls whether the pending attempt can be abandoned', () => {
    it('leaves an authorized preapproval untouched and closes an already cancelled one', async () => {
        const choice = await seedChoice();
        const fake = new FakePaymentProvider({
            idNamespace: crypto.randomUUID(),
            clock,
            honestAbout: [{ lie: 'M1', why: 'provide applied authorizations' }]
        });
        const first = await start(fake, choice.user.id, choice.optionIds[0]!);
        const { link } = await saved(first.subscriptionId);
        await fake.approve({ authorizationId: link.providerId });
        const cancel = vi.spyOn(fake, 'cancel');
        await expect(
            cancelPendingAttempt(
                { subscriptionId: first.subscriptionId, userId: choice.user.id },
                ports(fake)
            )
        ).rejects.toMatchObject({ reason: 'COMMITMENT_TAKEN' });
        expect((await saved(first.subscriptionId)).row.status).toBe('PENDING_AUTHORIZATION');
        expect(cancel).not.toHaveBeenCalled();
        const second = await start(fake, choice.user.id, choice.optionIds[1]!);
        const secondLink = (await saved(second.subscriptionId)).link;
        await fake.cancel({ authorizationId: secondLink.providerId });
        expect(
            await cancelPendingAttempt(
                { subscriptionId: second.subscriptionId, userId: choice.user.id },
                ports(fake)
            )
        ).toEqual({ subscriptionId: second.subscriptionId, outcome: 'ABANDONED' });
    });
});

describe('TEST:1735:4 AC:1735:4 only an owned, linked, completed principal pending attempt is cancellable', () => {
    it('returns already abandoned on a repeated cancellation and does not read the provider', async () => {
        const choice = await seedChoice();
        const fake = new FakePaymentProvider({
            idNamespace: crypto.randomUUID(),
            clock,
            honestAbout: [{ lie: 'M1', why: 'provide an applied authorization' }]
        });
        const pending = await start(fake, choice.user.id, choice.optionIds[0]!);
        await cancelPendingAttempt(
            { subscriptionId: pending.subscriptionId, userId: choice.user.id },
            ports(fake)
        );
        const read = vi.spyOn(fake, 'readAuthorization');
        expect(
            await cancelPendingAttempt(
                { subscriptionId: pending.subscriptionId, userId: choice.user.id },
                ports(fake)
            )
        ).toEqual({ subscriptionId: pending.subscriptionId, outcome: 'ALREADY_ABANDONED' });
        expect(read).not.toHaveBeenCalled();
    });
});

describe('TEST:1735:5 AC:1735:5 concurrent cancellation requests produce one S40 decision', () => {
    it('serializes callers and returns abandoned to one and already abandoned to the other', async () => {
        const choice = await seedChoice();
        const fake = new FakePaymentProvider({
            idNamespace: crypto.randomUUID(),
            clock,
            honestAbout: [{ lie: 'M1', why: 'provide an applied authorization' }]
        });
        const pending = await start(fake, choice.user.id, choice.optionIds[0]!);
        const results = await Promise.allSettled(
            [1, 2].map(() =>
                cancelPendingAttempt(
                    { subscriptionId: pending.subscriptionId, userId: choice.user.id },
                    ports(fake)
                )
            )
        );
        const successes = results
            .filter((result) => result.status === 'fulfilled')
            .map((result) => result.value.outcome)
            .sort();
        expect(successes).toEqual(['ABANDONED', 'ALREADY_ABANDONED']);
        const events = await getDb()
            .select()
            .from(domainEvent)
            .where(eq(domainEvent.entityId, pending.subscriptionId));
        expect(events.filter((event) => event.reason === 'S40')).toHaveLength(1);
    });
});

describe('TEST:1735:6 AC:1735:6 abandoned attempts remain known to authorization reconciliation', () => {
    it('recognizes the retained provider link without opening a mark', async () => {
        const choice = await seedChoice();
        const fake = new FakePaymentProvider({
            idNamespace: crypto.randomUUID(),
            clock,
            honestAbout: [{ lie: 'M1', why: 'provide an applied authorization' }]
        });
        const pending = await start(fake, choice.user.id, choice.optionIds[0]!);
        const { link } = await saved(pending.subscriptionId);
        await cancelPendingAttempt(
            { subscriptionId: pending.subscriptionId, userId: choice.user.id },
            ports(fake)
        );
        await expect(
            handleUnknownAuthorization(
                {
                    authorizationId: link.providerId,
                    arrival: { kind: 'AUTHORIZATION' },
                    correlationId: crypto.randomUUID()
                },
                { provider: namespaceFake(fake), clock }
            )
        ).resolves.toEqual({ outcome: 'KNOWN', subscriptionId: pending.subscriptionId });
    });
});
