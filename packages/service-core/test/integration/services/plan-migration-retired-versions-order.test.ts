import { eq, planCatalogModel, providerLinks, subscriptions, users } from '@repo/db';
import { createPlanCatalogInverse } from '@repo/verticals';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { listRetiredPlanVersions } from '../../../src/services/billing/plan-migration/plan-migration-retired-versions.service.js';
import type { Actor } from '../../../src/types/index.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { startCyclePriceCustomer } from './support/cycle-price-fixtures.js';
import {
    cleanupPlanMigrationCases,
    createPlanMigrationCase
} from './support/plan-migration-fixtures.js';

const db = getServiceTestDb();
const verticals = createPlanCatalogInverse({ reader: planCatalogModel });
const extraCustomers: Array<{ subscriptionId: string; userId: string }> = [];

/** Start one more real customer on an option and remember it for cleanup by id. */
async function startExtraCustomer(billingOptionId: string) {
    const started = await startCyclePriceCustomer(billingOptionId);
    const [row] = await db
        .select({ userId: subscriptions.userId })
        .from(subscriptions)
        .where(eq(subscriptions.id, started.subscriptionId));
    if (!row?.userId) throw new Error('Extra customer subscription missing');
    extraCustomers.push({ subscriptionId: started.subscriptionId, userId: row.userId });
    return { ...started, userId: row.userId };
}

/** Ask the listing and keep only the items of the versions this test seeded, in order. */
async function listedIds(actor: Actor, ids: readonly string[]) {
    const list = await listRetiredPlanVersions({ actor, verticals });
    return list.items.filter((item) => ids.includes(item.id)).map((item) => item.id);
}

afterEach(async () => {
    for (const customer of extraCustomers.splice(0)) {
        await db
            .delete(providerLinks)
            .where(eq(providerLinks.subscriptionId, customer.subscriptionId));
        await db.delete(subscriptions).where(eq(subscriptions.id, customer.subscriptionId));
        await db.delete(users).where(eq(users.id, customer.userId));
    }
    await cleanupPlanMigrationCases();
});
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())(
    'HOS-1616 O-2 el listado de versiones retiradas ordena por clientes vivos y desempata por id',
    () => {
        it('ordena por clientes vivos, el más anclado primero', async () => {
            const three = await createPlanMigrationCase();
            await startExtraCustomer(three.predecessorBillingOptionId);
            await startExtraCustomer(three.predecessorBillingOptionId);
            const one = await createPlanMigrationCase();
            expect(await listedIds(three.actor, [three.planVersionId, one.planVersionId])).toEqual([
                three.planVersionId,
                one.planVersionId
            ]);
        });

        it('desempata por id ascendente cuando el conteo es el mismo', async () => {
            const first = await createPlanMigrationCase();
            const second = await createPlanMigrationCase();
            const ids = [first.planVersionId, second.planVersionId];
            expect(await listedIds(first.actor, ids)).toEqual([...ids].sort());
        });
    }
);
