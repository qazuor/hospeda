/**
 * Fixtures for one-time instances bought through the retired order path (an
 * ORDER_CREATE key and, optionally, a provider order). The paid-orders sweep pass
 * they fed was retired in HOS-2179 T-7; the instances stay for the suites that
 * still need an order-bought instance. {@link retirePaidOrderFixtures} takes every
 * seeded instance out of the population (its marks lifted, its key gone, its status
 * no longer ABANDONED), so no other suite sees it.
 */
import {
    addonInstances,
    and,
    type DrizzleClient,
    eq,
    idempotencyKeys,
    inArray,
    isNull,
    reconciliationMarks
} from '@repo/db';
import { getServiceTestDb } from '../helpers.js';
import { reconciliationDeadlineValues } from '../reconciliation-sweep-fixtures.js';
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
