/**
 * Support for HOS-2179 §5.10: the page-payments check lists every one-time page purchase
 * bought inside the window that no longer waits for its payment, whatever marks it carries.
 * Every case runs in a rolled-back transaction and asserts only on its own ids.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { reconciliationPagePaymentModel as model } from '../../src/models/reconciliation-inventory/reconciliation-page-payment.model.ts';
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
const BEFORE = new Date('2026-03-31T23:59:59.000Z');

async function seeder(tx: DrizzleClient) {
    const id = crypto.randomUUID();
    const [user] = await tx
        .insert(users)
        .values({ id, slug: `hos2179-page-${id}`, email: `hos2179-page-${id}@example.test` })
        .returning();
    const [addon] = await tx
        .insert(addons)
        .values({ slug: `hos2179-page-${crypto.randomUUID()}`, name: 'HOS-2179 page addon' })
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
        readonly createdAt?: Date;
        readonly keys?: readonly string[];
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
                orderRequestId: `hos2179-request-${crypto.randomUUID()}`,
                createdAt: input.createdAt ?? INSIDE
            })
            .returning({ id: addonInstances.id });
        const instanceId = row?.id as string;
        for (const operation of input.keys ?? ['PAYMENT_PAGE_CREATE'])
            await tx.insert(idempotencyKeys).values({
                key: `hos2179-key-${crypto.randomUUID()}`,
                operation,
                subjectId: instanceId
            });
        return instanceId;
    };
    return { instance };
}

async function listed(tx: DrizzleClient, seeded: readonly string[]): Promise<string[]> {
    const rows = await model.listSettledOneTimePagePurchasesInWindowPage({
        since: SINCE,
        limit: 10_000,
        tx
    });
    return rows.map((row) => row.instance.id).filter((id) => seeded.includes(id));
}

describe('HOS-2179 §5.10 settled one-time page purchases in the window', () => {
    it('lists abandoned and active page purchases, never a waiting one', async () => {
        await withTestTransaction(async (tx) => {
            const { instance } = await seeder(tx);
            const abandoned = await instance({ status: 'ABANDONED' });
            const active = await instance({ status: 'ACTIVE' });
            const waiting = await instance({ status: 'PENDING_AUTHORIZATION' });

            expect((await listed(tx, [abandoned, active, waiting])).sort()).toEqual(
                [abandoned, active].sort()
            );
        });
    });

    it('leaves out an order purchase, a periodic product and a purchase before the window', async () => {
        await withTestTransaction(async (tx) => {
            const { instance } = await seeder(tx);
            const order = await instance({ keys: ['ORDER_CREATE'] });
            const periodic = await instance({ chargeKind: 'PERIODICO' });
            const old = await instance({ createdAt: BEFORE });
            const atTheEdge = await instance({ createdAt: SINCE });

            expect(await listed(tx, [order, periodic, old, atTheEdge])).toEqual([atTheEdge]);
        });
    });

    it('keeps a purchase that already carries a mark, listed once', async () => {
        await withTestTransaction(async (tx) => {
            const { instance } = await seeder(tx);
            const marked = await instance({ keys: ['PAYMENT_PAGE_CREATE', 'PAYMENT_PAGE_CREATE'] });
            await reconciliationMarkModel.insertOpen({
                subject: { kind: 'ADDON_INSTANCE', addonInstanceId: marked },
                reason: 'ORDEN_PAGADA_SIN_INSTANCIA',
                tx
            });

            expect(await listed(tx, [marked])).toEqual([marked]);
        });
    });

    it('pages by instance id with an exclusive cursor', async () => {
        await withTestTransaction(async (tx) => {
            const { instance } = await seeder(tx);
            const ids = [await instance({}), await instance({}), await instance({})].sort();
            const first = await model.listSettledOneTimePagePurchasesInWindowPage({
                since: SINCE,
                afterInstanceId: ids[0],
                limit: 10_000,
                tx
            });
            const mine = first.map((row) => row.instance.id).filter((id) => ids.includes(id));
            expect(mine).toEqual([ids[1], ids[2]]);
        });
    });
});
