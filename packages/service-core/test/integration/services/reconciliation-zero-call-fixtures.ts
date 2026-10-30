import { courtesyGrants, eq, payments, reconciliationZeroCallModel, subscriptions } from '@repo/db';
import { vi } from 'vitest';
import { getServiceTestDb } from './helpers.js';
import {
    createReconciliationFake,
    reconciliationClock,
    seedSubscription,
    withSeededReconciliationInventory
} from './reconciliation-sweep-fixtures.js';

export {
    createReconciliationFake,
    reconciliationClock,
    seedSubscription,
    withSeededReconciliationInventory
};
export const zeroCallSubscriptionIds = new Set<string>();

/** Seeds a succession pair with independent owners and the requested predecessor state. */
export async function seedSuccession(predecessorStatus: string, successorStatus = 'ACTIVE') {
    const predecessor = await seedSubscription({ status: predecessorStatus });
    const successor = await seedSubscription({ status: successorStatus });
    zeroCallSubscriptionIds.add(predecessor.subscription.id);
    zeroCallSubscriptionIds.add(successor.subscription.id);
    await getServiceTestDb()
        .update(subscriptions)
        .set({ succeedsId: predecessor.subscription.id })
        .where(eq(subscriptions.id, successor.subscription.id));
    await getServiceTestDb()
        .update(subscriptions)
        .set({ succeededById: successor.subscription.id })
        .where(eq(subscriptions.id, predecessor.subscription.id));
    return { predecessor: predecessor.subscription, successor: successor.subscription };
}

/** Seeds a deferred courtesy owned by a predecessor with its linked successor. */
export async function seedDeferredCourtesy(
    successorStatus = 'ACTIVE',
    balanceMonths: number | null = 2
) {
    const pair = await seedSuccession('ACTIVE', successorStatus);
    const ownerId = pair.predecessor.userId;
    if (!ownerId) throw new Error('Courtesy predecessor has no owner');
    const grantValues: typeof courtesyGrants.$inferInsert = {
        beneficiaryUserId: ownerId,
        grantedBy: ownerId,
        subscriptionId: pair.predecessor.id,
        months: 4,
        balanceMonths,
        startsAt: new Date('2026-01-01T00:00:00.000Z'),
        endsAt: new Date('2027-01-01T00:00:00.000Z'),
        reason: 'TEST:B11:18'
    };
    const [grant] = await getServiceTestDb().insert(courtesyGrants).values(grantValues).returning();
    if (!grant) throw new Error('Courtesy fixture was not inserted');
    return { ...pair, grant };
}

/** Seeds a succeeded provider payment on its owner row. */
export async function seedRetainedPayment(subscriptionId: string) {
    const [payment] = await getServiceTestDb()
        .insert(payments)
        .values({
            subscriptionId,
            amount: 250000,
            currency: 'ARS',
            status: 'SUCCEEDED',
            provider: 'MERCADO_PAGO',
            providerFactId: crypto.randomUUID(),
            factAt: new Date('2026-10-10T12:00:00.000Z')
        })
        .returning();
    if (!payment) throw new Error('Payment fixture was not inserted');
    return payment;
}

/** Isolates zero-call DB selectors to only rows seeded by the current test. */
export async function withSeededZeroCallPopulations<T>(run: () => Promise<T>): Promise<T> {
    const successionOriginal =
        reconciliationZeroCallModel.listOpenSuccessionsOnDeadPredecessorsPage.bind(
            reconciliationZeroCallModel
        );
    const courtesyOriginal =
        reconciliationZeroCallModel.listDeferredCourtesiesWithActiveSuccessorPage.bind(
            reconciliationZeroCallModel
        );
    const successionSpy = vi.spyOn(
        reconciliationZeroCallModel,
        'listOpenSuccessionsOnDeadPredecessorsPage'
    );
    const courtesySpy = vi.spyOn(
        reconciliationZeroCallModel,
        'listDeferredCourtesiesWithActiveSuccessorPage'
    );
    successionSpy.mockImplementation(async (input) => {
        const rows = await successionOriginal({ ...input, limit: 10_000 });
        return rows
            .filter(({ successor }) => zeroCallSubscriptionIds.has(successor.id))
            .filter(
                ({ successor }) =>
                    input.afterSubscriptionId === undefined ||
                    successor.id > input.afterSubscriptionId
            )
            .slice(0, input.limit);
    });
    courtesySpy.mockImplementation(async (input) => {
        const rows = await courtesyOriginal({ ...input, limit: 10_000 });
        return rows
            .filter(({ successor }) => zeroCallSubscriptionIds.has(successor.id))
            .filter(
                ({ courtesyGrant }) =>
                    input.afterCourtesyGrantId === undefined ||
                    courtesyGrant.id > input.afterCourtesyGrantId
            )
            .slice(0, input.limit);
    });
    try {
        return await withSeededReconciliationInventory(run);
    } finally {
        successionSpy.mockRestore();
        courtesySpy.mockRestore();
        zeroCallSubscriptionIds.clear();
    }
}

/** Retained-payment source double scoped to the rows seeded by a test. */
export function retainedPaymentsDouble(
    rows: ReadonlyArray<{ subscriptionId: string; payment: { source: 'PAYMENT'; id: string } }>
) {
    return { listRetainedPayments: async () => rows };
}
