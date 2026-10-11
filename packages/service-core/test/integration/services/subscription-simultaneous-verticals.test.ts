// TEST:B3:33 — simultaneous vertical subscriptions advance independently.
import {
    billingDeadlineVersions,
    emailOutbox,
    eq,
    providerLinks,
    subscriptions,
    users
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import type { BillingDeadlineValues } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { activateSubscription } from '../../../src/services/billing/subscription/activate-subscription.service.js';
import { expireAuthorizationWindows } from '../../../src/services/billing/subscription/expire-authorization-windows.service.js';
import {
    type BeforeCancelNotice,
    startSubscription
} from '../../../src/services/billing/subscription/start-subscription.service.js';
import { closeServiceTestPool, getServiceTestDb, getServiceTestPool } from './helpers.js';
import {
    seededSubscriptionIds,
    withSeededSubscriptionSweep
} from './support/subscription-window-sweep.js';
import { noTouristVip } from './support/tourist-vip.js';

afterAll(closeServiceTestPool);
afterEach(() => seededSubscriptionIds.clear());
const startAt = new Date('2026-10-01T00:00:00.000Z');
let now = startAt;
const clock = { now: () => new Date(now) };
const values = {
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

beforeAll(async () => {
    await getServiceTestDb()
        .insert(billingDeadlineVersions)
        .values({ version: 1, values })
        .onConflictDoNothing();
});

async function seedChoice(userId: string, vertical: 'accommodation' | 'gastronomy') {
    const planId = (
        await getServiceTestPool().query<{ id: string }>(
            'INSERT INTO plan (vertical, slug, name) VALUES ($1, $2, $3) RETURNING id',
            [vertical, `vertical-${vertical}-${crypto.randomUUID()}`, `${vertical} plan`]
        )
    ).rows[0]?.id;
    if (!planId) throw new Error(`missing ${vertical} plan`);
    const versionId = (
        await getServiceTestPool().query<{ id: string }>(
            'INSERT INTO plan_version (plan_id, vertical, rank, sellable, current, trial_days, allows_pause, inherits_tourist_vip) VALUES ($1, $2, $3, true, true, 0, false, false) RETURNING id',
            [planId, vertical, Math.floor(Math.random() * 1_000_000_000)]
        )
    ).rows[0]?.id;
    if (!versionId) throw new Error(`missing ${vertical} plan version`);
    const optionId = (
        await getServiceTestPool().query<{ id: string }>(
            "INSERT INTO billing_option (plan_version_id, cycle, amount, currency) VALUES ($1, 'monthly', 250000, 'ARS') RETURNING id",
            [versionId]
        )
    ).rows[0]?.id;
    if (!optionId) throw new Error(`missing ${vertical} billing option`);
    return { userId, vertical, billingOptionId: optionId };
}

async function runScenario(expireFirst: boolean) {
    now = startAt;
    const [user] = await getServiceTestDb()
        .insert(users)
        .values({
            email: `vertical-concurrency-${crypto.randomUUID()}@example.test`,
            displayName: 'Verticals',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('missing user');
    const provider = new FakePaymentProvider({
        idNamespace: crypto.randomUUID(),
        clock,
        honestAbout: [{ lie: 'M1', why: 'healthy fixture authorization' }]
    });
    const ports = {
        provider,
        clock,
        beforeCancelNotice: { beforeCancel: async () => 'SENT' } satisfies BeforeCancelNotice,
        touristVipInheritance: noTouristVip,
        planPolicy: async () => ({
            graceDays: 10,
            allowsPause: false,
            current: true,
            sellable: true
        })
    };
    const accommodation = await startSubscription(
        {
            userId: user.id,
            billingOptionId: (await seedChoice(user.id, 'accommodation')).billingOptionId,
            returnUrl: 'https://example.test'
        },
        ports
    );
    const gastronomy = await startSubscription(
        {
            userId: user.id,
            billingOptionId: (await seedChoice(user.id, 'gastronomy')).billingOptionId,
            returnUrl: 'https://example.test'
        },
        ports
    );
    seededSubscriptionIds.add(accommodation.subscriptionId);
    if (!expireFirst) seededSubscriptionIds.add(gastronomy.subscriptionId);
    const sweep = () =>
        withSeededSubscriptionSweep(20, () => expireAuthorizationWindows(20, ports));
    if (expireFirst) {
        now = new Date(startAt.getTime() + 73 * 60 * 60 * 1000);
        expect(await sweep()).toMatchObject({ abandoned: 1, activated: 0 });
        expect(
            await provider.readAuthorization({ authorizationId: accommodation.authorizationId })
        ).toMatchObject({ snapshot: { status: 'cancelled' } });
        await provider.approve({ authorizationId: gastronomy.authorizationId });
        seededSubscriptionIds.add(gastronomy.subscriptionId);
        expect(await activateSubscription(gastronomy.subscriptionId, ports)).toMatchObject({
            activated: true
        });
    } else {
        await provider.approve({ authorizationId: gastronomy.authorizationId });
        expect(await activateSubscription(gastronomy.subscriptionId, ports)).toMatchObject({
            activated: true
        });
        const [beforeRow] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, gastronomy.subscriptionId));
        const [beforeLink] = await getServiceTestDb()
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, gastronomy.subscriptionId));
        now = new Date(startAt.getTime() + 73 * 60 * 60 * 1000);
        expect(await sweep()).toMatchObject({ abandoned: 1, activated: 0 });
        const [afterRow] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, gastronomy.subscriptionId));
        const [afterLink] = await getServiceTestDb()
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, gastronomy.subscriptionId));
        expect(afterRow?.updatedAt).toEqual(beforeRow?.updatedAt);
        expect(afterLink).toEqual(beforeLink);
        expect(
            await provider.readAuthorization({ authorizationId: gastronomy.authorizationId })
        ).toMatchObject({ snapshot: { status: 'active' } });
    }
    const [accommodationRow] = await getServiceTestDb()
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, accommodation.subscriptionId));
    const [gastronomyRow] = await getServiceTestDb()
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, gastronomy.subscriptionId));
    expect(accommodationRow).toMatchObject({
        userId: user.id,
        vertical: 'accommodation',
        status: 'ABANDONED'
    });
    expect(gastronomyRow).toMatchObject({
        userId: user.id,
        vertical: 'gastronomy',
        status: 'ACTIVE'
    });
    const gastronomyNotices = (await getServiceTestDb().select().from(emailOutbox)).filter(
        (notice) =>
            (notice.payload as { subscriptionId?: string }).subscriptionId ===
            gastronomy.subscriptionId
    );
    expect(gastronomyNotices).toHaveLength(0);
    return { provider, gastronomy, userId: user.id };
}

describe('TEST:B3:33 simultaneous verticals advance independently', () => {
    it('Case A: Gastronomy activates before Accommodation expires', async () => {
        await runScenario(false);
    });
    it('Case B: Accommodation expires before Gastronomy activates', async () => {
        await runScenario(true);
    });
});
