import type { CoverageChangedEvent } from '@repo/billing-verticals-contract';
import {
    accommodations,
    enqueueOrMergeScheduledEmail,
    eq,
    experiences,
    getDb,
    inArray,
    trials,
    venues
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
type Seeded = {
    userId: string;
    listingId: string;
    vertical:
        | typeof VerticalEnum.ACCOMMODATION
        | typeof VerticalEnum.VENUE
        | typeof VerticalEnum.EXPERIENCE;
};

async function seedFive(): Promise<Seeded[]> {
    const seeded: Seeded[] = [];
    for (const vertical of [
        VerticalEnum.ACCOMMODATION,
        VerticalEnum.ACCOMMODATION,
        VerticalEnum.VENUE,
        VerticalEnum.VENUE,
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
                : vertical === VerticalEnum.VENUE
                  ? venues
                  : experiences;
        await getDb().update(table).set({ inactiveSince: CUTOVER }).where(eq(table.id, listingId));
        seeded.push({ userId: owner.id, listingId, vertical });
    }
    return seeded;
}

function recordingNotices(options: { readonly failFor?: string } = {}) {
    const seen: { readonly event: CoverageChangedEvent; readonly committedTrials: number }[] = [];
    return {
        seen,
        port: {
            async emitCoverageChanged(event: CoverageChangedEvent) {
                const rows = await getDb()
                    .select()
                    .from(trials)
                    .where(eq(trials.userId, event.userId));
                seen.push({ event, committedTrials: rows.length });
                if (event.userId === options.failFor) throw new Error('injected notice failure');
            }
        }
    };
}

async function rowsFor(seeded: readonly { readonly userId: string }[]) {
    return getDb()
        .select()
        .from(trials)
        .where(
            inArray(
                trials.userId,
                seeded.map((row) => row.userId)
            )
        );
}

beforeAll(async () => {
    await testDb.setup();
    validateApiEnv();
});
beforeEach(async () => {
    await testDb.clean();
    for (const vertical of [
        VerticalEnum.ACCOMMODATION,
        VerticalEnum.VENUE,
        VerticalEnum.EXPERIENCE
    ] as const)
        await ensurePublicationCatalog(vertical);
    injectClock({ clock: fixedClock });
});
afterEach(async () => testDb.clean());
afterAll(async () => testDb.teardown());

describe('HOS-2091 the cutover trials announce their coverage after the step 3 commit', () => {
    it('emits one TRIAL coverage notice per written trial, after the commit', async () => {
        // Arrange
        const seeded = await seedFive();
        const notices = recordingNotices();

        // Act
        const result = await runStep3({
            dryRun: false,
            ownerIds: seeded.map((row) => row.userId),
            clock: fixedClock,
            coverageNotices: notices.port
        });

        // Assert
        const expected = [...seeded]
            .sort((a, b) => a.userId.localeCompare(b.userId))
            .map(({ userId, vertical }) => ({
                event: { userId, vertical, sourceType: 'TRIAL', change: 'CHANGED' },
                committedTrials: 1
            }));
        expect(notices.seen.sort((a, b) => a.event.userId.localeCompare(b.event.userId))).toEqual(
            expected
        );
        expect(result.coverageNoticeFailed).toEqual([]);
    });

    it('notifies only the trials it really inserted, never a conflict-skipped one', async () => {
        // Arrange
        const seeded = await seedFive();
        const firstNotices = recordingNotices();

        // Act
        await runStep3({
            dryRun: false,
            ownerIds: [seeded[0]!.userId],
            clock: fixedClock,
            coverageNotices: firstNotices.port
        });
        const notices = recordingNotices();
        const result = await runStep3({
            dryRun: false,
            ownerIds: seeded.map((row) => row.userId),
            clock: fixedClock,
            coverageNotices: notices.port
        });

        // Assert
        const expected = seeded
            .slice(1)
            .sort((a, b) => a.userId.localeCompare(b.userId))
            .map(({ userId, vertical }) => ({
                event: { userId, vertical, sourceType: 'TRIAL', change: 'CHANGED' },
                committedTrials: 1
            }));
        expect(notices.seen.sort((a, b) => a.event.userId.localeCompare(b.event.userId))).toEqual(
            expected
        );
        expect(result.skipped).toEqual([expect.objectContaining({ userId: seeded[0]!.userId })]);
    });

    it('a rerun with every trial already written emits nothing', async () => {
        // Arrange
        const seeded = await seedFive();
        const ids = seeded.map((row) => row.userId);
        await runStep3({ dryRun: false, ownerIds: ids, clock: fixedClock });
        const notices = recordingNotices();

        // Act
        const result = await runStep3({
            dryRun: false,
            ownerIds: ids,
            clock: fixedClock,
            coverageNotices: notices.port
        });

        // Assert
        expect(notices.seen).toEqual([]);
        expect(result.status).toBe('already_done');
    });

    it('a dry run emits nothing', async () => {
        // Arrange
        const seeded = await seedFive();
        const notices = recordingNotices();

        // Act
        const result = await runStep3({
            dryRun: true,
            ownerIds: seeded.map((row) => row.userId),
            clock: fixedClock,
            coverageNotices: notices.port
        });

        // Assert
        expect(notices.seen).toEqual([]);
        expect(result.coverageNoticeFailed).toEqual([]);
    });

    it('a rolled back step 3 emits nothing', async () => {
        // Arrange
        const seeded = await seedFive();
        const notices = recordingNotices();
        let calls = 0;
        const enqueueOrMerge: TrialCampaignOutboxDependencies['enqueueOrMerge'] = async (input) => {
            calls += 1;
            if (calls === 5) throw new Error('injected outbox failure');
            return enqueueOrMergeScheduledEmail(input);
        };

        // Act
        const run = runStep3({
            dryRun: false,
            ownerIds: seeded.map((row) => row.userId),
            clock: fixedClock,
            coverageNotices: notices.port,
            campaignDeps: { enqueueOrMerge }
        });

        // Assert
        await expect(run).rejects.toThrow('injected outbox failure');
        expect(notices.seen).toEqual([]);
    });

    it('a failed notice is reported and does not undo the written trials', async () => {
        // Arrange
        const seeded = await seedFive();
        const notices = recordingNotices({ failFor: seeded[1]!.userId });

        // Act
        const result = await runStep3({
            dryRun: false,
            ownerIds: seeded.map((row) => row.userId),
            clock: fixedClock,
            coverageNotices: notices.port
        });

        // Assert
        expect(result.status).toBe('completed');
        expect(result.coverageNoticeFailed).toEqual([
            {
                userId: seeded[1]!.userId,
                vertical: seeded[1]!.vertical,
                listingId: seeded[1]!.listingId
            }
        ]);
        expect(notices.seen).toHaveLength(5);
        expect(await rowsFor(seeded)).toHaveLength(5);
    });
});
