/**
 * TEST:V6:34 AC:V6:26 (HOS-1483) — the contract's inverse listing case set
 * (`listingCaseSet`: `listing`, `listingPurged` and the PURGED push; contract
 * §4.1, §3.1, §6.2) against the REAL implementation composed by `apps/api`:
 * the verticals listing inverse over `@repo/db`'s `listingContractModel`, and
 * PB12 reached through its real HTTP route, whose push is emitted after the
 * commit.
 *
 * Every user, destination and listing this suite writes is deleted by id in
 * `afterAll` (never a TRUNCATE): a live PUBLISHED or MODERATED listing would
 * change the global populations other suites of the same run read.
 * `domain_event` is append-only and is not touched.
 */
import { randomUUID } from 'node:crypto';
import { type ListingCaseHarness, listingCaseSet } from '@repo/billing-verticals-contract/testing';
import { getDb, sql, users } from '@repo/db';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { createApiListingInverse } from '../../../src/utils/listing-publication/listing-inverse';
import { onListingPurged } from '../../../src/utils/listing-publication/listing-purged-emitter';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    createListing,
    createVerticalDestination,
    createVerticalListing,
    ensurePublicationCatalog,
    readResponse
} from './publication-routes.helpers';

const { mediaDelete } = vi.hoisted(() => ({ mediaDelete: vi.fn() }));
vi.mock('../../../src/services/media', () => ({
    getMediaProvider: () => ({ delete: mediaDelete })
}));

type ListingVertical =
    | typeof VerticalEnum.ACCOMMODATION
    | typeof VerticalEnum.VENUE
    | typeof VerticalEnum.EXPERIENCE;

const TABLES: Readonly<Record<ListingVertical, string>> = {
    [VerticalEnum.ACCOMMODATION]: 'accommodations',
    [VerticalEnum.VENUE]: 'venues',
    [VerticalEnum.EXPERIENCE]: 'experiences'
};
const ROUTE_TABLES: Readonly<Record<ListingVertical, string>> = {
    ...TABLES,
    [VerticalEnum.VENUE]: 'gastronomies'
};

const CREATE_LISTING: Readonly<
    Record<
        ListingVertical,
        (args: {
            readonly ownerId: string;
            readonly destinationId: string;
            readonly status: PublicationStatusEnum;
        }) => Promise<string>
    >
> = {
    [VerticalEnum.ACCOMMODATION]: (args) => createListing({ ...args, complete: false }),
    [VerticalEnum.VENUE]: (args) =>
        createVerticalListing({ ...args, vertical: VerticalEnum.VENUE }),
    [VerticalEnum.EXPERIENCE]: (args) =>
        createVerticalListing({ ...args, vertical: VerticalEnum.EXPERIENCE })
};

/** Narrows a vertical of the case set to one backed by a listing table. */
function listingVertical(vertical: VerticalEnum): ListingVertical {
    const found = (Object.keys(TABLES) as ListingVertical[]).find(
        (candidate) => candidate === vertical
    );
    if (!found) throw new Error(`No listing table for vertical ${vertical}`);
    return found;
}

const app = initApp();
const subject = createApiListingInverse();

/** What this suite wrote, deleted by id in `afterAll`. */
const written = {
    listings: new Map<string, { readonly vertical: ListingVertical; readonly ownerId: string }>(),
    destinations: new Set<string>(),
    users: new Set<string>()
};

/** Inserts the user with exactly that id, once. */
async function ensureUser(id: string): Promise<void> {
    await getDb()
        .insert(users)
        .values({
            id,
            email: `contract-case-set-${randomUUID()}@example.test`,
            displayName: 'Contract case set owner',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .onConflictDoNothing();
    written.users.add(id);
}

async function arrangeListing(args: {
    readonly vertical: VerticalEnum;
    readonly ownerId: string;
    readonly state: 'PUBLISHED' | 'MODERATED';
}): Promise<{ readonly listingId: string }> {
    const vertical = listingVertical(args.vertical);
    await ensureUser(args.ownerId);
    const destinationId = await createVerticalDestination();
    written.destinations.add(destinationId);
    const listingId = await CREATE_LISTING[vertical]({
        ownerId: args.ownerId,
        destinationId,
        status: PublicationStatusEnum[args.state]
    });
    written.listings.set(listingId, { vertical, ownerId: args.ownerId });
    return { listingId };
}

/** PB12 through its real route; resolves once committed AND the push for it arrived. */
async function purgeListing(args: { readonly listingId: string }): Promise<void> {
    const listing = written.listings.get(args.listingId);
    if (!listing) throw new Error(`Listing ${args.listingId} was not arranged by this suite`);
    await ensurePublicationCatalog(listing.vertical);
    let unsubscribe: () => void = () => undefined;
    const pushed = new Promise<void>((resolve) => {
        unsubscribe = onListingPurged((event) => {
            if (event.listingId === args.listingId) resolve();
        });
    });
    try {
        const response = await readResponse(
            await app.request(
                `/api/v1/protected/${ROUTE_TABLES[listing.vertical]}/${args.listingId}/purge`,
                { method: 'POST', headers: actorHeaders({ id: listing.ownerId }) }
            )
        );
        expect(response.status, 'PB12 answers 200').toBe(200);
        await pushed;
    } finally {
        unsubscribe();
    }
}

const harness: ListingCaseHarness = {
    subject,
    arrangeListing,
    purgeListing,
    unknownListingId: () => randomUUID(),
    newUserId: () => randomUUID()
};

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
});

afterAll(async () => {
    const db = getDb();
    for (const vertical of Object.keys(TABLES) as ListingVertical[]) {
        const ids = [...written.listings]
            .filter(([, listing]) => listing.vertical === vertical)
            .map(([id]) => id);
        if (ids.length > 0) {
            await db.execute(
                sql`DELETE FROM ${sql.identifier(TABLES[vertical])} WHERE id = ANY(${sql.param(ids)}::uuid[])`
            );
        }
    }
    const destinationIds = [...written.destinations];
    if (destinationIds.length > 0) {
        await db.execute(
            sql`DELETE FROM destinations WHERE id = ANY(${sql.param(destinationIds)}::uuid[])`
        );
    }
    const userIds = [...written.users];
    if (userIds.length > 0) {
        await db.execute(sql`DELETE FROM users WHERE id = ANY(${sql.param(userIds)}::uuid[])`);
    }
    await testDb.teardown();
});

listingCaseSet({ describe, it, expect, makeHarness: async () => harness });

describe('TEST:V6:34 AC:V6:26 ficha and fichaPurgada over the three states (gastronomy)', () => {
    it('TEST:V6:34 AC:V6:26 PUBLISHED, MODERATED and PURGED by PB12', async () => {
        const ownerId = randomUUID();
        const vertical = VerticalEnum.VENUE;
        const published = await arrangeListing({ vertical, ownerId, state: 'PUBLISHED' });
        const moderated = await arrangeListing({ vertical, ownerId, state: 'MODERATED' });
        const purged = await arrangeListing({ vertical, ownerId, state: 'PUBLISHED' });
        await purgeListing(purged);

        expect(await subject.listing(published)).toEqual({
            vertical,
            ownerId,
            acceptsFeature: true
        });
        expect(await subject.listing(moderated)).toEqual({
            vertical,
            ownerId,
            acceptsFeature: false
        });
        expect(await subject.listing(purged)).toEqual({
            vertical,
            ownerId,
            acceptsFeature: false
        });
        expect([
            (await subject.listingPurged(published)).purged,
            (await subject.listingPurged(moderated)).purged,
            (await subject.listingPurged(purged)).purged
        ]).toEqual([false, false, true]);
    });
});
