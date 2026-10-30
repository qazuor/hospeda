// TEST:V9b:13 AC:V9b:14 · TEST:V9b:10 AC:V9b:10
import { accommodations, cronRuns, emailOutbox, eq, getDb, inArray } from '@repo/db';
import { PublicationStatusEnum as Status } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { listingInactivityArchiveJob } from '../../../src/cron/jobs/listing-inactivity-archive.job';
import { listingRetentionPassJob } from '../../../src/cron/jobs/listing-retention-pass.job';
import { injectClock } from '../../../src/utils/clock';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    createListing,
    createOwner,
    createVerticalDestination
} from './publication-routes.helpers';

const controls = vi.hoisted(() => ({ stopped: false, covered: false }));
vi.mock('../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        billing: {
            coverage: async () => ({ covered: controls.covered, sources: [] }),
            retentionStopped: async () => ({
                stopped: controls.stopped,
                pauseEndedAt: null,
                coverageLostAt: null
            }),
            onCoverageChanged: () => () => {}
        },
        effectiveSet: async () => {
            throw new Error('unused');
        },
        loadFacts: async () => ({ facts: null, ownerId: null })
    })
}));

const DAY = 86_400_000;
let clockNow = new Date('2026-10-17T12:00:00Z');
const jobName = 'listing-retention-pass';
const fixtureOwners: string[] = [];
const fixtureListings: string[] = [];
function jobContext() {
    return {
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
        startedAt: new Date(clockNow),
        runId: 'test-run',
        correlationId: 'test-correlation',
        dryRun: false
    };
}
async function setListing(
    id: string,
    values: {
        status: Status;
        inactiveSince: Date;
        deletionAnnouncedAt?: Date | null;
    }
) {
    await getDb()
        .update(accommodations)
        .set({
            publicationStatus: values.status,
            inactiveSince: values.inactiveSince,
            deadlinesVersion: 1,
            deletionAnnouncedAt: values.deletionAnnouncedAt ?? null
        })
        .where(eq(accommodations.id, id));
}
async function createRun(at: Date, dryRun = false) {
    await getDb()
        .insert(cronRuns)
        .values({
            jobName,
            status: 'success',
            startedAt: at,
            finishedAt: new Date(at.getTime() + 1_000),
            durationMs: 1_000,
            executionMode: 'scheduled',
            dryRun,
            details: {}
        });
}

beforeAll(async () => {
    await testDb.setup();
    validateApiEnv();
    injectClock({ clock: { now: () => new Date(clockNow) } });
});
beforeEach(async () => {
    await testDb.clean();
    fixtureOwners.length = 0;
    fixtureListings.length = 0;
    controls.covered = false;
    controls.stopped = false;
    clockNow = new Date('2026-10-17T12:00:00Z');
});
afterEach(async () => {
    if (fixtureOwners.length > 0) {
        await getDb()
            .delete(emailOutbox)
            .where(inArray(emailOutbox.recipientUserId, fixtureOwners));
    }
    await getDb().delete(cronRuns).where(eq(cronRuns.jobName, jobName));
    if (fixtureListings.length > 0) {
        await getDb().delete(accommodations).where(inArray(accommodations.id, fixtureListings));
    }
});
afterAll(async () => testDb.teardown());

describe('TEST:V9b:13 production retention pass', () => {
    it('enqueues both pre-notices once and preserves the single PB4 archive notice', async () => {
        const owner = await createOwner();
        fixtureOwners.push(owner.id);
        const id = await createListing({
            ownerId: owner.id,
            destinationId: await createVerticalDestination(),
            status: Status.UNPUBLISHED_BY_BILLING
        });
        fixtureListings.push(id);
        const inactive = new Date(clockNow.getTime() - 75 * DAY);
        await setListing(id, { status: Status.UNPUBLISHED_BY_BILLING, inactiveSince: inactive });
        await listingRetentionPassJob.handler(jobContext());
        const rows = await getDb()
            .select()
            .from(emailOutbox)
            .where(eq(emailOutbox.recipientUserId, owner.id));
        expect(
            rows.filter((row) => row.template === 'verticals.listing-retention-before-archive')
        ).toHaveLength(1);
        expect(rows[0]?.dedupKey).toContain(`listing:${id}:ret:-90d:`);

        clockNow = new Date(inactive.getTime() + 90 * DAY);
        await listingInactivityArchiveJob.handler(jobContext());
        const afterArchive = await getDb()
            .select()
            .from(emailOutbox)
            .where(eq(emailOutbox.recipientUserId, owner.id));
        expect(
            afterArchive.filter((row) => row.template === 'verticals.listing-archived')
        ).toHaveLength(1);
        await listingRetentionPassJob.handler(jobContext());
        const afterSecondPass = await getDb()
            .select()
            .from(emailOutbox)
            .where(eq(emailOutbox.recipientUserId, owner.id));
        expect(
            afterSecondPass.filter((row) => row.template === 'verticals.listing-archived')
        ).toHaveLength(1);

        clockNow = new Date(inactive.getTime() + 165 * DAY);
        await listingRetentionPassJob.handler(jobContext());
        await listingRetentionPassJob.handler(jobContext());
        const finalRows = await getDb()
            .select()
            .from(emailOutbox)
            .where(eq(emailOutbox.recipientUserId, owner.id));
        expect(
            finalRows.filter(
                (row) => row.template === 'verticals.listing-retention-before-deletion'
            )
        ).toHaveLength(1);
        expect(
            finalRows.filter((row) =>
                [
                    'verticals.listing-retention-before-archive',
                    'verticals.listing-archived',
                    'verticals.listing-retention-before-deletion'
                ].includes(row.template)
            )
        ).toHaveLength(3);
    });

    it('uses cron_runs history to delay the first coverage-lost purge, then purges only after a real pass', async () => {
        const owner = await createOwner();
        fixtureOwners.push(owner.id);
        const id = await createListing({
            ownerId: owner.id,
            destinationId: await createVerticalDestination(),
            status: Status.ARCHIVED
        });
        fixtureListings.push(id);
        const inactive = new Date(clockNow.getTime() - 181 * DAY);
        await setListing(id, {
            status: Status.ARCHIVED,
            inactiveSince: inactive,
            deletionAnnouncedAt: new Date(inactive.getTime() + 90 * DAY)
        });
        await listingRetentionPassJob.handler(jobContext());
        let [row] = await getDb()
            .select({ status: accommodations.publicationStatus })
            .from(accommodations)
            .where(eq(accommodations.id, id));
        expect(row?.status).toBe(Status.ARCHIVED);

        await createRun(new Date(inactive.getTime() + 181 * DAY - 60_000));
        clockNow = new Date(inactive.getTime() + 181 * DAY);
        await listingRetentionPassJob.handler(jobContext());
        [row] = await getDb()
            .select({ status: accommodations.publicationStatus })
            .from(accommodations)
            .where(eq(accommodations.id, id));
        expect(row?.status).toBe(Status.PURGED);
    });

    it('ignores a dry-run history row for the coverage-lost purge', async () => {
        const owner = await createOwner();
        fixtureOwners.push(owner.id);
        const id = await createListing({
            ownerId: owner.id,
            destinationId: await createVerticalDestination(),
            status: Status.ARCHIVED
        });
        fixtureListings.push(id);
        const inactive = new Date(clockNow.getTime() - 181 * DAY);
        await setListing(id, {
            status: Status.ARCHIVED,
            inactiveSince: inactive,
            deletionAnnouncedAt: new Date(inactive.getTime() + 90 * DAY)
        });
        await createRun(new Date(inactive.getTime() + 181 * DAY - 60_000), true);
        await listingRetentionPassJob.handler(jobContext());
        const [row] = await getDb()
            .select({ status: accommodations.publicationStatus })
            .from(accommodations)
            .where(eq(accommodations.id, id));
        expect(row?.status).toBe(Status.ARCHIVED);
    });

    it('does not enqueue for MODERATED listings while retention is stopped', async () => {
        const owner = await createOwner();
        fixtureOwners.push(owner.id);
        const id = await createListing({
            ownerId: owner.id,
            destinationId: await createVerticalDestination(),
            status: Status.MODERATED
        });
        fixtureListings.push(id);
        await setListing(id, {
            status: Status.MODERATED,
            inactiveSince: new Date(clockNow.getTime() - 200 * DAY)
        });
        controls.stopped = true;
        await listingRetentionPassJob.handler(jobContext());
        const ownerRows = await getDb()
            .select()
            .from(emailOutbox)
            .where(eq(emailOutbox.recipientUserId, owner.id));
        expect(
            ownerRows.filter((entry) => entry.template.startsWith('verticals.listing-retention-'))
        ).toHaveLength(0);
    });
});
