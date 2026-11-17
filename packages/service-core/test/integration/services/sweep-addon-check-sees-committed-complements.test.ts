import { eq, reconciliationMarks } from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { runAddonWithoutShutdownCheck } from '../../../src/services/billing/reconciliation/sweep/addon-without-shutdown-check.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    providerHarness,
    retireComplementRows,
    seedCommittedComplement
} from './support/complement-fixtures.js';

afterEach(retireComplementRows);
afterAll(closeServiceTestPool);
describe.skipIf(!isServiceTestDbAvailable())('committed complement sweep mechanism', () => {
    it('opens ADDON_SIN_APAGAR for committed complements with suspended principals', async () => {
        const harness = providerHarness();
        const seeded = await seedCommittedComplement({
            fake: harness.fake,
            principalStatus: 'SUSPENDED',
            scopeTypes: ['VERTICAL_SUBSCRIPTION', 'LISTING', 'USER'],
            otherStatus: 'SUSPENDED'
        });
        const result = await runAddonWithoutShutdownCheck(
            { correlationId: crypto.randomUUID(), pageSize: 100 },
            {
                orphanhood: {
                    addonPolicy: seeded.policy.addonPolicy,
                    listing: seeded.policy.listing,
                    listingPurged: async () => ({ purged: false })
                }
            }
        );
        expect(result.result.marksOpened).toBeGreaterThan(0);
        const ids = seeded.addons.map(({ complementId }) => complementId);
        const marks = await getServiceTestDb()
            .select()
            .from(reconciliationMarks)
            .where(eq(reconciliationMarks.reason, 'ADDON_SIN_APAGAR'));
        expect(
            marks.some(
                (mark) =>
                    mark.subscriptionId !== null &&
                    ids.includes(mark.subscriptionId) &&
                    mark.liftedAt === null
            )
        ).toBe(true);
    });
});
