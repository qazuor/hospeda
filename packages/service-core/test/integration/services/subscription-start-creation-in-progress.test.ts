import {
    billingDeadlineVersions,
    eq,
    getDb,
    idempotencyKeys,
    providerLinks,
    subscriptionModel,
    subscriptions,
    users
} from '@repo/db';
import { sanitizeApprovalUrl } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import type { BillingDeadlineValues } from '@repo/schemas';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { createAdjustableClock } from '../../../../test-clock/src/adjustable-clock.js';
import {
    CREATION_RECREATE_AFTER_MS,
    runCreationsSweep
} from '../../../src/services/billing/reconciliation/creations/creations-sweep.service.js';
import { startSubscription } from '../../../src/services/billing/subscription/start-subscription.service';
import { closeServiceTestPool, getServiceTestDb, getServiceTestPool } from './helpers';
import {
    createReconciliationFake,
    trackSeededReconciliationRow,
    withSeededPendingCreations
} from './reconciliation-sweep-fixtures.js';
import { namespaceFake } from './support/payment-provider';
import { noTouristVip } from './support/tourist-vip.ts';

afterAll(closeServiceTestPool);
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

async function seed() {
    await getServiceTestDb()
        .insert(billingDeadlineVersions)
        .values({ version: 1, values: deadlines })
        .onConflictDoNothing();
    const [user] = await getServiceTestDb()
        .insert(users)
        .values({
            email: `retry-${crypto.randomUUID()}@example.test`,
            displayName: 'Retry user',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    const planId = (
        await getServiceTestPool().query<{ id: string }>(
            'INSERT INTO plan (vertical, slug, name) VALUES ($1, $2, $3) RETURNING id',
            ['accommodation', `retry-${crypto.randomUUID()}`, 'Basic']
        )
    ).rows[0]!.id;
    const versionId = (
        await getServiceTestPool().query<{ id: string }>(
            "INSERT INTO plan_version (plan_id, vertical, rank, sellable, current, trial_days, allows_pause) VALUES ($1, 'accommodation', $2, true, true, 0, false) RETURNING id",
            [planId, Math.floor(Math.random() * 100000000) + 1000]
        )
    ).rows[0]!.id;
    const optionIds = await Promise.all(
        ['monthly', 'quarterly'].map(
            async (cycle) =>
                (
                    await getServiceTestPool().query<{ id: string }>(
                        "INSERT INTO billing_option (plan_version_id, cycle, amount, currency) VALUES ($1, $2, 250000, 'ARS') RETURNING id",
                        [versionId, cycle]
                    )
                ).rows[0]!.id
        )
    );
    return { user: user!, versionId, optionIds };
}

function ports(fake: FakePaymentProvider, injectedClock = clock) {
    return {
        provider: namespaceFake(fake),
        clock: injectedClock,
        planPolicy: async () => ({
            graceDays: 10,
            allowsPause: false,
            current: true,
            sellable: true
        }),
        beforeCancelNotice: { beforeCancel: async () => 'SENT' as const },
        touristVipInheritance: noTouristVip
    };
}

async function counts(userId: string) {
    const rows = await getDb().select().from(subscriptions).where(eq(subscriptions.userId, userId));
    const sub = rows[0];
    return {
        subscriptions: rows.length,
        keys: sub
            ? (
                  await getDb()
                      .select()
                      .from(idempotencyKeys)
                      .where(eq(idempotencyKeys.subjectId, sub.id))
              ).length
            : 0,
        links: sub
            ? (
                  await getDb()
                      .select()
                      .from(providerLinks)
                      .where(eq(providerLinks.subscriptionId, sub.id))
              ).length
            : 0
    };
}

describe('TEST:1723:1 creation in progress', () => {
    it('returns a retryable reason for a pending same-option attempt without a link', async () => {
        const { user, versionId, optionIds } = await seed();
        await subscriptionModel.createPendingAuthorization({
            userId: user.id,
            vertical: 'accommodation',
            planVersionId: versionId,
            billingOptionId: optionIds[0]!,
            authorizationWindowDeadlineVersion: 1,
            authorizationWindowEndsAt: new Date(clock.now().getTime() + 72 * 60 * 60 * 1000)
        });
        const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        const authorize = vi.spyOn(fake, 'authorize');
        await expect(
            startSubscription(
                {
                    userId: user.id,
                    billingOptionId: optionIds[0]!,
                    returnUrl: 'https://hospeda.example'
                },
                ports(fake)
            )
        ).rejects.toMatchObject({ code: 'ALREADY_EXISTS', reason: 'PREVIOUS_ATTEMPT_IN_PROGRESS' });
        expect(authorize).not.toHaveBeenCalled();
        expect(await counts(user.id)).toEqual({ subscriptions: 1, keys: 1, links: 0 });
    });
    it('TEST:1723:2 keeps another billing option on COMMITMENT_TAKEN', async () => {
        const { user, versionId, optionIds } = await seed();
        await subscriptionModel.createPendingAuthorization({
            userId: user.id,
            vertical: 'accommodation',
            planVersionId: versionId,
            billingOptionId: optionIds[0]!,
            authorizationWindowDeadlineVersion: 1,
            authorizationWindowEndsAt: new Date(clock.now().getTime() + 72 * 60 * 60 * 1000)
        });
        const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        const authorize = vi.spyOn(fake, 'authorize');
        await expect(
            startSubscription(
                {
                    userId: user.id,
                    billingOptionId: optionIds[1]!,
                    returnUrl: 'https://hospeda.example'
                },
                ports(fake)
            )
        ).rejects.toMatchObject({ reason: 'COMMITMENT_TAKEN' });
        expect(authorize).not.toHaveBeenCalled();
    });

    it('TEST:1723:1 returns the same reason when the unfinished row already has a provider link', async () => {
        const { user, versionId, optionIds } = await seed();
        const pending = await subscriptionModel.createPendingAuthorization({
            userId: user.id,
            vertical: 'accommodation',
            planVersionId: versionId,
            billingOptionId: optionIds[0]!,
            authorizationWindowDeadlineVersion: 1,
            authorizationWindowEndsAt: new Date(clock.now().getTime() + 72 * 60 * 60 * 1000)
        });
        await getServiceTestDb()
            .insert(providerLinks)
            .values({
                subscriptionId: pending.subscription.id,
                provider: 'MERCADO_PAGO',
                providerId: `retry-linked-${crypto.randomUUID()}`
            });
        const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        const authorize = vi.spyOn(fake, 'authorize');
        await expect(
            startSubscription(
                {
                    userId: user.id,
                    billingOptionId: optionIds[0]!,
                    returnUrl: 'https://hospeda.example'
                },
                ports(fake)
            )
        ).rejects.toMatchObject({ reason: 'PREVIOUS_ATTEMPT_IN_PROGRESS' });
        expect(authorize).not.toHaveBeenCalled();
        expect(await counts(user.id)).toEqual({ subscriptions: 1, keys: 1, links: 1 });
    });

    it('TEST:1723:3 retries after provider failure, sweep recreation, then returns the same sanitized link', async () => {
        const { user, optionIds } = await seed();
        const time = createAdjustableClock({ start: new Date(Date.now() + 20 * 60_000) });
        const { fake, provider } = createReconciliationFake(time);
        const authorize = vi.spyOn(fake, 'authorize').mockRejectedValueOnce(
            new (await import('@repo/payments')).PaymentProviderError({
                code: 'REJECTED',
                capability: 'authorize',
                message: 'Rejected by fake provider'
            })
        );
        const input = {
            userId: user.id,
            billingOptionId: optionIds[0]!,
            returnUrl: 'https://hospeda.example',
            payerEmail: user.email
        };
        await expect(
            startSubscription(input, { ...ports(fake, time), provider })
        ).rejects.toMatchObject({ code: 'REJECTED', capability: 'authorize' });
        const row = (
            await getDb().select().from(subscriptions).where(eq(subscriptions.userId, user.id))
        )[0]!;
        trackSeededReconciliationRow(row.id);
        await expect(
            startSubscription(input, { ...ports(fake, time), provider })
        ).rejects.toMatchObject({ reason: 'PREVIOUS_ATTEMPT_IN_PROGRESS' });
        expect(authorize).toHaveBeenCalledOnce();
        time.advance({ ms: CREATION_RECREATE_AFTER_MS + 1 });
        const summary = await withSeededPendingCreations(() =>
            runCreationsSweep({}, { provider, clock: time, returnUrl: input.returnUrl })
        );
        expect(summary).toMatchObject({ rowsExamined: 1, recreated: 1 });
        const result = await startSubscription(input, { ...ports(fake, time), provider });
        const recreatedCall = authorize.mock.results[1];
        if (!recreatedCall || recreatedCall.type !== 'return') {
            throw new Error('Expected the creation sweep to call the provider');
        }
        const recreatedAuthorization = await recreatedCall.value;
        expect(result).toMatchObject({
            subscriptionId: row.id,
            authorizationId: expect.any(String),
            checkoutUrl: sanitizeApprovalUrl(recreatedAuthorization).url
        });
        expect(authorize).toHaveBeenCalledTimes(2);
        expect(await counts(user.id)).toEqual({ subscriptions: 1, keys: 2, links: 1 });
    });
});
