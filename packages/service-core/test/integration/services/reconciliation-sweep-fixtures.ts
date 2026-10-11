import {
    billingDeadlineVersions,
    eq,
    providerLinks,
    reconciliationInventoryModel,
    subscriptionModel,
    subscriptions,
    users
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import type { BillingDeadlineValues } from '@repo/schemas';
import { vi } from 'vitest';
import { getServiceTestDb, getServiceTestPool } from './helpers.js';

const seededIds = new Set<string>();
export function resetSeededReconciliationInventory(): void {
    seededIds.clear();
}

export async function withSeededReconciliationInventory<T>(run: () => Promise<T>): Promise<T> {
    const original = reconciliationInventoryModel.listSweepInventoryPage.bind(
        reconciliationInventoryModel
    );
    const spy = vi.spyOn(reconciliationInventoryModel, 'listSweepInventoryPage');
    spy.mockImplementation(async (input) => {
        const rows = await original({ ...input, limit: 10_000 });
        const owned = rows.filter(({ subscription }) => seededIds.has(subscription.id));
        const after =
            input.afterSubscriptionId === undefined
                ? owned
                : owned.filter(({ subscription }) => subscription.id > input.afterSubscriptionId!);
        return after.slice(0, input.limit);
    });
    try {
        return await run();
    } finally {
        spy.mockRestore();
    }
}

export const reconciliationClock = { now: () => new Date('2026-10-11T12:00:00.000Z') };
export const reconciliationDeadlineValues = {
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
} as const satisfies BillingDeadlineValues;

export function createReconciliationFake(clock = reconciliationClock) {
    const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
    return { fake, provider: fake as unknown as PaymentProvider };
}

async function anchors() {
    const db = getServiceTestDb();
    const userIds: string[] = [];
    await db
        .insert(billingDeadlineVersions)
        .values({ version: 1, values: reconciliationDeadlineValues })
        .onConflictDoNothing();
    const [user] = await db
        .insert(users)
        .values({
            email: `reconciliation-${crypto.randomUUID()}@example.test`,
            displayName: 'Reconciliation test',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('No user was seeded');
    userIds.push(user.id);
    const planId = (
        await getServiceTestPool().query<{ id: string }>(
            'INSERT INTO plan (vertical, slug, name) VALUES ($1, $2, $3) RETURNING id',
            ['accommodation', `reconciliation-${crypto.randomUUID()}`, 'Reconciliation']
        )
    ).rows[0]?.id;
    if (!planId) throw new Error('No plan was seeded');
    const versionId = (
        await getServiceTestPool().query<{ id: string }>(
            "INSERT INTO plan_version (plan_id, vertical, rank, sellable, current, trial_days, allows_pause) VALUES ($1, 'accommodation', $2, true, true, 0, false) RETURNING id",
            [planId, Math.floor(Math.random() * 100000000) + 1]
        )
    ).rows[0]?.id;
    if (!versionId) throw new Error('No plan version was seeded');
    const optionId = (
        await getServiceTestPool().query<{ id: string }>(
            "INSERT INTO billing_option (plan_version_id, cycle, amount, currency) VALUES ($1, 'monthly', 250000, 'ARS') RETURNING id",
            [versionId]
        )
    ).rows[0]?.id;
    if (!optionId) throw new Error('No billing option was seeded');
    return { userId: user.id, versionId, optionId };
}

export async function seedSubscription(
    options: {
        status?: string;
        class?: 'PRINCIPAL' | 'COMPLEMENTO';
        paymentMethod?: 'CARD' | 'MANUAL';
        withLink?: boolean;
        fake?: FakePaymentProvider;
    } = {}
) {
    const choice = await anchors();
    const pending = await subscriptionModel.createPendingAuthorization({
        userId: choice.userId,
        vertical: 'accommodation',
        planVersionId: choice.versionId,
        billingOptionId: choice.optionId,
        authorizationWindowDeadlineVersion: 1,
        authorizationWindowEndsAt: new Date('2027-01-01T00:00:00.000Z')
    });
    const id = pending.subscription.id;
    seededIds.add(id);
    const [row] = await getServiceTestDb()
        .update(subscriptions)
        .set({
            status: options.status ?? 'ACTIVE',
            class: options.class ?? 'PRINCIPAL',
            paymentMethod: options.paymentMethod ?? 'CARD'
        })
        .where(eq(subscriptions.id, id))
        .returning();
    if (!row) throw new Error('No subscription was seeded');
    let providerId: string | undefined;
    if (options.withLink) {
        if (!options.fake) throw new Error('A fake provider is required for linked rows');
        const auth = await options.fake.authorize({
            reference: id,
            amount: { amountMinor: 250000, currency: 'ARS' },
            cadence: { everyMonths: 1 },
            reason: 'reconciliation integration fixture',
            returnUrl: 'https://example.test/return',
            payerEmail: `payer-${crypto.randomUUID()}@example.test`
        });
        await options.fake.approve({ authorizationId: auth.authorizationId });
        providerId = auth.authorizationId;
        await getServiceTestDb().insert(providerLinks).values({
            subscriptionId: id,
            provider: 'MERCADO_PAGO',
            providerId
        });
    }
    return { subscription: row, providerId };
}
