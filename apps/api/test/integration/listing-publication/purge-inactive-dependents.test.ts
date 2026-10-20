/**
 * TEST:V9b:4 — AC:V9b:4, dependents of a listing purged by PB9 (HOS-1503).
 * Uses PB9's production unit of work and real read routes, then removes only
 * the rows created here in `afterEach`.
 */
import { randomUUID } from 'node:crypto';
import {
    conversations,
    fixRequests,
    getDb,
    messages,
    sql,
    touristPriceAlerts,
    userBookmarks
} from '@repo/db';
import { PermissionEnum, PublicationStatusEnum, RoleEnum, VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { purgeInactiveListing } from '../../../../../packages/verticals/src/publication/purge-inactive-listing';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { getListingPublicationPorts } from '../../../src/utils/listing-publication/ports';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    createListing,
    createOwner,
    createVerticalDestination,
    ensureAccommodationCatalog,
    MATRIX_NOW,
    readResponse
} from './publication-routes.helpers';

const DAY = 86_400_000;
const app = initApp({ clock: { now: () => MATRIX_NOW } });
const createdUsers: string[] = [];
const createdListings: string[] = [];

function ownerHeaders(id: string) {
    return actorHeaders({
        id,
        permissions: [
            PermissionEnum.ACCOMMODATION_UPDATE_OWN,
            PermissionEnum.CONVERSATION_VIEW_OWN,
            PermissionEnum.CONVERSATION_REPLY_OWN
        ]
    });
}

function touristHeaders(id: string) {
    return actorHeaders({ id, role: RoleEnum.USER, permissions: [] });
}

async function threads(args: {
    readonly ownerId: string;
    readonly touristId: string;
    readonly conversationId: string;
}) {
    const tourist = await readResponse(
        await app.request(`/api/v1/protected/conversations/${args.conversationId}`, {
            headers: touristHeaders(args.touristId)
        })
    );
    const owner = await readResponse(
        await app.request(`/api/v1/protected/conversations/owner/${args.conversationId}`, {
            headers: ownerHeaders(args.ownerId)
        })
    );
    return { tourist, owner };
}

function reply(args: {
    readonly side: 'tourist' | 'owner';
    readonly actorId: string;
    readonly conversationId: string;
}) {
    const path =
        args.side === 'owner'
            ? `/api/v1/protected/conversations/owner/${args.conversationId}/messages`
            : `/api/v1/protected/conversations/${args.conversationId}/messages`;
    return app.request(path, {
        method: 'POST',
        headers: args.side === 'owner' ? ownerHeaders(args.actorId) : touristHeaders(args.actorId),
        body: JSON.stringify({ body: 'Un mensaje nuevo' })
    });
}

async function messageCount(conversationId: string): Promise<number> {
    const result = await getDb().execute(
        sql<{
            n: number;
        }>`SELECT count(*)::int AS n FROM messages WHERE conversation_id = ${conversationId}::uuid`
    );
    return Number(result.rows[0]?.n);
}

async function createUser(): Promise<string> {
    const { id } = await createOwner();
    createdUsers.push(id);
    return id;
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    const trigger = await getDb().execute(sql`
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_softdelete_bookmarks_on_accommodations'
    `);
    expect(
        trigger.rows,
        'expected bookmark soft-delete trigger in the integration database'
    ).toHaveLength(1);
});

afterEach(async () => {
    const users = createdUsers.splice(0);
    const listings = createdListings.splice(0);
    if (listings.length > 0) {
        const ids = sql.param(listings);
        await getDb().execute(sql`DELETE FROM messages WHERE conversation_id IN
            (SELECT id FROM conversations WHERE accommodation_id = ANY(${ids}::uuid[]))`);
        await getDb().execute(
            sql`DELETE FROM conversations WHERE accommodation_id = ANY(${ids}::uuid[])`
        );
        await getDb().execute(
            sql`DELETE FROM tourist_price_alerts WHERE accommodation_id = ANY(${ids}::uuid[])`
        );
        await getDb()
            .delete(userBookmarks)
            .where(sql`${userBookmarks.entityId} = ANY(${ids}::uuid[])`);
        await getDb().execute(sql`DELETE FROM fix_request
            WHERE entity_type = 'accommodation' AND entity_id = ANY(${ids}::uuid[])`);
        await getDb().execute(sql`DELETE FROM owner_promotions
            WHERE accommodation_id = ANY(${ids}::uuid[])`);
        await getDb().execute(sql`DELETE FROM accommodation_external_listings
            WHERE accommodation_id = ANY(${ids}::uuid[])`);
        await getDb().execute(sql`DELETE FROM accommodation_occupancy
            WHERE accommodation_id = ANY(${ids}::uuid[])`);
        await getDb().execute(sql`DELETE FROM accommodation_ia_data
            WHERE accommodation_id = ANY(${ids}::uuid[])`);
        await getDb().execute(sql`DELETE FROM qr_codes
            WHERE entity_type = 'ACCOMMODATION' AND entity_id = ANY(${ids}::uuid[])`);
        await getDb().execute(sql`DELETE FROM entity_view_monthly_rollups
            WHERE entity_type = 'ACCOMMODATION' AND entity_id = ANY(${ids}::uuid[])`);
        await getDb().execute(sql`UPDATE accommodations SET deleted_at = now()
            WHERE id = ANY(${ids}::uuid[]) AND deleted_at IS NULL`);
    }
    if (users.length > 0) {
        await getDb().execute(
            sql`DELETE FROM email_outbox WHERE recipient_user_id = ANY(${sql.param(users)}::uuid[])`
        );
    }
});
afterAll(async () => testDb.teardown());

describe('HOS-1503 PB9 dependents', () => {
    it('TEST:V9b:4 AC:V9b:4 closes listing-owned dependents and preserves tourist/owner data', async () => {
        await ensureAccommodationCatalog();
        const ownerId = await createUser();
        const touristId = await createUser();
        const adminId = await createUser();
        const destinationId = await createVerticalDestination();
        const listingId = await createListing({
            ownerId,
            destinationId,
            status: PublicationStatusEnum.ARCHIVED,
            complete: false
        });
        const otherListingId = await createListing({
            ownerId,
            destinationId,
            status: PublicationStatusEnum.PUBLISHED,
            complete: false
        });
        createdListings.push(listingId, otherListingId);

        await getDb().execute(sql`UPDATE accommodations SET
            inactive_since = ${new Date(MATRIX_NOW.getTime() - 200 * DAY)},
            deadlines_version = 1,
            deletion_announced_at = ${new Date(MATRIX_NOW.getTime() - DAY)}
            WHERE id = ${listingId}::uuid`);

        const [alert] = await getDb()
            .insert(touristPriceAlerts)
            .values({
                userId: touristId,
                accommodationId: listingId,
                basePriceSnapshot: 10000
            })
            .returning({ id: touristPriceAlerts.id });
        const [conversation] = await getDb()
            .insert(conversations)
            .values({
                accommodationId: listingId,
                userId: touristId,
                status: 'PENDING_GUEST'
            })
            .returning({ id: conversations.id });
        const [bookmark] = await getDb()
            .insert(userBookmarks)
            .values({
                userId: touristId,
                entityType: 'ACCOMMODATION',
                entityId: listingId
            })
            .returning({ id: userBookmarks.id });
        const [fixRequest] = await getDb()
            .insert(fixRequests)
            .values({
                entityType: VerticalEnum.ACCOMMODATION,
                entityId: listingId,
                reason: 'fixture HOS-1503',
                openedById: adminId
            })
            .returning({ id: fixRequests.id });
        if (!alert || !conversation || !bookmark || !fixRequest)
            throw new Error('Fixture insert failed');
        await getDb()
            .insert(messages)
            .values([
                {
                    conversationId: conversation.id,
                    senderType: 'GUEST',
                    userId: touristId,
                    body: 'Consulta'
                },
                {
                    conversationId: conversation.id,
                    senderType: 'OWNER',
                    userId: ownerId,
                    body: 'Respuesta'
                }
            ]);

        const entityType = 'ACCOMMODATION';
        await getDb().execute(sql`INSERT INTO owner_promotions
            (slug, owner_id, accommodation_id, title, discount_type, discount_value, valid_from)
            VALUES (${`v9b4-${listingId}`}, ${ownerId}, ${listingId}, 'fixture', 'percentage', 10, now())`);
        await getDb().execute(sql`INSERT INTO owner_promotions
            (slug, owner_id, accommodation_id, title, discount_type, discount_value, valid_from)
            VALUES (${`v9b4-${otherListingId}`}, ${ownerId}, ${otherListingId}, 'witness', 'percentage', 10, now())`);
        await getDb().execute(sql`INSERT INTO accommodation_external_listings
            (accommodation_id, platform, url) VALUES (${listingId}, 'GOOGLE', 'https://example.test')`);
        await getDb().execute(sql`INSERT INTO accommodation_occupancy
            (accommodation_id, date, source, created_by_id) VALUES (${listingId}, '2026-10-13', 'MANUAL', ${ownerId})`);
        await getDb().execute(sql`INSERT INTO accommodation_ia_data
            (accommodation_id, title, content) VALUES (${listingId}, 'fixture', 'fixture')`);
        await getDb().execute(sql`INSERT INTO qr_codes
            (slug, target_url, label, source, entity_type, entity_id, render_options)
            VALUES (${`v9b4-${listingId}`}, 'https://example.test', 'fixture', 'GENERATED', ${entityType}, ${listingId}, '{}'::jsonb)`);
        await getDb().execute(sql`INSERT INTO entity_view_monthly_rollups
            (entity_type, entity_id, month, total, unique_visitors)
            VALUES (${entityType}, ${listingId}, '2026-10-01', 1, 1)`);

        const bookmarkBefore = await getDb()
            .select()
            .from(userBookmarks)
            .where(sql`${userBookmarks.id} = ${bookmark.id}::uuid`);
        const conversationBefore = await getDb().execute(
            sql`SELECT * FROM conversations WHERE id = ${conversation.id}::uuid`
        );
        const fixBefore = await getDb().execute(
            sql`SELECT * FROM fix_request WHERE id = ${fixRequest.id}::uuid`
        );
        const otherPromotionBefore = await getDb().execute(
            sql`SELECT * FROM owner_promotions WHERE accommodation_id = ${otherListingId}::uuid`
        );
        const revalidationBefore = await getDb().execute(
            sql`SELECT * FROM revalidation_config ORDER BY entity_type`
        );
        const ownerOutboxBefore = await getDb().execute(
            sql`SELECT count(*)::int AS n FROM email_outbox WHERE recipient_user_id = ${ownerId}::uuid`
        );

        const emitListingPurged = vi.fn(async (_args: { listingId: string }) => undefined);
        const deleteRemoteMedia = vi.fn(
            async (_args: {
                vertical: typeof VerticalEnum.ACCOMMODATION;
                mediaId: string;
                publicId: string | null;
            }) => undefined
        );
        const revokeCalendarConnection = vi.fn(
            async (_args: { connectionId: string; accommodationId: string; provider: string }) =>
                undefined
        );
        const result = await purgeInactiveListing({
            ...getListingPublicationPorts(),
            billing: {
                coverage: async () => ({ covered: false, sources: [] }),
                retentionStopped: async () => ({
                    stopped: false,
                    pauseEndedAt: null,
                    coverageLostAt: null
                })
            },
            clock: { now: () => MATRIX_NOW },
            previousPassStartedAt: MATRIX_NOW, // This is the later pass, not the first pass.
            vertical: VerticalEnum.ACCOMMODATION,
            listingId,
            ownerId,
            correlationId: randomUUID(),
            afterCommit: { emitListingPurged, deleteRemoteMedia, revokeCalendarConnection }
        });
        expect(result).toMatchObject({ purged: true, closedAlerts: 1, warnings: [] });

        const conversationAfterPurge = await getDb().execute(
            sql`SELECT * FROM conversations WHERE id = ${conversation.id}::uuid`
        );
        expect(conversationAfterPurge.rows).toEqual(conversationBefore.rows);
        expect((conversationAfterPurge.rows[0] as Record<string, unknown>).accommodation_id).toBe(
            listingId
        );

        const alertRow = await getDb().execute(
            sql`SELECT is_active FROM tourist_price_alerts WHERE id = ${alert.id}::uuid`
        );
        expect(alertRow.rows[0]?.is_active).toBe(false);
        const alertMail = await getDb().execute(sql`SELECT id FROM email_outbox
            WHERE recipient_user_id = ${touristId}::uuid AND template = 'verticals.price-alert-closed'`);
        expect(alertMail.rows).toHaveLength(1);
        const alerts = await readResponse(
            await app.request('/api/v1/protected/price-alerts', {
                headers: touristHeaders(touristId)
            })
        );
        expect(alerts.status).toBe(200);
        const alertItem = (
            alerts.body.data as { items: Array<Record<string, unknown>> }
        ).items.find((item) => item.id === alert.id);
        expect(alertItem).toMatchObject({ isActive: false, closedBecauseListingGone: true });

        const { tourist, owner } = await threads({
            ownerId,
            touristId,
            conversationId: conversation.id
        });
        expect(tourist.status).toBe(200);
        expect(owner.status).toBe(200);
        for (const response of [tourist, owner]) {
            expect(response.body.data).toMatchObject({
                messages: expect.any(Array),
                listingAvailability: 'GONE'
            });
            expect((response.body.data as { messages: unknown[] }).messages).toHaveLength(2);
        }
        for (const side of ['tourist', 'owner'] as const) {
            const rejected = await readResponse(
                await reply({
                    side,
                    actorId: side === 'tourist' ? touristId : ownerId,
                    conversationId: conversation.id
                })
            );
            expect(rejected.status).toBe(422);
            expect(rejected.body.error?.code).toBe('VALIDATION_ERROR');
        }
        expect(await messageCount(conversation.id)).toBe(2);

        for (const [table, column, predicate] of [
            ['owner_promotions', 'accommodation_id', sql`accommodation_id = ${listingId}::uuid`],
            [
                'accommodation_external_listings',
                'accommodation_id',
                sql`accommodation_id = ${listingId}::uuid`
            ],
            [
                'accommodation_occupancy',
                'accommodation_id',
                sql`accommodation_id = ${listingId}::uuid`
            ],
            [
                'accommodation_ia_data',
                'accommodation_id',
                sql`accommodation_id = ${listingId}::uuid`
            ],
            [
                'qr_codes',
                'entity_id',
                sql`entity_type = 'ACCOMMODATION' AND entity_id = ${listingId}::uuid`
            ],
            [
                'entity_view_monthly_rollups',
                'entity_id',
                sql`entity_type = 'ACCOMMODATION' AND entity_id = ${listingId}::uuid`
            ]
        ] as const) {
            void column;
            const count = await getDb().execute(
                sql`SELECT count(*)::int AS n FROM ${sql.identifier(table)} WHERE ${predicate}`
            );
            expect(Number(count.rows[0]?.n), `${table} rows for purged listing`).toBe(0);
        }
        const otherPromotionAfter = await getDb().execute(
            sql`SELECT * FROM owner_promotions WHERE accommodation_id = ${otherListingId}::uuid`
        );
        expect(otherPromotionAfter.rows).toEqual(otherPromotionBefore.rows);

        const listing = await getDb().execute(
            sql`SELECT publication_status, deleted_at FROM accommodations WHERE id = ${listingId}::uuid`
        );
        expect(listing.rows[0]).toEqual({ publication_status: 'PURGED', deleted_at: null });
        const bookmarkAfter = await getDb()
            .select()
            .from(userBookmarks)
            .where(sql`${userBookmarks.id} = ${bookmark.id}::uuid`);
        expect(bookmarkAfter).toEqual(bookmarkBefore);

        const fixAfter = await getDb().execute(
            sql`SELECT * FROM fix_request WHERE id = ${fixRequest.id}::uuid`
        );
        expect(fixAfter.rows).toHaveLength(1);
        const {
            closed_at: closedAt,
            closed_by_id: closedById,
            ...fixRest
        } = fixAfter.rows[0] as Record<string, unknown>;
        const {
            closed_at: _beforeClosedAt,
            closed_by_id: _beforeClosedById,
            updated_at: _beforeUpdatedAt,
            ...fixBeforeRest
        } = fixBefore.rows[0] as Record<string, unknown>;
        const { updated_at: updatedAt, ...fixAfterRest } = fixRest;
        expect(new Date(String(closedAt))).toEqual(MATRIX_NOW);
        expect(closedById).toBeNull();
        expect(fixAfterRest).toEqual(fixBeforeRest);
        // Trigger 002 sets updated_at = NOW() for every UPDATE, including this legitimate closure.
        expect(updatedAt).not.toBeNull();
        expect(new Date(String(updatedAt)).getTime()).toBeGreaterThanOrEqual(
            new Date(String(_beforeUpdatedAt)).getTime()
        );
        expect(new Date(String(updatedAt)).getTime()).not.toBe(
            new Date(String(_beforeUpdatedAt)).getTime()
        );
        const ownerOutboxAfter = await getDb().execute(
            sql`SELECT count(*)::int AS n FROM email_outbox WHERE recipient_user_id = ${ownerId}::uuid`
        );
        expect(ownerOutboxAfter.rows[0]?.n).toBe(ownerOutboxBefore.rows[0]?.n);
        const fixEvents = await getDb().execute(sql`SELECT id FROM domain_event
            WHERE event_type = 'listing.fix_request_closed' AND entity_id = ${listingId}`);
        expect(fixEvents.rows).toHaveLength(0);

        const revalidationAfter = await getDb().execute(
            sql`SELECT * FROM revalidation_config ORDER BY entity_type`
        );
        expect(revalidationAfter.rows).toEqual(revalidationBefore.rows);
        expect(emitListingPurged).toHaveBeenCalledTimes(1);
        expect(emitListingPurged).toHaveBeenCalledWith({ listingId });
        expect(deleteRemoteMedia).not.toHaveBeenCalled();
        expect(revokeCalendarConnection).not.toHaveBeenCalled();
    });
});
