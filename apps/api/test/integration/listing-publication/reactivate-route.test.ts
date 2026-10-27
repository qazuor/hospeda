import { randomUUID } from 'node:crypto';
import { accommodations, eq, getDb, sql } from '@repo/db';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { archiveInactiveListing } from '../../../../../packages/verticals/src/publication/archive-inactive-listing';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { getListingPublicationPorts } from '../../../src/utils/listing-publication/ports';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    createListing,
    createOwner,
    createVerticalDestination,
    createVerticalListing,
    ensurePublicationCatalog,
    MATRIX_NOW,
    readResponse,
    readVerticalStatus
} from './publication-routes.helpers';

vi.mock('../../../src/utils/listing-publication/ports', async (importOriginal) => {
    const { buildMatrixPublicationPorts } = await import('./publication-routes.helpers');
    return buildMatrixPublicationPorts(await importOriginal());
});

const app = initApp({ clock: { now: () => MATRIX_NOW } });
const verticals = [
    VerticalEnum.ACCOMMODATION,
    VerticalEnum.VENUE,
    VerticalEnum.EXPERIENCE
] as const;
function path(vertical: (typeof verticals)[number], id: string) {
    const segment =
        vertical === VerticalEnum.ACCOMMODATION
            ? 'accommodations'
            : vertical === VerticalEnum.VENUE
              ? 'gastronomies'
              : 'experiences';
    return `/api/v1/protected/${segment}/${id}/reactivate`;
}

async function makeListing(
    vertical: (typeof verticals)[number],
    status: typeof PublicationStatusEnum.PUBLISHED | typeof PublicationStatusEnum.DRAFT
) {
    const owner = await createOwner();
    const destinationId = await createVerticalDestination();
    const id =
        vertical === VerticalEnum.ACCOMMODATION
            ? await createListing({ ownerId: owner.id, destinationId, status })
            : await createVerticalListing({ vertical, ownerId: owner.id, destinationId, status });
    if (vertical === VerticalEnum.ACCOMMODATION)
        await getDb()
            .update(accommodations)
            .set({ inactiveSince: new Date(MATRIX_NOW.getTime() - 120 * 86_400_000) })
            .where(eq(accommodations.id, id));
    else {
        if (vertical === VerticalEnum.VENUE)
            await getDb().execute(
                sql`UPDATE venues SET inactive_since = ${new Date(MATRIX_NOW.getTime() - 120 * 86_400_000)} WHERE id = ${id}`
            );
        else
            await getDb().execute(
                sql`UPDATE experiences SET inactive_since = ${new Date(MATRIX_NOW.getTime() - 120 * 86_400_000)} WHERE id = ${id}`
            );
    }
    const ports = getListingPublicationPorts();
    const result = await archiveInactiveListing({
        ...ports,
        billing: {
            ...ports.billing,
            coverage: async () => ({ covered: false, sources: [] }),
            retentionStopped: async () => ({
                stopped: false,
                pauseEndedAt: null,
                coverageLostAt: null
            })
        },
        clock: { now: () => MATRIX_NOW },
        vertical,
        listingId: id,
        ownerId: owner.id,
        correlationId: randomUUID()
    });
    expect(result.archived).toBe(true);
    return { owner, id };
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
});
beforeEach(async () => await testDb.clean());
afterAll(async () => testDb.teardown());

describe.each(verticals)('TEST:V6:10 PB8 route — %s', (vertical) => {
    beforeEach(async () => ensurePublicationCatalog(vertical));

    it('TEST:V6:10 reactivates PB4 and PB5 archives to DRAFT without a plan', async () => {
        const pb4 = await makeListing(vertical, PublicationStatusEnum.PUBLISHED);
        const pb5 = await makeListing(vertical, PublicationStatusEnum.DRAFT);
        for (const fixture of [pb4, pb5]) {
            const response = await readResponse(
                await app.request(path(vertical, fixture.id), {
                    method: 'POST',
                    headers: actorHeaders({ id: fixture.owner.id })
                })
            );
            expect(response.status).toBe(200);
        }
        async function status(id: string) {
            if (vertical === VerticalEnum.ACCOMMODATION) {
                const [row] = await getDb()
                    .select({ status: accommodations.publicationStatus })
                    .from(accommodations)
                    .where(eq(accommodations.id, id));
                return row?.status;
            }
            return readVerticalStatus(vertical, id);
        }
        expect(await status(pb4.id)).toBe(PublicationStatusEnum.DRAFT);
        expect(await status(pb5.id)).toBe(PublicationStatusEnum.DRAFT);
    });

    it('TEST:V6:10 masks foreign and missing ids and requires a session', async () => {
        const fixture = await makeListing(vertical, PublicationStatusEnum.PUBLISHED);
        const foreign = await readResponse(
            await app.request(path(vertical, fixture.id), {
                method: 'POST',
                headers: actorHeaders({ id: randomUUID() })
            })
        );
        const missing = await readResponse(
            await app.request(path(vertical, randomUUID()), {
                method: 'POST',
                headers: actorHeaders({ id: randomUUID() })
            })
        );
        expect(foreign.status).toBe(404);
        expect(foreign.body.error?.code).toBe('NOT_FOUND');
        expect(foreign.body.error).toEqual(missing.body.error);
        const guest = await readResponse(
            await app.request(path(vertical, fixture.id), {
                method: 'POST',
                headers: { 'content-type': 'application/json', 'user-agent': 'vitest' }
            })
        );
        expect(guest.status).toBe(401);
        expect(guest.body.error?.code).toBe('UNAUTHORIZED');
    });

    it.each([
        PublicationStatusEnum.DRAFT,
        PublicationStatusEnum.PUBLISHED
    ])('TEST:V6:10 refuses %s without changing it', async (state) => {
        const owner = await createOwner();
        const id =
            vertical === VerticalEnum.ACCOMMODATION
                ? await createListing({
                      ownerId: owner.id,
                      destinationId: await createVerticalDestination(),
                      status: state
                  })
                : await createVerticalListing({
                      vertical,
                      ownerId: owner.id,
                      destinationId: await createVerticalDestination(),
                      status: state
                  });
        const response = await readResponse(
            await app.request(path(vertical, id), {
                method: 'POST',
                headers: actorHeaders({ id: owner.id })
            })
        );
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.body.error?.code).toBe('NOT_FOUND');
        let status: string | undefined;
        if (vertical === VerticalEnum.ACCOMMODATION) {
            const [row] = await getDb()
                .select({ status: accommodations.publicationStatus })
                .from(accommodations)
                .where(eq(accommodations.id, id));
            status = row?.status;
        } else status = await readVerticalStatus(vertical, id);
        expect(status).toBe(state);
    });
});
