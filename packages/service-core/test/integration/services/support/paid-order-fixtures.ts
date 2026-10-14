/**
 * Fixtures for TEST:B11:12 (AC:B11:13): ABANDONED one-time instances with an
 * ORDER_CREATE key, the fake's orders, the sweep run with only the paid-orders
 * pass, isolated to this test's instances. {@link retirePaidOrderFixtures} takes
 * every seeded instance out of the population (its marks lifted, its key gone,
 * its status no longer ABANDONED), so no other suite sees it.
 */
import {
    addonInstances,
    and,
    type DrizzleClient,
    domainEvent,
    eq,
    idempotencyKeys,
    inArray,
    isNull,
    reconciliationMarks,
    reconciliationPaidOrderModel
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import type { FakePaymentProvider } from '@repo/payments/fake';
import { vi } from 'vitest';
import { runReconciliationSweep } from '../../../../src/services/billing/reconciliation/sweep/reconciliation-sweep.service.js';
import { getServiceTestDb } from '../helpers.js';
import {
    reconciliationDeadlineValues,
    withSeededReconciliationInventory
} from '../reconciliation-sweep-fixtures.js';
import { seedOrphanOwner, seedOrphanProduct } from './addon-orphan-fixtures.js';

const DAY_MS = 86_400_000;
const seeded: { instanceId: string; ownerId: string }[] = [];

/** The sweep's instant: one day after the default order key (H13). */
export const paidOrderNow = new Date('2026-10-11T12:00:00.000Z');
export const paidOrderClock = { now: () => new Date(paidOrderNow) };

/** Seeds one addon instance of a fresh product, with or without its ORDER_CREATE key. */
export async function seedOrderInstance(input: {
    readonly status?: string;
    readonly chargeKind?: 'UNA_VEZ' | 'PERIODICO';
    readonly providerOrderId?: string | null;
    readonly key?: { readonly createdAt?: Date; readonly operation?: string } | null;
}): Promise<{
    readonly instanceId: string;
    readonly ownerId: string;
    readonly orderRequestId: string;
    readonly keyAt: Date;
}> {
    const db = getServiceTestDb() as unknown as DrizzleClient;
    const { userId } = await seedOrphanOwner(db);
    const { productId, versionId } = await seedOrphanProduct(db, {
        scopeType: 'USER',
        compatibleVerticals: ['accommodation'],
        chargeKind: input.chargeKind ?? 'UNA_VEZ'
    });
    const orderRequestId = `b114-request-${crypto.randomUUID()}`;
    const [row] = await getServiceTestDb()
        .insert(addonInstances)
        .values({
            productId,
            addonVersionId: versionId,
            ownerId: userId,
            status: input.status ?? 'ABANDONED',
            orderRequestId,
            providerOrderId: input.providerOrderId ?? null
        })
        .returning({ id: addonInstances.id });
    if (!row) throw new Error('paid order fixture instance missing');
    seeded.push({ instanceId: row.id, ownerId: userId });
    const keyAt = input.key?.createdAt ?? new Date(paidOrderNow.getTime() - DAY_MS);
    if (input.key !== null)
        await getServiceTestDb()
            .insert(idempotencyKeys)
            .values({
                key: `b114-order-key-${crypto.randomUUID()}`,
                operation: input.key?.operation ?? 'ORDER_CREATE',
                subjectId: row.id,
                createdAt: keyAt
            });
    return { instanceId: row.id, ownerId: userId, orderRequestId, keyAt };
}

/** Deadlines with the 18th deadline in days. */
export function orderDeadlines(days: number) {
    return {
        current: async () => ({ values: { ...reconciliationDeadlineValues, '18': { days } } })
    };
}

/** Runs the sweep with only the paid-orders pass, listing only this test's instances. */
export async function sweepPaidOrders(input: {
    readonly provider: PaymentProvider | FakePaymentProvider;
    readonly days?: number;
    readonly livenessPing?: { ping: () => Promise<void> };
}) {
    const owned = new Set(seeded.map((entry) => entry.instanceId));
    const original = reconciliationPaidOrderModel.listAbandonedOneTimeOrdersInWindowPage.bind(
        reconciliationPaidOrderModel
    );
    const listing = vi
        .spyOn(reconciliationPaidOrderModel, 'listAbandonedOneTimeOrdersInWindowPage')
        .mockImplementation(async (page) => {
            const rows = await original({ ...page, afterInstanceId: undefined, limit: 10_000 });
            return rows
                .filter(({ instance }) => owned.has(instance.id))
                .filter(
                    ({ instance }) =>
                        page.afterInstanceId === undefined || instance.id > page.afterInstanceId
                )
                .slice(0, page.limit);
        });
    try {
        return await withSeededReconciliationInventory(() =>
            runReconciliationSweep(
                { correlationId: crypto.randomUUID() },
                {
                    provider: input.provider as PaymentProvider,
                    clock: paidOrderClock,
                    paidOrders: { deadlines: orderDeadlines(input.days ?? 180) },
                    ...(input.livenessPing ? { livenessPing: input.livenessPing } : {})
                }
            )
        );
    } finally {
        listing.mockRestore();
    }
}

/** Every reason-23 mark of one instance, open or lifted. */
export async function paidOrderMarks(instanceId: string) {
    return getServiceTestDb()
        .select()
        .from(reconciliationMarks)
        .where(
            and(
                eq(reconciliationMarks.addonInstanceId, instanceId),
                eq(reconciliationMarks.reason, 'ORDEN_PAGADA_SIN_INSTANCIA')
            )
        );
}

/** How many `reconciliation.mark_opened` events name this instance (by type, never position). */
export async function markOpenedEventsOf(instanceId: string): Promise<number> {
    const rows = await getServiceTestDb()
        .select({ eventType: domainEvent.eventType })
        .from(domainEvent)
        .where(
            and(eq(domainEvent.entityType, 'addon_instance'), eq(domainEvent.entityId, instanceId))
        );
    return rows.filter((row) => row.eventType === 'reconciliation.mark_opened').length;
}

/** The instance's status as stored. */
export async function instanceStatus(instanceId: string): Promise<string | undefined> {
    const [row] = await getServiceTestDb()
        .select({ status: addonInstances.status })
        .from(addonInstances)
        .where(eq(addonInstances.id, instanceId));
    return row?.status;
}

/** Takes every seeded instance out of the population: marks lifted, key gone, not ABANDONED. */
export async function retirePaidOrderFixtures(): Promise<void> {
    const db = getServiceTestDb();
    const entries = seeded.splice(0);
    if (entries.length === 0) return;
    const ids = entries.map((entry) => entry.instanceId);
    for (const { instanceId, ownerId } of entries)
        await db
            .update(reconciliationMarks)
            .set({ liftedAt: new Date(), liftedBy: ownerId })
            .where(
                and(
                    eq(reconciliationMarks.addonInstanceId, instanceId),
                    isNull(reconciliationMarks.liftedAt)
                )
            );
    await db.delete(idempotencyKeys).where(inArray(idempotencyKeys.subjectId, ids));
    await db
        .update(addonInstances)
        .set({ status: 'EXPIRED' })
        .where(inArray(addonInstances.id, ids));
}
