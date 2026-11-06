/**
 * TEST:6.11:3 (AC:6:3) — every business-line change path purges the venue
 * collections (HOS-1871, leaf 6.11 part 2).
 *
 * A venue carries `food` and `nightlife`. The public read filters by line, so
 * removing `nightlife` must take the venue out of that collection on the next
 * read, and adding it back must put it in. Both edit paths that can change the
 * lines — the owner's protected PATCH (action 15's owner half) and the admin's
 * dedicated route (ACC:27, action 27) — are driven end to end against the real
 * app, the real service transaction and the real public read.
 *
 * `vi.mock('@repo/service-core')` cannot capture this purge: the hook reaches
 * `getRevalidationService` through a RELATIVE import inside service-core
 * (`services/listing/listing-revalidation.ts:21`), so the barrel mock never
 * sees the call. The integration alias points `@repo/service-core` at the same
 * source tree, so initializing the real singleton and spying on its instance
 * is the only interception that observes the production call.
 *
 * The public venue listing is deliberately not in `PUBLIC_CACHE_ENDPOINTS`, so
 * each read below is cache-free without any test-only switch.
 */

import { getDb, sql } from '@repo/db';
import { PermissionEnum, PublicationStatusEnum, RoleEnum, VerticalEnum } from '@repo/schemas';
import {
    _resetRevalidationService,
    type EntityChangeData,
    getAffectedCacheTags,
    getRevalidationService,
    initializeRevalidationService
} from '@repo/service-core';
import type { MockInstance } from 'vitest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    createOwner,
    createTrial,
    createVerticalDestination,
    createVerticalListing,
    ensurePublicationCatalog,
    readResponse
} from './publication-routes.helpers';

const app = initApp();
const REASON = 'Support removed the nightlife line after the owner asked by phone';

/** Owners this file seeded; their listings and mail are removed after each test. */
const owners: string[] = [];

let scheduleSpy: MockInstance<(event: EntityChangeData, reason?: string) => void>;

function adminHeaders(args: {
    readonly id: string;
    readonly permissions: readonly PermissionEnum[];
    readonly reason?: string;
}): Record<string, string> {
    const headers = actorHeaders({
        id: args.id,
        role: RoleEnum.ADMIN,
        permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, ...args.permissions]
    });
    return args.reason === undefined ? headers : { ...headers, 'x-action-reason': args.reason };
}

async function seedOwner(): Promise<string> {
    const owner = await createOwner();
    owners.push(owner.id);
    return owner.id;
}

/** A venue owned by `ownerId` with the requested business lines and status. */
async function seedVenue(args: {
    readonly ownerId: string;
    readonly status: PublicationStatusEnum;
    readonly businessLines: readonly ('food' | 'nightlife')[];
}): Promise<{ id: string; slug: string; destinationId: string }> {
    const destinationId = await createVerticalDestination();
    const id = await createVerticalListing({
        vertical: VerticalEnum.VENUE,
        ownerId: args.ownerId,
        destinationId,
        status: args.status
    });
    await getDb().execute(
        sql`UPDATE venues SET type = 'RESTAURANT', business_lines = ${sql.raw(
            `ARRAY[${args.businessLines.map((line) => `'${line}'`).join(',')}]::text[]`
        )} WHERE id = ${id}::uuid`
    );
    const rows = await getDb().execute(sql`SELECT slug FROM venues WHERE id = ${id}::uuid`);
    return {
        id,
        slug: (rows.rows[0] as { slug: string }).slug,
        destinationId
    };
}

/** Makes sure the venue catalog and an active trial exist for the owner. */
async function seedOwnerCoverage(ownerId: string): Promise<void> {
    await ensurePublicationCatalog(VerticalEnum.VENUE);
    await createTrial({
        userId: ownerId,
        vertical: VerticalEnum.VENUE,
        status: 'TRIAL_ACTIVE'
    });
}

/** The public read, uncached: ids of the venues carrying `businessLine` in `destinationId`. */
async function readVenueIds(
    businessLine: 'food' | 'nightlife',
    destinationId: string
): Promise<readonly string[]> {
    const response = await app.request(
        `/api/v1/public/venues?businessLine=${businessLine}&destinationId=${destinationId}&pageSize=50`,
        { headers: { 'user-agent': 'vitest' } }
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
        data?: { items?: ReadonlyArray<{ id?: string }> };
    };
    return (body.data?.items ?? []).map((item) => item.id ?? '');
}

async function storedBusinessLines(id: string): Promise<readonly string[]> {
    const rows = await getDb().execute(
        sql`SELECT business_lines AS lines FROM venues WHERE id = ${id}::uuid`
    );
    return (rows.rows[0] as { lines: readonly string[] }).lines;
}

function ownerHeaders(ownerId: string): Record<string, string> {
    return actorHeaders({
        id: ownerId,
        role: RoleEnum.HOST,
        permissions: [PermissionEnum.VENUE_EDIT_OWN]
    });
}

/** Asserts exactly one venue purge carrying the detail, id and collection tags. */
function expectVenuePurge(args: { readonly id: string; readonly slug: string }): void {
    expect(scheduleSpy).toHaveBeenCalledTimes(1);
    const [event] = scheduleSpy.mock.calls[0] ?? [];
    if (!event) throw new Error('scheduleRevalidation was called with no event');
    expect(event).toMatchObject({
        entityType: 'venue',
        id: args.id,
        slug: args.slug
    });
    expect(getAffectedCacheTags(event)).toEqual(
        expect.arrayContaining(['list-venue', `venue-${args.slug}`, `venue-${args.id}`])
    );
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    initializeRevalidationService({ nodeEnv: 'test', siteUrl: 'http://localhost:4321' });
    const service = getRevalidationService();
    if (!service) throw new Error('Revalidation service was not initialized');
    scheduleSpy = vi.spyOn(service, 'scheduleRevalidation').mockImplementation(() => undefined);
});
beforeEach(() => {
    scheduleSpy.mockClear();
});
afterEach(async () => {
    for (const ownerId of owners.splice(0)) {
        await getDb().execute(
            sql`DELETE FROM email_outbox WHERE recipient_user_id = ${ownerId}::uuid`
        );
        await getDb().execute(sql`DELETE FROM venues WHERE owner_id = ${ownerId}::uuid`);
    }
});
afterAll(async () => {
    scheduleSpy.mockRestore();
    _resetRevalidationService();
    await testDb.teardown();
});

describe('TEST:6.11:3 a business-line change purges the venue collections (AC:6:3)', () => {
    it('case 1: the owner removing nightlife purges list-venue and the venue tags', async () => {
        // Arrange: the venue is listed under both lines before the edit.
        const owner = await seedOwner();
        const venue = await seedVenue({
            ownerId: owner,
            status: PublicationStatusEnum.PUBLISHED,
            businessLines: ['food', 'nightlife']
        });
        await seedOwnerCoverage(owner);
        expect(await readVenueIds('nightlife', venue.destinationId)).toContain(venue.id);

        // Act
        const response = await readResponse(
            await app.request(`/api/v1/protected/venues/${venue.id}`, {
                method: 'PATCH',
                headers: ownerHeaders(owner),
                body: JSON.stringify({ businessLines: ['food'] })
            })
        );

        // Assert: the edit, its purge and the next uncached read.
        expect(response.status).toBe(200);
        expectVenuePurge(venue);
        expect(await readVenueIds('nightlife', venue.destinationId)).not.toContain(venue.id);
        expect(await readVenueIds('food', venue.destinationId)).toContain(venue.id);
    });

    it('case 2: a third party removing nightlife through action 27 purges the same tags', async () => {
        // Arrange
        const owner = await seedOwner();
        const admin = await seedOwner();
        const venue = await seedVenue({
            ownerId: owner,
            status: PublicationStatusEnum.PUBLISHED,
            businessLines: ['food', 'nightlife']
        });
        await seedOwnerCoverage(owner);
        expect(await readVenueIds('nightlife', venue.destinationId)).toContain(venue.id);

        // Act
        const response = await readResponse(
            await app.request(`/api/v1/admin/venues/${venue.id}/business-lines`, {
                method: 'PATCH',
                headers: adminHeaders({
                    id: admin,
                    permissions: [PermissionEnum.VENUE_EDIT_ALL, PermissionEnum.VENUE_VIEW_ALL],
                    reason: encodeURIComponent(REASON)
                }),
                body: JSON.stringify({ businessLines: ['food'] })
            })
        );

        // Assert
        expect(response.status).toBe(200);
        expectVenuePurge(venue);
        expect(await readVenueIds('nightlife', venue.destinationId)).not.toContain(venue.id);
        expect(await readVenueIds('food', venue.destinationId)).toContain(venue.id);
    });

    it('case 3: adding a line also purges, so the new collection shows the venue', async () => {
        // Arrange: food only, so the nightlife collection does not have it yet.
        const owner = await seedOwner();
        const venue = await seedVenue({
            ownerId: owner,
            status: PublicationStatusEnum.PUBLISHED,
            businessLines: ['food']
        });
        await seedOwnerCoverage(owner);
        expect(await readVenueIds('nightlife', venue.destinationId)).not.toContain(venue.id);

        // Act
        const response = await readResponse(
            await app.request(`/api/v1/protected/venues/${venue.id}`, {
                method: 'PATCH',
                headers: ownerHeaders(owner),
                body: JSON.stringify({ businessLines: ['food', 'nightlife'] })
            })
        );

        // Assert: the purge carries `list-venue` (asserted inside the helper),
        // and the next read shows the venue in the new collection.
        expect(response.status).toBe(200);
        expectVenuePurge(venue);
        expect(await readVenueIds('nightlife', venue.destinationId)).toContain(venue.id);
    });

    it('case 4: a non-public listing edits fine but schedules no purge', async () => {
        // Arrange: a DRAFT has no public footprint to evict.
        const owner = await seedOwner();
        const venue = await seedVenue({
            ownerId: owner,
            status: PublicationStatusEnum.DRAFT,
            businessLines: ['food', 'nightlife']
        });
        await seedOwnerCoverage(owner);

        // Act
        const response = await readResponse(
            await app.request(`/api/v1/protected/venues/${venue.id}`, {
                method: 'PATCH',
                headers: ownerHeaders(owner),
                body: JSON.stringify({ businessLines: ['food'] })
            })
        );

        // Assert
        expect(response.status).toBe(200);
        expect(scheduleSpy).not.toHaveBeenCalled();
        expect(await storedBusinessLines(venue.id)).toEqual(['food']);
    });

    it('case 5: action 15 rejects businessLines and leaves the row untouched', async () => {
        // Arrange: the general admin PATCH is content editing, not the
        // dedicated line-change action.
        const owner = await seedOwner();
        const admin = await seedOwner();
        const venue = await seedVenue({
            ownerId: owner,
            status: PublicationStatusEnum.PUBLISHED,
            businessLines: ['food', 'nightlife']
        });
        await seedOwnerCoverage(owner);

        // Act
        const response = await readResponse(
            await app.request(`/api/v1/admin/venues/${venue.id}`, {
                method: 'PATCH',
                headers: adminHeaders({
                    id: admin,
                    permissions: [
                        PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT,
                        PermissionEnum.VENUE_EDIT_ALL,
                        PermissionEnum.VENUE_VIEW_ALL
                    ],
                    reason: encodeURIComponent(REASON)
                }),
                body: JSON.stringify({ businessLines: ['food'] })
            })
        );

        // Assert
        expect(response.status).toBe(403);
        expect(response.body.error?.code).toBe('FORBIDDEN');
        expect(await storedBusinessLines(venue.id)).toEqual(['food', 'nightlife']);
        expect(scheduleSpy).not.toHaveBeenCalled();
    });
});
