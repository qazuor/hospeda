import { randomUUID } from 'node:crypto';
import { accommodations, domainEvent, emailOutbox, eq, fixRequests, getDb } from '@repo/db';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { requestListingFix } from '../../../../../packages/verticals/src/publication/fix-request';
import { takeDownListing } from '../../../../../packages/verticals/src/publication/moderate-listing';
import { initApp } from '../../../src/app';
import { getListingPublicationPorts } from '../../../src/utils/listing-publication/ports';
import { testDb } from '../../e2e/setup/test-database';
import {
    createListing,
    createOwner,
    createVerticalDestination
} from './publication-routes.helpers';

beforeAll(async () => testDb.setup());
beforeEach(async () => testDb.clean());
afterAll(async () => testDb.teardown());

describe('production moderation transaction ports', () => {
    it('TEST:V6:11 delegates moderation reads, events and notices through the real adapter', async () => {
        initApp({ clock: { now: () => new Date('2026-10-12T12:00:00.000Z') } });
        const owner = await createOwner();
        const admin = await createOwner();
        const destinationId = await createVerticalDestination();
        const listingId = await createListing({
            ownerId: owner.id,
            destinationId,
            status: PublicationStatusEnum.PUBLISHED
        });
        const ports = getListingPublicationPorts();
        const correlationId = randomUUID();
        const clock = { now: () => new Date('2026-10-12T12:00:00.000Z') };
        const vertical: typeof VerticalEnum.ACCOMMODATION = VerticalEnum.ACCOMMODATION;
        const common = {
            ...ports,
            clock,
            adminId: admin.id,
            ownerId: owner.id,
            vertical,
            listingId,
            reason: 'Update listing details',
            correlationId
        };

        const fix = await requestListingFix({ ...common, suggestedDate: '2026-10-20' });
        const down = await takeDownListing(common);

        expect(fix).toMatchObject({ ok: true, warnings: [] });
        expect(down).toMatchObject({ ok: true });
        const [listing] = await getDb()
            .select({ status: accommodations.publicationStatus })
            .from(accommodations)
            .where(eq(accommodations.id, listingId));
        expect(listing?.status).toBe(PublicationStatusEnum.MODERATED);
        const [request] = await getDb()
            .select({ reason: fixRequests.reason, closedAt: fixRequests.closedAt })
            .from(fixRequests)
            .where(eq(fixRequests.entityId, listingId));
        expect(request).toMatchObject({ reason: 'Update listing details', closedAt: null });
        const events = await getDb()
            .select({
                actorType: domainEvent.actorType,
                actorId: domainEvent.actorId,
                reason: domainEvent.reason
            })
            .from(domainEvent)
            .where(eq(domainEvent.entityId, listingId));
        expect(events).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    actorType: 'admin',
                    actorId: admin.id,
                    reason: 'Update listing details'
                })
            ])
        );
        const notices = await getDb()
            .select({
                template: emailOutbox.template,
                recipientUserId: emailOutbox.recipientUserId
            })
            .from(emailOutbox)
            .where(eq(emailOutbox.correlationId, correlationId));
        expect(notices.map(({ template }) => template)).toEqual(
            expect.arrayContaining([
                'verticals.listing-fix-requested',
                'verticals.listing-moderation-level-changed'
            ])
        );
        expect(notices.every(({ recipientUserId }) => recipientUserId === owner.id)).toBe(true);
    });
});
