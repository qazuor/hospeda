import {
    accommodations,
    emailOutbox,
    enqueueOrMergeScheduledEmail,
    eq,
    experiences,
    gastronomies,
    getDb,
    inArray,
    trials
} from '@repo/db';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runStep3 } from '../../../src/services/cutover-v6/step-3.service.js';
import { injectClock } from '../../../src/utils/clock.js';
import { validateApiEnv } from '../../../src/utils/env.js';
import type { TrialCampaignOutboxDependencies } from '../../../src/utils/trial/trial-campaign-outbox.js';
import { testDb } from '../../e2e/setup/test-database.js';
import {
    createListing,
    createOwner,
    createVerticalDestination,
    createVerticalListing,
    ensurePublicationCatalog
} from '../listing-publication/publication-routes.helpers.js';

const CUTOVER = new Date('2026-10-10T12:00:00.000Z');
const fixedClock = { now: () => CUTOVER };
async function seedFive() {
    const seeded: {
        userId: string;
        listingId: string;
        vertical:
            | typeof VerticalEnum.ACCOMMODATION
            | typeof VerticalEnum.GASTRONOMY
            | typeof VerticalEnum.EXPERIENCE;
    }[] = [];
    for (const vertical of [
        VerticalEnum.ACCOMMODATION,
        VerticalEnum.ACCOMMODATION,
        VerticalEnum.GASTRONOMY,
        VerticalEnum.GASTRONOMY,
        VerticalEnum.EXPERIENCE
    ] as const) {
        const owner = await createOwner();
        const destinationId = await createVerticalDestination();
        const listingId =
            vertical === VerticalEnum.ACCOMMODATION
                ? await createListing({
                      ownerId: owner.id,
                      destinationId,
                      status: PublicationStatusEnum.PUBLISHED
                  })
                : await createVerticalListing({
                      vertical,
                      ownerId: owner.id,
                      destinationId,
                      status: PublicationStatusEnum.PUBLISHED
                  });
        const table =
            vertical === VerticalEnum.ACCOMMODATION
                ? accommodations
                : vertical === VerticalEnum.GASTRONOMY
                  ? gastronomies
                  : experiences;
        await getDb().update(table).set({ inactiveSince: CUTOVER }).where(eq(table.id, listingId));
        seeded.push({ userId: owner.id, listingId, vertical });
    }
    return seeded;
}
async function rowsFor(seeded: readonly { userId: string }[]) {
    const ids = seeded.map((row) => row.userId);
    return {
        trials: await getDb().select().from(trials).where(inArray(trials.userId, ids)),
        outbox: await getDb()
            .select()
            .from(emailOutbox)
            .where(inArray(emailOutbox.recipientUserId, ids))
    };
}
beforeAll(async () => {
    await testDb.setup();
    validateApiEnv();
});
beforeEach(async () => {
    await testDb.clean();
    for (const vertical of [
        VerticalEnum.ACCOMMODATION,
        VerticalEnum.GASTRONOMY,
        VerticalEnum.EXPERIENCE
    ] as const)
        await ensurePublicationCatalog(vertical);
    injectClock({ clock: fixedClock });
});
afterEach(async () => testDb.clean());
afterAll(async () => testDb.teardown());

describe('TEST:1695:4 AC:1695:1 a trial and its campaign commit together', () => {
    it('rolls back all trial and campaign rows on the fifth outbox failure, then writes on retry', async () => {
        const seeded = await seedFive();
        let calls = 0;
        const enqueueOrMerge: TrialCampaignOutboxDependencies['enqueueOrMerge'] = async (input) => {
            calls += 1;
            if (calls === 5) throw new Error('injected outbox failure');
            return enqueueOrMergeScheduledEmail(input);
        };
        const campaignDeps: Partial<TrialCampaignOutboxDependencies> = { enqueueOrMerge };
        await expect(
            runStep3({
                dryRun: false,
                ownerIds: seeded.map((row) => row.userId),
                clock: fixedClock,
                campaignDeps
            })
        ).rejects.toThrow('injected outbox failure');
        const rolledBack = await rowsFor(seeded);
        expect(rolledBack.trials).toHaveLength(0);
        expect(rolledBack.outbox).toHaveLength(0);
        const retry = await runStep3({
            dryRun: false,
            ownerIds: seeded.map((row) => row.userId),
            clock: fixedClock
        });
        expect(retry.written).toHaveLength(5);
        const committed = await rowsFor(seeded);
        expect(committed.trials).toHaveLength(5);
        expect(committed.outbox).toHaveLength(20);
    });
});
