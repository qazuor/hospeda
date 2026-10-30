/**
 * Support for TEST:B11:12 (AC:B11:13): the paid-orders check lists only
 * ABANDONED instances of a one-time product with an ORDER_CREATE key inside the
 * window, and never one that already had its reason-23 mark (H12). Every case
 * runs in a rolled-back transaction and asserts only on its own ids.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { reconciliationPaidOrderModel as model } from '../../src/models/reconciliation-inventory/reconciliation-paid-order.model.ts';
import { reconciliationMarkModel } from '../../src/models/reconciliation-mark/reconciliation-mark.model.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import { addons, addonVersions } from '../../src/schemas/vertical/addon-catalog.dbschema.ts';
import {
    addonInstances,
    addonProducts
} from '../../src/schemas/vertical/addon-product.dbschema.ts';
import { idempotencyKeys } from '../../src/schemas/vertical/idempotency-key.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, withTestTransaction } from './helpers.ts';

afterAll(closeTestPool);

const SINCE = new Date('2026-04-01T00:00:00.000Z');
const INSIDE = new Date('2026-09-01T00:00:00.000Z');

async function seeder(tx: DrizzleClient) {
    const id = crypto.randomUUID();
    const [user] = await tx
        .insert(users)
        .values({ id, slug: `b114-order-${id}`, email: `b114-order-${id}@example.test` })
        .returning();
    const [addon] = await tx
        .insert(addons)
        .values({ slug: `b114-order-${crypto.randomUUID()}`, name: 'B11.4 order addon' })
        .returning();
    const [version] = await tx
        .insert(addonVersions)
        .values({
            addonId: addon?.id as string,
            validity: 'FIXED_DAYS',
            validityDays: 30,
            scopeType: 'USER'
        })
        .returning();
    // A periodic product may not anchor a fixed-days version (ck_addon_product_periodic_not_fixed_days).
    const [periodicVersion] = await tx
        .insert(addonVersions)
        .values({
            addonId: addon?.id as string,
            validity: 'WHILE_SUBSCRIPTION_ALIVE',
            scopeType: 'USER'
        })
        .returning();
    const instance = async (input: {
        readonly status?: string;
        readonly chargeKind?: 'UNA_VEZ' | 'PERIODICO';
        readonly key?: { readonly operation?: string; readonly createdAt?: Date } | null;
    }) => {
        const periodic = input.chargeKind === 'PERIODICO';
        const versionId = (periodic ? periodicVersion?.id : version?.id) as string;
        const [product] = await tx
            .insert(addonProducts)
            .values({
                addonId: addon?.id as string,
                versionId,
                price: 100,
                currency: 'ARS',
                chargeKind: periodic ? 'PERIODICO' : 'UNA_VEZ',
                ...(periodic ? { cycle: 'monthly' } : {}),
                compatibleVerticals: ['accommodation']
            })
            .returning();
        const [row] = await tx
            .insert(addonInstances)
            .values({
                productId: product?.id as string,
                addonVersionId: versionId,
                ownerId: user?.id as string,
                status: input.status ?? 'ABANDONED',
                orderRequestId: `b114-request-${crypto.randomUUID()}`
            })
            .returning({ id: addonInstances.id });
        const instanceId = row?.id as string;
        if (input.key !== null)
            await tx.insert(idempotencyKeys).values({
                key: `b114-key-${crypto.randomUUID()}`,
                operation: input.key?.operation ?? 'ORDER_CREATE',
                subjectId: instanceId,
                createdAt: input.key?.createdAt ?? INSIDE
            });
        return instanceId;
    };
    return { instance, userId: user?.id as string };
}

async function listed(tx: DrizzleClient, seeded: readonly string[]): Promise<string[]> {
    const rows = await model.listAbandonedOneTimeOrdersInWindowPage({
        since: SINCE,
        limit: 10_000,
        tx
    });
    return rows.map((row) => row.instance.id).filter((id) => seeded.includes(id));
}

describe('support for TEST:B11:12 — abandoned one-time instances with an order key', () => {
    it('lists an ABANDONED one-time instance with its order key, and the key instant', async () => {
        await withTestTransaction(async (tx) => {
            const { instance } = await seeder(tx);
            const id = await instance({});

            const rows = await model.listAbandonedOneTimeOrdersInWindowPage({
                since: SINCE,
                limit: 10_000,
                tx
            });

            const row = rows.find((candidate) => candidate.instance.id === id);
            expect(row?.orderKeyCreatedAt).toEqual(INSIDE);
            expect(row?.instance.status).toBe('ABANDONED');
        });
    });

    it('leaves out an instance without a key, or with a key of another operation', async () => {
        await withTestTransaction(async (tx) => {
            const { instance } = await seeder(tx);
            const keyed = await instance({});
            const noKey = await instance({ key: null });
            const otherKey = await instance({ key: { operation: 'REFUND_CREATE' } });

            expect(await listed(tx, [keyed, noKey, otherKey])).toEqual([keyed]);
        });
    });

    it('leaves out EXPIRED, CANCELLED and ACTIVE instances and periodic products', async () => {
        await withTestTransaction(async (tx) => {
            const { instance } = await seeder(tx);
            const abandoned = await instance({});
            const others = [
                await instance({ status: 'EXPIRED' }),
                await instance({ status: 'CANCELLED' }),
                await instance({ status: 'ACTIVE' }),
                await instance({ chargeKind: 'PERIODICO' })
            ];

            expect(await listed(tx, [abandoned, ...others])).toEqual([abandoned]);
        });
    });

    it('leaves out a key created before the window and keeps the exact edge', async () => {
        await withTestTransaction(async (tx) => {
            const { instance } = await seeder(tx);
            const edge = await instance({ key: { createdAt: SINCE } });
            const before = await instance({
                key: { createdAt: new Date(SINCE.getTime() - 1) }
            });

            expect(await listed(tx, [edge, before])).toEqual([edge]);
        });
    });

    it('leaves out an instance with a reason-23 mark, open or lifted (H12)', async () => {
        await withTestTransaction(async (tx) => {
            const { instance, userId } = await seeder(tx);
            const clean = await instance({});
            const open = await instance({});
            const lifted = await instance({});
            await reconciliationMarkModel.insertOpen({
                subject: { kind: 'ADDON_INSTANCE', addonInstanceId: open },
                reason: 'ORDEN_PAGADA_SIN_INSTANCIA',
                tx
            });
            const mark = await reconciliationMarkModel.insertOpen({
                subject: { kind: 'ADDON_INSTANCE', addonInstanceId: lifted },
                reason: 'ORDEN_PAGADA_SIN_INSTANCIA',
                tx
            });
            await reconciliationMarkModel.lift({
                markId: mark.id,
                expectedVersion: mark.version,
                liftedBy: userId,
                now: INSIDE,
                tx
            });

            expect(await listed(tx, [clean, open, lifted])).toEqual([clean]);
        });
    });

    it('pages by instance id after the cursor, up to the limit', async () => {
        await withTestTransaction(async (tx) => {
            const { instance } = await seeder(tx);
            const seeded = [await instance({}), await instance({}), await instance({})].sort();
            const [first, second, third] = seeded as [string, string, string];

            const page = await model.listAbandonedOneTimeOrdersInWindowPage({
                since: SINCE,
                afterInstanceId: first,
                limit: 1,
                tx
            });
            const rest = (
                await model.listAbandonedOneTimeOrdersInWindowPage({
                    since: SINCE,
                    afterInstanceId: first,
                    limit: 10_000,
                    tx
                })
            )
                .map((row) => row.instance.id)
                .filter((id) => seeded.includes(id));

            expect(page).toHaveLength(1);
            expect((page[0]?.instance.id as string) > first).toBe(true);
            expect(rest).toEqual([second, third]);
        });
    });
});
