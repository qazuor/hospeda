/**
 * Regression integration test for PartnerModel's active-partner filters
 * (SPEC-271).
 *
 * `findByFilters` (default, `includeInactive` unset) and `countActivePartners`
 * both filter on `partners.subscriptionStatus`. The Postgres enum
 * `partner_subscription_status_enum` only accepts lowercase values
 * (`pending|active|past_due|cancelled`) — unlike `lifecycleState`, which DOES
 * use uppercase (`'ACTIVE'`). A prior version of this model compared
 * `subscriptionStatus` against the uppercase literal `'ACTIVE'`, which
 * Postgres rejects with `invalid input value for enum
 * partner_subscription_status_enum: "ACTIVE"` — a 500 on every call to the
 * public `/partners` endpoint that hits either of these methods.
 *
 * This test seeds real rows against a live Postgres instance (a mock cannot
 * reproduce an enum-binding error) and asserts both methods resolve without
 * throwing and return exactly the active partners.
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
 * `subscriptionStatus` and `lifecycleState` default to the values that a
 * healthy, publicly-visible partner should have.
 */
function partnerFixture(
    overrides: Partial<typeof partners.$inferInsert> = {}
): typeof partners.$inferInsert {
    const uid = crypto.randomUUID().slice(0, 8);
    return {
        id: crypto.randomUUID(),
        slug: `partner-${uid}`,
        name: `Partner ${uid}`,
        type: 'commerce' as const,
        tier: 'gold' as const,
        subscriptionStatus: 'active' as const,
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

describe('PartnerModel active-partner filters (subscriptionStatus enum regression)', () => {
    const model = new PartnerModel();

    it('findByFilters (default) returns active partners without an enum-binding error', async () => {
        await withCleanSlate(async (db) => {
            // Arrange
            const activePartner = partnerFixture({ name: 'Active Partner' });
            const inactivePartner = partnerFixture({
                name: 'Cancelled Partner',
                subscriptionStatus: 'cancelled' as const
            });
            await db.insert(partners).values([activePartner, inactivePartner]);

            // Act
            const results = await model.findByFilters({});

            // Assert — must not throw (old 'ACTIVE' literal caused a Postgres
            // "invalid input value for enum" 500) and must return only the
            // active partner.
            const ids = results.map((p) => p.id);
            expect(ids).toContain(activePartner.id);
            expect(ids).not.toContain(inactivePartner.id);
        });
    });

    it('countActivePartners returns the count of active partners without an enum-binding error', async () => {
        await withCleanSlate(async (db) => {
            // Arrange
            const activePartner1 = partnerFixture({ name: 'Active One' });
            const activePartner2 = partnerFixture({ name: 'Active Two' });
            const pendingPartner = partnerFixture({
                name: 'Pending Partner',
                subscriptionStatus: 'pending' as const
            });
            await db.insert(partners).values([activePartner1, activePartner2, pendingPartner]);

            // Act
            const total = await model.countActivePartners({});

            // Assert — only the two active partners are counted.
            expect(total).toBe(2);
        });
    });
});
