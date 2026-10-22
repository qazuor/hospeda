/** TEST:1744:6 — PB3 revalidates all three verticals and omits incomplete listings from its notice. */
import { randomUUID } from 'node:crypto';
import { accommodations, emailOutbox, eq, experiences, gastronomies, getDb } from '@repo/db';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { recalculateCoverage } from '../../../../../packages/verticals/src/publication/coverage-recalculation';
import { injectClock } from '../../../src/utils/clock';
import { validateApiEnv } from '../../../src/utils/env';
import { getListingPublicationPorts } from '../../../src/utils/listing-publication/ports';
import { testDb } from '../../e2e/setup/test-database';
import {
    createListing,
    createOwner,
    createTrial,
    createVerticalDestination,
    createVerticalListing,
    ensurePublicationCatalog
} from './publication-routes.helpers';

const now = new Date('2026-10-22T12:00:00.000Z');
const clock = { now: () => now };
const verticals = [
    VerticalEnum.ACCOMMODATION,
    VerticalEnum.GASTRONOMY,
    VerticalEnum.EXPERIENCE
] as const;

beforeAll(async () => {
    await testDb.setup();
    validateApiEnv();
    injectClock({ clock });
});
beforeEach(async () => testDb.clean());
afterAll(async () => testDb.teardown());

describe.each(verticals)('TEST:1744:6 restitution completeness — %s', (vertical) => {
    it('restores a complete candidate and leaves the incomplete candidate unpublished', async () => {
        const owner = await createOwner();
        await ensurePublicationCatalog(vertical);
        await createTrial({ userId: owner.id, vertical, status: 'TRIAL_ACTIVE' });
        const destinationId = await createVerticalDestination();
        const create = (complete: boolean) => {
            if (vertical === VerticalEnum.ACCOMMODATION)
                return createListing({
                    ownerId: owner.id,
                    destinationId,
                    status: PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
                    complete
                });
            return createVerticalListing({
                vertical,
                ownerId: owner.id,
                destinationId,
                status: PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
                complete
            });
        };
        const completeId = await create(true);
        const incompleteId = await create(false);
        const ports = getListingPublicationPorts({ liveLimit: async () => 3 });
        await recalculateCoverage({
            ...ports,
            clock,
            userId: owner.id,
            vertical,
            correlationId: randomUUID()
        });

        const [completeStatus, incompleteStatus] = await Promise.all([
            readStatus(vertical, completeId),
            readStatus(vertical, incompleteId)
        ]);
        expect(completeStatus).toBe(PublicationStatusEnum.PUBLISHED);
        expect(incompleteStatus).toBe(PublicationStatusEnum.UNPUBLISHED_BY_BILLING);
        const notices = await getDb()
            .select()
            .from(emailOutbox)
            .where(eq(emailOutbox.recipientUserId, owner.id));
        expect(notices).toHaveLength(1);
        expect(notices[0]?.payload.restoredListingIds).toEqual([completeId]);
        expect(notices[0]?.payload.notRestoredListingIds).toEqual([]);
    });
});

async function readStatus(vertical: (typeof verticals)[number], id: string) {
    if (vertical === VerticalEnum.ACCOMMODATION) {
        const [row] = await getDb()
            .select({ status: accommodations.publicationStatus })
            .from(accommodations)
            .where(eq(accommodations.id, id));
        return row?.status;
    }
    if (vertical === VerticalEnum.GASTRONOMY) {
        const [row] = await getDb()
            .select({ status: gastronomies.publicationStatus })
            .from(gastronomies)
            .where(eq(gastronomies.id, id));
        return row?.status;
    }
    const [row] = await getDb()
        .select({ status: experiences.publicationStatus })
        .from(experiences)
        .where(eq(experiences.id, id));
    return row?.status;
}
