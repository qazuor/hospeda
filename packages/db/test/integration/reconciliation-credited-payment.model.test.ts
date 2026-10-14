/**
 * Support for TEST:B11:11 (AC:B11:12): the credited-payments check lists only
 * subscription payments in a credited state inside the window, by keyset page.
 * Every case runs in a rolled-back transaction and asserts only on its own ids.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { reconciliationCreditedPaymentModel as model } from '../../src/models/reconciliation-inventory/reconciliation-credited-payment.model.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import { addons, addonVersions } from '../../src/schemas/vertical/addon-catalog.dbschema.ts';
import {
    addonInstances,
    addonProducts
} from '../../src/schemas/vertical/addon-product.dbschema.ts';
import { payments } from '../../src/schemas/vertical/payment.dbschema.ts';
import { subscriptions } from '../../src/schemas/vertical/subscription.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, withTestTransaction } from './helpers.ts';

afterAll(closeTestPool);

const SINCE = new Date('2026-04-01T00:00:00.000Z');

async function seed(tx: DrizzleClient) {
    const id = crypto.randomUUID();
    const [user] = await tx
        .insert(users)
        .values({ id, slug: `b114-credited-${id}`, email: `b114-credited-${id}@example.test` })
        .returning();
    const [subscription] = await tx
        .insert(subscriptions)
        .values({ status: 'CANCELLED', class: 'LAPIDA' })
        .returning();
    const [addon] = await tx
        .insert(addons)
        .values({ slug: `b114-credited-${crypto.randomUUID()}`, name: 'B11.4 addon' })
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
    const [product] = await tx
        .insert(addonProducts)
        .values({
            addonId: addon?.id as string,
            versionId: version?.id as string,
            price: 100,
            currency: 'ARS',
            chargeKind: 'UNA_VEZ',
            compatibleVerticals: ['accommodation']
        })
        .returning();
    const [instance] = await tx
        .insert(addonInstances)
        .values({
            productId: product?.id as string,
            addonVersionId: version?.id as string,
            ownerId: user?.id as string,
            status: 'ACTIVE'
        })
        .returning();
    const payment = async (input: {
        readonly status: string;
        readonly factAt: Date;
        readonly ofInstance?: boolean;
    }) => {
        const [row] = await tx
            .insert(payments)
            .values({
                ...(input.ofInstance
                    ? { addonInstanceId: instance?.id as string }
                    : { subscriptionId: subscription?.id as string }),
                amount: 10_000,
                currency: 'ARS',
                status: input.status,
                provider: 'mercadopago',
                providerFactId: `b114-credited-${crypto.randomUUID()}`,
                factAt: input.factAt
            })
            .returning({ id: payments.id });
        return row?.id as string;
    };
    return { payment };
}

async function listedIds(tx: DrizzleClient, seeded: readonly string[]): Promise<string[]> {
    const rows = await model.listCreditedPaymentsInWindowPage({ since: SINCE, limit: 10_000, tx });
    return rows.map((row) => row.id).filter((id) => seeded.includes(id));
}

describe('support for TEST:B11:11 — credited payments inside the window', () => {
    it('lists the three credited states and nothing else', async () => {
        await withTestTransaction(async (tx) => {
            const { payment } = await seed(tx);
            const inside = new Date('2026-05-01T00:00:00.000Z');
            const credited = [
                await payment({ status: 'SUCCEEDED', factAt: inside }),
                await payment({ status: 'PARTIALLY_REFUNDED', factAt: inside }),
                await payment({ status: 'REFUNDED', factAt: inside })
            ];
            const other = [
                await payment({ status: 'PENDING', factAt: inside }),
                await payment({ status: 'FAILED', factAt: inside }),
                await payment({ status: 'CHARGED_BACK', factAt: inside })
            ];

            const listed = await listedIds(tx, [...credited, ...other]);

            expect(listed.sort()).toEqual([...credited].sort());
        });
    });

    it('leaves out a one-time addon payment and a fact before the window, keeps the exact edge', async () => {
        await withTestTransaction(async (tx) => {
            const { payment } = await seed(tx);
            const edge = await payment({ status: 'SUCCEEDED', factAt: SINCE });
            const before = await payment({
                status: 'SUCCEEDED',
                factAt: new Date(SINCE.getTime() - 1)
            });
            const ofInstance = await payment({
                status: 'SUCCEEDED',
                factAt: new Date('2026-05-01T00:00:00.000Z'),
                ofInstance: true
            });

            const listed = await listedIds(tx, [edge, before, ofInstance]);

            expect(listed).toEqual([edge]);
        });
    });

    it('pages by id after the cursor, up to the limit', async () => {
        await withTestTransaction(async (tx) => {
            const { payment } = await seed(tx);
            const inside = new Date('2026-05-01T00:00:00.000Z');
            const seeded = [
                await payment({ status: 'SUCCEEDED', factAt: inside }),
                await payment({ status: 'SUCCEEDED', factAt: inside }),
                await payment({ status: 'SUCCEEDED', factAt: inside })
            ].sort();
            const [first, second, third] = seeded as [string, string, string];

            const page = await model.listCreditedPaymentsInWindowPage({
                since: SINCE,
                afterPaymentId: first,
                limit: 1,
                tx
            });

            expect(page).toHaveLength(1);
            expect(page[0]?.id > first).toBe(true);
            const afterFirst = (
                await model.listCreditedPaymentsInWindowPage({
                    since: SINCE,
                    afterPaymentId: first,
                    limit: 10_000,
                    tx
                })
            )
                .map((row) => row.id)
                .filter((id) => seeded.includes(id));
            expect(afterFirst).toEqual([second, third]);
            const ordered = (
                await model.listCreditedPaymentsInWindowPage({ since: SINCE, limit: 10_000, tx })
            ).map((row) => row.id);
            expect([...ordered].sort()).toEqual(ordered);
        });
    });
});
