import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { planCatalogModel } from '../../src/models/plan-catalog/plan-catalog.model.ts';
import {
    addons,
    addonVersionEntitlements,
    addonVersionLimits,
    addonVersions
} from '../../src/schemas/vertical/addon-catalog.dbschema.ts';
import { catalogKeys } from '../../src/schemas/vertical/catalog-key.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';

const pool = new Pool({ connectionString: process.env.HOSPEDA_TEST_DATABASE_URL });
const db = drizzle({ client: pool }) as unknown as DrizzleClient;
class Rollback extends Error {}

afterAll(async () => {
    await pool.end();
});

describe('addon version effects (support for TEST:V3:9)', () => {
    it('reads entitlement and limit keys with their catalog strategies', async () => {
        try {
            await db.transaction(async (tx) => {
                const suffix = randomUUID();
                const entitlementKey = `test_ent_${suffix}`.slice(0, 64);
                const limitKey = `test_lim_${suffix}`.slice(0, 64);
                await tx.insert(catalogKeys).values([
                    {
                        key: entitlementKey,
                        kind: 'entitlement',
                        scope: 'global',
                        aggregationStrategy: 'MAX',
                        enforcementStrategy: 'NONE',
                        keyClass: 'COMMERCIAL'
                    },
                    {
                        key: limitKey,
                        kind: 'limit',
                        scope: 'vertical',
                        aggregationStrategy: 'SUM',
                        enforcementStrategy: 'NONE',
                        keyClass: 'COMMERCIAL'
                    }
                ]);
                const [addon] = await tx
                    .insert(addons)
                    .values({ slug: `test-${suffix}`, name: 'Test addon' })
                    .returning({ id: addons.id });
                const [version] = await tx
                    .insert(addonVersions)
                    .values({
                        addonId: addon!.id,
                        validity: 'WHILE_SUBSCRIPTION_ALIVE',
                        scopeType: 'USER'
                    })
                    .returning({ id: addonVersions.id });
                await tx
                    .insert(addonVersionEntitlements)
                    .values({ addonVersionId: version!.id, key: entitlementKey });
                await tx
                    .insert(addonVersionLimits)
                    .values({ addonVersionId: version!.id, key: limitKey, value: 5 });
                const effects = await planCatalogModel.findAddonVersionEffects({
                    id: version!.id,
                    tx: tx as DrizzleClient
                });
                expect(effects).toEqual({
                    entitlements: [{ key: entitlementKey, aggregationStrategy: 'MAX' }],
                    limits: [{ key: limitKey, value: 5, aggregationStrategy: 'SUM' }]
                });
                throw new Rollback();
            });
        } catch (error) {
            if (!(error instanceof Rollback)) throw error;
        }
    });
});
