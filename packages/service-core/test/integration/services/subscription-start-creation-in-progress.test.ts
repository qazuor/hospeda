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
import { FakePaymentProvider } from '@repo/payments/fake';
import type { BillingDeadlineValues } from '@repo/schemas';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { startSubscription } from '../../../src/services/billing/subscription/start-subscription.service';
import { closeServiceTestPool, getServiceTestDb, getServiceTestPool } from './helpers';
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

function ports(fake: FakePaymentProvider) {
    return {
        provider: namespaceFake(fake),
        clock,
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
    it('keeps another billing option on COMMITMENT_TAKEN', async () => {
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
    });
});
