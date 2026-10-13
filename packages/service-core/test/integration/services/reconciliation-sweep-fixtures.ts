import {
    billingDeadlineVersions,
    type DrizzleClient,
    eq,
    getDb,
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
import {
    type ProviderCancellationTransition,
    recordProviderCancellationDecided
} from '../../../src/services/billing/reconciliation/provider-cancellation-decision.js';
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

/** Adds a row created outside `seedSubscription` (e.g. a receipt tombstone) to this test's inventory. */
export function trackSeededReconciliationRow(subscriptionId: string): void {
    seededIds.add(subscriptionId);
}

/**
 * Isolates the cancellation-retry population (HOS-1603, AC:B11:6) to this test's rows, like
 * {@link withSeededReconciliationInventory}: other suites leave terminal rows with decisions.
 */
export async function withSeededCancellationRetryInventory<T>(run: () => Promise<T>): Promise<T> {
    const original = reconciliationInventoryModel.listCancellationRetryPage.bind(
        reconciliationInventoryModel
    );
    const spy = vi.spyOn(reconciliationInventoryModel, 'listCancellationRetryPage');
    spy.mockImplementation(async (input) => {
        const rows = await original({ ...input, limit: 10_000, afterSubscriptionId: undefined });
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

/** Seeds one recorded cancellation decision, written in its own transaction. */
export async function seedCancellationDecision(input: {
    readonly subscriptionId: string;
    readonly transition: ProviderCancellationTransition;
    readonly decidedAt: Date;
}) {
    return getDb().transaction(async (tx) =>
        recordProviderCancellationDecided({
            subscriptionId: input.subscriptionId,
            transition: input.transition,
            decidedAt: input.decidedAt,
            actor: { type: 'job' },
            correlationId: crypto.randomUUID(),
            tx: tx as unknown as DrizzleClient
        })
    );
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

async function anchors(vertical: 'accommodation' | 'tourist' = 'accommodation') {
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
            [vertical, `reconciliation-${crypto.randomUUID()}`, 'Reconciliation']
        )
    ).rows[0]?.id;
    if (!planId) throw new Error('No plan was seeded');
    const versionId = (
        await getServiceTestPool().query<{ id: string }>(
            'INSERT INTO plan_version (plan_id, vertical, rank, sellable, current, trial_days, allows_pause) VALUES ($1, $3, $2, true, true, 0, false) RETURNING id',
            [planId, Math.floor(Math.random() * 100000000) + 1, vertical]
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
        vertical?: 'accommodation' | 'tourist';
    } = {}
) {
    const choice = await anchors(options.vertical);
    const pending = await subscriptionModel.createPendingAuthorization({
        userId: choice.userId,
        vertical: options.vertical ?? 'accommodation',
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

/** Fixture for AC:B11:23: one fresh pending creation with its durable key and recipient. */
export async function seedPendingCreation() {
    const seeded = await seedSubscription({ status: 'PENDING_AUTHORIZATION' });
    const [user] = await getServiceTestDb()
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, seeded.subscription.userId!));
    const keys = await getServiceTestPool().query<{ key: string }>(
        "SELECT key FROM idempotency_key WHERE subject_id = $1 AND operation = 'PREAPPROVAL_CREATE' ORDER BY created_at DESC LIMIT 1",
        [seeded.subscription.id]
    );
    return { ...seeded, userEmail: user?.email ?? null, key: keys.rows[0]?.key ?? null };
}

/** Isolates creation-sweep inventory from pending rows left by parallel suites. */
export async function withSeededPendingCreations<T>(run: () => Promise<T>): Promise<T> {
    const { creationSweepModel } = await import('@repo/db');
    const original = creationSweepModel.listPendingCreationPage.bind(creationSweepModel);
    const spy = vi.spyOn(creationSweepModel, 'listPendingCreationPage');
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
