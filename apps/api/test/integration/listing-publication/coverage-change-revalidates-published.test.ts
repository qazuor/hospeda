/**
 * TEST:6.11:2, AC:6:4 (HOS-1787 F-V1-029) — a plan change that leaves every publication status
 * untouched still asks for the revalidation of every PUBLISHED listing of the owner in the
 * vertical. The purges are captured at the port boundary: `ports.ts` imports
 * `getRevalidationService` from the `@repo/service-core` barrel, so replacing that one export is
 * enough to see what the production composition schedules.
 */
import { randomUUID } from 'node:crypto';
import { getDb, inArray, venues } from '@repo/db';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { recalculateCoverage } from '../../../../../packages/verticals/src/publication/coverage-recalculation';
import { injectClock } from '../../../src/utils/clock';
import { validateApiEnv } from '../../../src/utils/env';
import { getListingAccessPorts } from '../../../src/utils/listing-access/ports';
import {
    drainListingCoverageRecalculations,
    subscribeListingCoverageRecalculation
} from '../../../src/utils/listing-publication/coverage-listener';
import { getListingPublicationPorts } from '../../../src/utils/listing-publication/ports';
import { testDb } from '../../e2e/setup/test-database';
import {
    createOwner,
    createTrial,
    createVerticalDestination,
    createVerticalListing,
    ensurePublicationCatalog,
    readVerticalStatus
} from './publication-routes.helpers';

const state = vi.hoisted(() => ({ scheduledRevalidations: [] as unknown[] }));

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        getRevalidationService: () => ({
            scheduleRevalidation: (input: unknown) => state.scheduledRevalidations.push(input)
        })
    };
});

const now = new Date('2026-10-22T12:00:00.000Z');
const clock = { now: () => now };
const vertical = VerticalEnum.VENUE;

type ScheduledRevalidation = {
    readonly entityType: string;
    readonly id: string;
    readonly slug: string;
    readonly destinationSlug?: string;
};

beforeAll(async () => {
    await testDb.setup();
    validateApiEnv();
    injectClock({ clock });
});
beforeEach(async () => {
    state.scheduledRevalidations = [];
    await testDb.clean();
});
afterAll(async () => testDb.teardown());

/** The slug of each venue, keyed by id, read from the row the purge resolves. */
async function readVenueSlugs(ids: readonly string[]): Promise<ReadonlyMap<string, string>> {
    const rows = await getDb()
        .select({ id: venues.id, slug: venues.slug })
        .from(venues)
        .where(inArray(venues.id, [...ids]));
    return new Map(rows.map((row) => [row.id, row.slug]));
}

function scheduled(): ScheduledRevalidation[] {
    return state.scheduledRevalidations as ScheduledRevalidation[];
}

describe('TEST:6.11:2 a plan change revalidates every published listing of the owner', () => {
    it('revalidates the N published listings of the owner through the real recalculation', async () => {
        const owner = await createOwner();
        await ensurePublicationCatalog(vertical);
        await createTrial({ userId: owner.id, vertical, status: 'TRIAL_ACTIVE' });
        const destinationId = await createVerticalDestination();
        const firstPublished = await createVerticalListing({
            vertical,
            ownerId: owner.id,
            destinationId,
            status: PublicationStatusEnum.PUBLISHED
        });
        const secondPublished = await createVerticalListing({
            vertical,
            ownerId: owner.id,
            destinationId,
            status: PublicationStatusEnum.PUBLISHED
        });
        const draft = await createVerticalListing({
            vertical,
            ownerId: owner.id,
            destinationId,
            status: PublicationStatusEnum.DRAFT
        });
        const otherOwner = await createOwner();
        const otherListing = await createVerticalListing({
            vertical,
            ownerId: otherOwner.id,
            destinationId,
            status: PublicationStatusEnum.PUBLISHED
        });
        const slugs = await readVenueSlugs([firstPublished, secondPublished]);

        await recalculateCoverage({
            ...getListingPublicationPorts({ liveLimit: async () => 3 }),
            clock,
            userId: owner.id,
            vertical,
            correlationId: randomUUID()
        });

        const purges = scheduled();
        expect(purges).toHaveLength(2);
        expect(purges.map((purge) => purge.id).sort()).toEqual(
            [firstPublished, secondPublished].sort()
        );
        for (const id of [firstPublished, secondPublished]) {
            expect(purges).toContainEqual(
                expect.objectContaining({ entityType: 'venue', id, slug: slugs.get(id) })
            );
        }
        expect(purges.some((purge) => purge.id === draft)).toBe(false);
        expect(purges.some((purge) => purge.id === otherListing)).toBe(false);
        await expect(readVerticalStatus(vertical, firstPublished)).resolves.toBe(
            PublicationStatusEnum.PUBLISHED
        );
        await expect(readVerticalStatus(vertical, secondPublished)).resolves.toBe(
            PublicationStatusEnum.PUBLISHED
        );
        await expect(readVerticalStatus(vertical, draft)).resolves.toBe(
            PublicationStatusEnum.DRAFT
        );
    });

    it('revalidates the published listing when the coverage notice reports a plan change', async () => {
        const owner = await createOwner();
        await ensurePublicationCatalog(vertical);
        await createTrial({ userId: owner.id, vertical, status: 'TRIAL_ACTIVE' });
        const destinationId = await createVerticalDestination();
        const published = await createVerticalListing({
            vertical,
            ownerId: owner.id,
            destinationId,
            status: PublicationStatusEnum.PUBLISHED
        });
        const slugs = await readVenueSlugs([published]);

        const unsubscribe = subscribeListingCoverageRecalculation();
        try {
            await getListingAccessPorts().billing.emitCoverageChanged({
                userId: owner.id,
                vertical,
                sourceType: 'SUBSCRIPTION',
                change: 'CHANGED'
            });
            await drainListingCoverageRecalculations();
        } finally {
            unsubscribe();
        }

        await expect(readVerticalStatus(vertical, published)).resolves.toBe(
            PublicationStatusEnum.PUBLISHED
        );
        expect(scheduled()).toContainEqual(
            expect.objectContaining({
                entityType: 'venue',
                id: published,
                slug: slugs.get(published)
            })
        );
    });
});
