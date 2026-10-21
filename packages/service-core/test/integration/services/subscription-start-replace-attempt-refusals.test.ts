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
    const db = getServiceTestDb();
    const [user] = await db
        .insert(users)
        .values({
            email: `b3-replace-${crypto.randomUUID()}@example.test`,
            displayName: 'B3 replacement user',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('No user');
    const planId = (
        await getServiceTestPool().query<{ id: string }>(
            'INSERT INTO plan (vertical, slug, name) VALUES ($1, $2, $3) RETURNING id',
            ['accommodation', `b3-replace-${crypto.randomUUID()}`, 'Básico']
        )
    ).rows[0]?.id;
    if (!planId) throw new Error('No plan');
    const planVersionId = (
        await getServiceTestPool().query<{ id: string }>(
            "INSERT INTO plan_version (plan_id, vertical, rank, sellable, current, trial_days, allows_pause) VALUES ($1, 'accommodation', $2, true, true, 0, false) RETURNING id",
            [planId, Math.floor(Math.random() * 100000000) + 1000]
        )
    ).rows[0]?.id;
    if (!planVersionId) throw new Error('No version');
    const billingOptionId = (
        await getServiceTestPool().query<{ id: string }>(
            "INSERT INTO billing_option (plan_version_id, cycle, amount, currency) VALUES ($1, 'quarterly', 250000, 'ARS') RETURNING id",
            [planVersionId]
        )
    ).rows[0]?.id;
    if (!billingOptionId) throw new Error('No option');
    return { user, planVersionId, billingOptionId };
}
function ports(
    provider: ReturnType<typeof namespaceFake>,
    beforeCancel = vi.fn(async () => 'SENT' as const),
    injectedClock = clock
) {
    return {
        provider,
        clock: injectedClock,
        planPolicy: async () => ({
            graceDays: 10,
            allowsPause: false,
            current: true,
            sellable: true
        }),
        beforeCancelNotice: { beforeCancel },
        touristVipInheritance: noTouristVip
    };
}
async function rows(userId: string) {
    const all = await getDb().select().from(subscriptions).where(eq(subscriptions.userId, userId));
    const keys = await Promise.all(
        all.map((row) =>
            getDb().select().from(idempotencyKeys).where(eq(idempotencyKeys.subjectId, row.id))
        )
    );
    const links = await Promise.all(
        all.map((row) =>
            getDb().select().from(providerLinks).where(eq(providerLinks.subscriptionId, row.id))
        )
    );
    return { all, keys: keys.flat(), links: links.flat() };
}

describe('TEST:1732:3 AC:1732:3 replacement refusal re-reads', () => {
    async function eligibleAttempt() {
        const choice = await seedChoice();
        const fake = new FakePaymentProvider({
            idNamespace: crypto.randomUUID(),
            clock,
            honestAbout: [{ lie: 'M1', why: 'provide an applied authorization' }]
        });
        const provider = namespaceFake(fake);
        const notices = vi.fn(async () => 'SENT' as const);
        const first = await startSubscription(
            {
                userId: choice.user.id,
                billingOptionId: choice.billingOptionId,
                returnUrl: 'https://hospeda.example/account',
                payerEmail: 'first@example.test'
            },
            ports(provider, notices)
        );
        return { choice, fake, provider, notices, first };
    }

    async function expectRefusedWithoutWrites(input: Awaited<ReturnType<typeof eligibleAttempt>>) {
        const before = await rows(input.choice.user.id);
        const authorize = vi.spyOn(input.fake, 'authorize');
        const cancel = vi.spyOn(input.fake, 'cancel');
        await expect(
            startSubscription(
                {
                    userId: input.choice.user.id,
                    billingOptionId: input.choice.billingOptionId,
                    returnUrl: 'https://hospeda.example/account',
                    payerEmail: 'second@example.test'
                },
                ports(input.provider, input.notices)
            )
        ).rejects.toMatchObject({ reason: 'COMMITMENT_TAKEN' });
        expect(await rows(input.choice.user.id)).toEqual(before);
        expect(before.all).toHaveLength(1);
        expect(before.all[0]).toMatchObject({
            id: input.first.subscriptionId,
            status: 'PENDING_AUTHORIZATION'
        });
        expect(before.links).toHaveLength(1);
        expect(before.links[0]?.subscriptionId).toBe(input.first.subscriptionId);
        expect(before.all.map((row) => row.status)).toEqual(['PENDING_AUTHORIZATION']);
        const decisions = await getDb()
            .select()
            .from(domainEvent)
            .where(eq(domainEvent.entityId, input.first.subscriptionId));
        expect(decisions.filter((event) => event.reason === 'S39')).toHaveLength(0);
        expect(authorize).not.toHaveBeenCalled();
        expect(cancel).not.toHaveBeenCalled();
        expect(input.notices).not.toHaveBeenCalled();
    }

    it('keeps an eligible attempt when the fresh read reports paused', async () => {
        const input = await eligibleAttempt();
        await input.fake.approve({
            authorizationId: input.first.authorizationId.split(':').slice(1).join(':')
        });
        await input.fake.pause({
            authorizationId: input.first.authorizationId.split(':').slice(1).join(':')
        });

        await expectRefusedWithoutWrites(input);
    });

    it('keeps an eligible attempt and logs when the read reference differs', async () => {
        const input = await eligibleAttempt();
        const originalRead = input.provider.readAuthorization;
        input.provider.readAuthorization = async (readInput) => {
            const read = await originalRead(readInput);
            return { ...read, snapshot: { ...read.snapshot, reference: 'different-subscription' } };
        };
        const error = vi.spyOn(console, 'error');

        await expectRefusedWithoutWrites(input);
        expect(error.mock.calls.flat().join(' ')).toContain(
            'Replacement read reference did not match the subscription'
        );
        expect(error.mock.calls.flat().join(' ')).toContain(input.first.subscriptionId);
        error.mockRestore();
    });

    it('propagates a NOT_FOUND read error without writing', async () => {
        const input = await eligibleAttempt();
        const before = await rows(input.choice.user.id);
        input.provider.readAuthorization = () =>
            input.fake.readAuthorization({ authorizationId: 'missing-authorization' });
        const authorize = vi.spyOn(input.fake, 'authorize');
        const cancel = vi.spyOn(input.fake, 'cancel');

        await expect(
            startSubscription(
                {
                    userId: input.choice.user.id,
                    billingOptionId: input.choice.billingOptionId,
                    returnUrl: 'https://hospeda.example/account',
                    payerEmail: 'second@example.test'
                },
                ports(input.provider, input.notices)
            )
        ).rejects.toMatchObject({
            code: 'NOT_FOUND',
            message: 'no resource with id missing-authorization'
        });
        expect(await rows(input.choice.user.id)).toEqual(before);
        expect(before.all).toHaveLength(1);
        expect(before.all[0]).toMatchObject({
            id: input.first.subscriptionId,
            status: 'PENDING_AUTHORIZATION'
        });
        expect(before.links).toHaveLength(1);
        expect(before.links[0]?.subscriptionId).toBe(input.first.subscriptionId);
        const decisions = await getDb()
            .select()
            .from(domainEvent)
            .where(eq(domainEvent.entityId, input.first.subscriptionId));
        expect(decisions.filter((event) => event.reason === 'S39')).toHaveLength(0);
        expect(authorize).not.toHaveBeenCalled();
        expect(cancel).not.toHaveBeenCalled();
        expect(input.notices).not.toHaveBeenCalled();
    });
});
