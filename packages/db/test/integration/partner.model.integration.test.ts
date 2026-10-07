/**
 * Integration test for PartnerModel's active-partner filters (SPEC-271,
 * reshaped by HOS-1419).
 *
 * `findByFilters` (default, `includeInactive` unset) and `countActivePartners`
 * used to also require `partners.subscription_status = 'active'`. HOS-1419
 * dropped that column together with the rest of the partner billing state, so
 * the lifecycle state is now the only visibility switch: an ACTIVE partner is
 * listed, an INACTIVE one is not.
 *
 * Uses `withCleanSlate` rather than `withTestTransaction`: `findByFilters` and
 * `countActivePartners` call `getDb()` internally (no `tx` parameter), so
 * writes must be visible to a query issued via the module-level connection
 * set by `setDb()` — a transaction rolled back on a separate pooled
 * connection would not be visible there.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setDb } from '../../src/client.ts';
import { PartnerModel } from '../../src/models/partner/partner.model.ts';
import { partners } from '../../src/schemas/partner/partner.dbschema.ts';
import { closeTestPool, getTestDb, withCleanSlate } from './helpers.ts';

/**
 * Minimal `partners` row that satisfies all NOT NULL constraints.
 * `lifecycleState` defaults to the value a publicly-visible partner has.
 */
function partnerFixture(
    overrides: Partial<typeof partners.$inferInsert> = {}
): typeof partners.$inferInsert {
    const uid = crypto.randomUUID().slice(0, 8);
    return {
        id: crypto.randomUUID(),
        slug: `partner-${uid}`,
        name: `Partner ${uid}`,
        type: 'business' as const,
        tier: 'gold' as const,
        lifecycleState: 'ACTIVE' as const,
        startsAt: new Date(),
        ...overrides
    };
}

beforeAll(() => {
    // Wire the module-level getDb() to the ephemeral test pool so that
    // PartnerModel methods (which call getDb() directly, without a tx
    // parameter) resolve to the test DB.
    setDb(getTestDb());
});

afterAll(async () => {
    await closeTestPool();
});

describe('PartnerModel active-partner filters (lifecycle state is the only switch)', () => {
    const model = new PartnerModel();

    it('findByFilters (default) returns only ACTIVE partners', async () => {
        await withCleanSlate(async (db) => {
            // Arrange
            const activePartner = partnerFixture({ name: 'Active Partner' });
            const inactivePartner = partnerFixture({
                name: 'Inactive Partner',
                lifecycleState: 'INACTIVE' as const
            });
            await db.insert(partners).values([activePartner, inactivePartner]);

            // Act
            const results = await model.findByFilters({});

            // Assert — only the ACTIVE partner is returned.
            const ids = results.map((p) => p.id);
            expect(ids).toContain(activePartner.id);
            expect(ids).not.toContain(inactivePartner.id);
        });
    });

    it('countActivePartners counts only ACTIVE partners', async () => {
        await withCleanSlate(async (db) => {
            // Arrange
            const activePartner1 = partnerFixture({ name: 'Active One' });
            const activePartner2 = partnerFixture({ name: 'Active Two' });
            const inactivePartner = partnerFixture({
                name: 'Inactive Partner',
                lifecycleState: 'INACTIVE' as const
            });
            await db.insert(partners).values([activePartner1, activePartner2, inactivePartner]);

            // Act
            const total = await model.countActivePartners({});

            // Assert — only the two active partners are counted.
            expect(total).toBe(2);
        });
    });
});
