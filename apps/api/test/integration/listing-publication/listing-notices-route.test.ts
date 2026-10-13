/**
 * TEST:V8a:5 / TEST:V8a:7 backend half (HOS-1492, V8a.1b, run 1): the
 * listing-notices composition read over real listings in the three verticals,
 * brought to each state by the real transitions (PB12, PB10, the fix request,
 * the lift) or, for row 20 (no producer at the cut, H8), seeded `PURGED` with
 * a `job` event. Coverage is the real one except for the owners a case
 * overrides. Cleans its own rows in `afterEach`.
 */
import { randomUUID } from 'node:crypto';
import { domainEventModel, getDb, sql } from '@repo/db';
import {
    type ListingNoticesResponse,
    PermissionEnum,
    PublicationStatusEnum,
    RoleEnum,
    VerticalEnum
} from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    createListing,
    createOwner,
    createTrial,
    createVerticalDestination,
    createVerticalListing,
    ensurePublicationCatalog
} from './publication-routes.helpers';

const { coverageOverrides } = vi.hoisted(() => ({
    coverageOverrides: new Map<string, unknown>()
}));
vi.mock('../../../src/utils/listing-access/ports', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/utils/listing-access/ports')>();
    return {
        ...actual,
        getListingAccessPorts: () => {
            const real = actual.getListingAccessPorts();
            return {
                ...real,
                billing: {
                    ...real.billing,
                    coverage: async (input: Parameters<typeof real.billing.coverage>[0]) =>
                        (coverageOverrides.get(input.userId) as Awaited<
                            ReturnType<typeof real.billing.coverage>
                        >) ?? real.billing.coverage(input)
                }
            };
        }
    };
});

const app = initApp();
const verticals = [
    VerticalEnum.ACCOMMODATION,
    VerticalEnum.GASTRONOMY,
    VerticalEnum.EXPERIENCE
] as const;
type Vertical = (typeof verticals)[number];
const segments: Readonly<Record<Vertical, string>> = {
    [VerticalEnum.ACCOMMODATION]: 'accommodations',
    [VerticalEnum.GASTRONOMY]: 'gastronomies',
    [VerticalEnum.EXPERIENCE]: 'experiences'
};
const createdOwners: string[] = [];

async function owner(): Promise<string> {
    const created = await createOwner();
    createdOwners.push(created.id);
    return created.id;
}

async function listing(vertical: Vertical, ownerId: string, status: PublicationStatusEnum) {
    const destinationId = await createVerticalDestination();
    switch (vertical) {
        case VerticalEnum.ACCOMMODATION:
            return createListing({ ownerId, destinationId, status, complete: false });
        case VerticalEnum.GASTRONOMY:
        case VerticalEnum.EXPERIENCE:
            return createVerticalListing({ vertical, ownerId, destinationId, status });
        default: {
            const exhaustive: never = vertical;
            throw new Error(`Unsupported vertical ${String(exhaustive)}`);
        }
    }
}

async function moderate(vertical: Vertical, id: string, body: Record<string, unknown>) {
    const admin = await owner();
    const response = await app.request(`/api/v1/admin/${segments[vertical]}/${id}/moderate`, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: actorHeaders({
            id: admin,
            role: RoleEnum.ADMIN,
            permissions: [
                PermissionEnum.ACCESS_PANEL_ADMIN,
                PermissionEnum.ACCESS_API_ADMIN,
                PermissionEnum.LISTING_MODERATE
            ]
        })
    });
    expect(response.status, await response.clone().text()).toBe(200);
}

async function purgeAsOwner(vertical: Vertical, id: string, ownerId: string) {
    const response = await app.request(`/api/v1/protected/${segments[vertical]}/${id}/purge`, {
        method: 'POST',
        headers: actorHeaders({ id: ownerId })
    });
    expect(response.status, await response.clone().text()).toBe(200);
}

async function readNotices(vertical: Vertical, ownerId: string) {
    const response = await app.request(`/api/v1/protected/publish/listing-notices/${vertical}`, {
        headers: actorHeaders({ id: ownerId })
    });
    const body = (await response.json()) as { data?: ListingNoticesResponse };
    return { status: response.status, data: body.data };
}

async function readRow(vertical: Vertical, id: string) {
    const result = await getDb().execute(
        sql<{
            publicationStatus: string;
            deletedAt: unknown;
        }>`SELECT publication_status AS "publicationStatus", deleted_at AS "deletedAt" FROM ${sql.identifier(segments[vertical])} WHERE id = ${id}::uuid`
    );
    return result.rows[0];
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
});
afterEach(async () => {
    coverageOverrides.clear();
    const ids = createdOwners.splice(0);
    if (ids.length === 0) return;
    const list = sql.param(ids);
    await getDb().execute(
        sql`DELETE FROM email_outbox WHERE recipient_user_id = ANY(${list}::uuid[])`
    );
    for (const table of Object.values(segments)) {
        await getDb().execute(
            sql`UPDATE ${sql.identifier(table)} SET deleted_at = now() WHERE owner_id = ANY(${list}::uuid[]) AND deleted_at IS NULL`
        );
    }
});
afterAll(async () => testDb.teardown());

describe.each(verticals)('HOS-1492 listing notices read — %s', (vertical) => {
    it('TEST:V8a:5 row 20: a listing PURGED by the job says it was deleted for inactivity', async () => {
        // Arrange (H8: PB9 has no producer at the cut — seeded PURGED + job event)
        await ensurePublicationCatalog(vertical);
        const ownerId = await owner();
        const id = await listing(vertical, ownerId, PublicationStatusEnum.PURGED);
        await domainEventModel.insert({
            eventType: 'listing.status_changed',
            entityType: vertical,
            entityId: id,
            actorType: 'job',
            correlationId: randomUUID(),
            changes: [{ field: 'publicationStatus', old: 'ARCHIVED', new: 'PURGED' }]
        });

        // Act
        const response = await readNotices(vertical, ownerId);

        // Assert
        expect(response.status).toBe(200);
        expect(response.data?.items).toEqual([
            {
                listingId: id,
                publicationStatus: PublicationStatusEnum.PURGED,
                recurringListingAddons: 0,
                notices: [{ kind: 'PURGED_BY_INACTIVITY' }]
            }
        ]);
        expect(await readRow(vertical, id)).toEqual({
            publicationStatus: 'PURGED',
            deletedAt: null
        });
    });

    it('TEST:V8a:7 PB12 by the owner is a plain PURGED, and over MODERATED it is row 31', async () => {
        // Arrange
        await ensurePublicationCatalog(vertical);
        const ownerId = await owner();
        const draft = await listing(vertical, ownerId, PublicationStatusEnum.DRAFT);
        const published = await listing(vertical, ownerId, PublicationStatusEnum.PUBLISHED);
        await purgeAsOwner(vertical, draft, ownerId);
        await moderate(vertical, published, { action: 'TAKE_DOWN', reason: 'Fotos ajenas' });
        await purgeAsOwner(vertical, published, ownerId);

        // Act
        const response = await readNotices(vertical, ownerId);

        // Assert
        expect(response.status).toBe(200);
        const byId = new Map(response.data?.items.map((item) => [item.listingId, item.notices]));
        expect(byId.get(draft)).toEqual([{ kind: 'PURGED' }]);
        expect(byId.get(published)).toEqual([{ kind: 'PURGED_FROM_MODERATION' }]);
        expect((await readRow(vertical, published))?.publicationStatus).toBe('PURGED');
    });

    it('TEST:V8a:7 row 24: PB10 shows the reason and the instant; row 30: the fix request', async () => {
        // Arrange
        await ensurePublicationCatalog(vertical);
        const ownerId = await owner();
        const moderated = await listing(vertical, ownerId, PublicationStatusEnum.PUBLISHED);
        const asked = await listing(vertical, ownerId, PublicationStatusEnum.PUBLISHED);
        await moderate(vertical, moderated, { action: 'TAKE_DOWN', reason: 'Fotos ajenas' });
        await moderate(vertical, asked, {
            action: 'REQUEST_FIX',
            reason: 'Actualizá el horario',
            suggestedDate: '2026-10-20'
        });

        // Act
        const response = await readNotices(vertical, ownerId);

        // Assert
        expect(response.status).toBe(200);
        const byId = new Map(response.data?.items.map((item) => [item.listingId, item]));
        const event = await getDb().execute(
            sql<{
                occurredAt: Date;
            }>`SELECT occurred_at AS "occurredAt" FROM domain_event WHERE entity_type = ${vertical} AND entity_id = ${moderated} AND event_type = 'listing.status_changed' ORDER BY occurred_at DESC LIMIT 1`
        );
        const since = new Date(String(event.rows[0]?.occurredAt)).toISOString();
        expect(byId.get(moderated)?.notices).toEqual([
            { kind: 'MODERATED', reason: 'Fotos ajenas', since }
        ]);
        const fix = await getDb().execute(
            sql<{
                openedAt: Date;
            }>`SELECT opened_at AS "openedAt" FROM fix_request WHERE entity_type = ${vertical} AND entity_id = ${asked}::uuid AND closed_at IS NULL`
        );
        expect(byId.get(asked)?.publicationStatus).toBe(PublicationStatusEnum.PUBLISHED);
        expect(byId.get(asked)?.notices).toEqual([
            {
                kind: 'FIX_REQUESTED',
                reason: 'Actualizá el horario',
                suggestedDate: '2026-10-20',
                openedAt: new Date(String(fix.rows[0]?.openedAt)).toISOString(),
                ownerReportedFixedAt: null
            }
        ]);
    });

    it('TEST:V8a:7 row 30: a lift says where the listing went', async () => {
        // Arrange
        await ensurePublicationCatalog(vertical);
        const ownerId = await owner();
        const id = await listing(vertical, ownerId, PublicationStatusEnum.PUBLISHED);
        await moderate(vertical, id, { action: 'TAKE_DOWN', reason: 'Fotos ajenas' });
        await moderate(vertical, id, { action: 'LIFT', reason: 'Revisado', keepFixRequest: true });

        // Act
        const response = await readNotices(vertical, ownerId);

        // Assert
        expect(response.status).toBe(200);
        const row = await readRow(vertical, id);
        const [item] = response.data?.items ?? [];
        expect(item?.publicationStatus).toBe(row?.publicationStatus);
        const kinds = item?.notices.map((notice) => notice.kind);
        expect(kinds).toContain('MODERATION_LIFTED');
        expect(kinds).toContain('FIX_REQUESTED');
        const lifted = item?.notices.find((notice) => notice.kind === 'MODERATION_LIFTED');
        expect(lifted).toMatchObject({
            kind: 'MODERATION_LIFTED',
            returnedTo: row?.publicationStatus,
            fixRequestOpen: true
        });
    });

    it('TEST:V8a:7 rows 8/9: UNPUBLISHED_BY_BILLING is surplus only while covered, with its recurring add-ons', async () => {
        // Arrange
        await ensurePublicationCatalog(vertical);
        const coveredOwner = await owner();
        const uncoveredOwner = await owner();
        const surplus = await listing(
            vertical,
            coveredOwner,
            PublicationStatusEnum.UNPUBLISHED_BY_BILLING
        );
        const lost = await listing(
            vertical,
            uncoveredOwner,
            PublicationStatusEnum.UNPUBLISHED_BY_BILLING
        );
        coverageOverrides.set(coveredOwner, {
            covered: true,
            sources: [
                {
                    type: 'ADDON',
                    reference: { kind: 'ADDON_VERSION', id: randomUUID() },
                    scope: 'LISTING',
                    target: surplus,
                    since: new Date('2026-09-01T00:00:00.000Z'),
                    until: 'NO_KNOWN_DATE',
                    charged: null,
                    floor: null
                }
            ]
        });
        coverageOverrides.set(uncoveredOwner, { covered: false, sources: [] });

        // Act
        const covered = await readNotices(vertical, coveredOwner);
        const uncovered = await readNotices(vertical, uncoveredOwner);

        // Assert
        expect(covered.data?.items).toEqual([
            {
                listingId: surplus,
                publicationStatus: PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
                recurringListingAddons: 1,
                notices: [{ kind: 'SURPLUS' }]
            }
        ]);
        expect(uncovered.data?.items).toEqual([
            {
                listingId: lost,
                publicationStatus: PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
                recurringListingAddons: 0,
                notices: []
            }
        ]);
    });

    it('TEST:V8a:7 row 2: trialRunning follows the trial row', async () => {
        // Arrange
        await ensurePublicationCatalog(vertical);
        const withTrial = await owner();
        const withoutTrial = await owner();
        await createTrial({ userId: withTrial, vertical, status: 'TRIAL_ACTIVE' });

        // Act
        const running = await readNotices(vertical, withTrial);
        const none = await readNotices(vertical, withoutTrial);

        // Assert
        expect(running.data).toEqual({ trialRunning: true, items: [] });
        expect(none.data).toEqual({ trialRunning: false, items: [] });
    });

    it('rejects a guest with 401 and never shows another owner its listings', async () => {
        // Arrange
        await ensurePublicationCatalog(vertical);
        const ownerId = await owner();
        const stranger = await owner();
        await listing(vertical, ownerId, PublicationStatusEnum.MODERATED);

        // Act
        const guest = await app.request(`/api/v1/protected/publish/listing-notices/${vertical}`, {
            headers: { 'content-type': 'application/json', 'user-agent': 'vitest' }
        });
        const foreign = await readNotices(vertical, stranger);

        // Assert
        expect(guest.status).toBe(401);
        expect(foreign.status).toBe(200);
        expect(foreign.data?.items).toEqual([]);
    });
});
