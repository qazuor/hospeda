import { accommodations, eq, getDb } from '@repo/db';
import { PublicationStatusEnum } from '@repo/schemas';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { listingInactivityArchiveJob } from '../../../src/cron/jobs/listing-inactivity-archive.job';
import { injectClock } from '../../../src/utils/clock';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    createListing,
    createOwner,
    createVerticalDestination,
    MATRIX_NOW
} from './publication-routes.helpers';

const billingState = vi.hoisted(() => ({
    covered: false,
    stopped: false,
    pauseEndedAt: null as Date | null,
    revalidated: [] as string[]
}));
vi.mock('../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        billing: {
            coverage: async () => ({ covered: billingState.covered, sources: [] }),
            retentionStopped: async () => ({
                stopped: billingState.stopped,
                pauseEndedAt: billingState.pauseEndedAt,
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
vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        getRevalidationService: () => ({
            scheduleRevalidation: ({ id }: { id: string }) => billingState.revalidated.push(id)
        })
    };
});

async function archivedFixture(
    status:
        | typeof PublicationStatusEnum.PUBLISHED
        | typeof PublicationStatusEnum.UNPUBLISHED_BY_BILLING
        | typeof PublicationStatusEnum.DRAFT
) {
    const owner = await createOwner();
    const id = await createListing({
        ownerId: owner.id,
        destinationId: await createVerticalDestination(),
        status
    });
    await getDb()
        .update(accommodations)
        .set({ inactiveSince: new Date(MATRIX_NOW.getTime() - 100 * 86_400_000) })
        .where(eq(accommodations.id, id));
    return id;
}

function jobContext() {
    return {
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
        startedAt: MATRIX_NOW,
        runId: 'archive',
        correlationId: 'archive',
        dryRun: false
    };
}

beforeAll(async () => {
    await testDb.setup();
    validateApiEnv();
    injectClock({ clock: { now: () => MATRIX_NOW } });
});
beforeEach(async () => {
    await testDb.clean();
    billingState.covered = false;
    billingState.stopped = false;
    billingState.pauseEndedAt = null;
    billingState.revalidated = [];
});
afterAll(async () => testDb.teardown());

describe('TEST:V6:8/9 production inactivity archive job', () => {
    it('TEST:V6:8 archives overdue PB4 and preserves its clock with a 90 day deletion distance', async () => {
        const id = await archivedFixture(PublicationStatusEnum.PUBLISHED);
        const result = await listingInactivityArchiveJob.handler(jobContext());
        const [row] = await getDb().select().from(accommodations).where(eq(accommodations.id, id));
        expect(result.success).toBe(true);
        expect(row?.publicationStatus).toBe(PublicationStatusEnum.ARCHIVED);
        expect(row?.deletionAnnouncedAt?.getTime()).toBe(MATRIX_NOW.getTime() + 90 * 86_400_000);
        expect(row?.inactiveSince?.getTime()).toBe(MATRIX_NOW.getTime() - 100 * 86_400_000);
        expect(billingState.revalidated).toContain(id);
        const second = await listingInactivityArchiveJob.handler(jobContext());
        expect(second.processed).toBe(0);
    });

    it('TEST:V6:9 archives overdue PB5 drafts without revalidation', async () => {
        const id = await archivedFixture(PublicationStatusEnum.DRAFT);
        await listingInactivityArchiveJob.handler(jobContext());
        const [row] = await getDb().select().from(accommodations).where(eq(accommodations.id, id));
        expect(row?.publicationStatus).toBe(PublicationStatusEnum.ARCHIVED);
        expect(row?.deletionAnnouncedAt).toBeInstanceOf(Date);
        expect(row?.deletionAnnouncedAt?.getTime()).toBe(MATRIX_NOW.getTime() + 88 * 86_400_000);
        expect(billingState.revalidated).not.toContain(id);
    });

    it('TEST:V6:8 archives overdue UNPUBLISHED_BY_BILLING without revalidation', async () => {
        const id = await archivedFixture(PublicationStatusEnum.UNPUBLISHED_BY_BILLING);
        await listingInactivityArchiveJob.handler(jobContext());
        const [row] = await getDb().select().from(accommodations).where(eq(accommodations.id, id));
        expect(row?.publicationStatus).toBe(PublicationStatusEnum.ARCHIVED);
        expect(billingState.revalidated).not.toContain(id);
    });

    it('TEST:V6:8 leaves retained rows unchanged and stamps returned coverage', async () => {
        const covered = await archivedFixture(PublicationStatusEnum.PUBLISHED);
        billingState.covered = true;
        await listingInactivityArchiveJob.handler(jobContext());
        const [row] = await getDb()
            .select()
            .from(accommodations)
            .where(eq(accommodations.id, covered));
        expect(row?.publicationStatus).toBe(PublicationStatusEnum.PUBLISHED);
        expect(row?.inactiveSince?.getTime()).toBe(MATRIX_NOW.getTime());
    });

    it('TEST:V6:8 leaves stopped retention untouched and does not archive', async () => {
        const id = await archivedFixture(PublicationStatusEnum.PUBLISHED);
        billingState.stopped = true;
        await listingInactivityArchiveJob.handler(jobContext());
        const [row] = await getDb().select().from(accommodations).where(eq(accommodations.id, id));
        expect(row?.publicationStatus).toBe(PublicationStatusEnum.PUBLISHED);
        expect(row?.inactiveSince?.getTime()).toBe(MATRIX_NOW.getTime() - 100 * 86_400_000);
        expect(row?.deletionAnnouncedAt).toBeNull();
    });

    it('TEST:V6:8 counts from a recent pause end instead of the old inactive clock', async () => {
        const id = await archivedFixture(PublicationStatusEnum.PUBLISHED);
        billingState.pauseEndedAt = new Date(MATRIX_NOW.getTime() - 10 * 86_400_000);
        await listingInactivityArchiveJob.handler(jobContext());
        const [row] = await getDb().select().from(accommodations).where(eq(accommodations.id, id));
        expect(row?.publicationStatus).toBe(PublicationStatusEnum.PUBLISHED);
        expect(row?.inactiveSince?.getTime()).toBe(MATRIX_NOW.getTime() - 100 * 86_400_000);
    });
});
