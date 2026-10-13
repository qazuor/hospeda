/**
 * What hangs from a listing that reaches PURGED, and from one that stops being
 * published (HOS-1492, AC:V8a:5 and row 35 of AC:V8a:6).
 *
 * Real app and database. PB12 runs through the owner's own route and PB6
 * through the unpublish route; afterwards the tourist's price alert, both
 * inboxes and both reply routes are read back. Only the publication ports are
 * replaced (coverage, clock, post-commit effects), as in the other route
 * suites of this folder. Cleans its own rows in `afterEach`.
 */
import { conversations, getDb, messages, sql, touristPriceAlerts } from '@repo/db';
import { PermissionEnum, PublicationStatusEnum, RoleEnum } from '@repo/schemas';
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
    ensureAccommodationCatalog,
    MATRIX_NOW,
    readResponse,
    resetPublicationControls
} from './publication-routes.helpers';

vi.mock('../../../src/utils/listing-publication/ports', async (importOriginal) => {
    const { buildMatrixPublicationPorts } = await import('./publication-routes.helpers');
    return buildMatrixPublicationPorts(await importOriginal());
});

const { mediaDelete } = vi.hoisted(() => ({ mediaDelete: vi.fn() }));
vi.mock('../../../src/services/media', () => ({
    getMediaProvider: () => ({ delete: mediaDelete })
}));

const app = initApp({ clock: { now: () => MATRIX_NOW } });
const createdUsers: string[] = [];
const createdListings: string[] = [];

/** A user row tracked for cleanup. */
async function user(): Promise<string> {
    const { id } = await createOwner();
    createdUsers.push(id);
    return id;
}

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

/**
 * An owner with a PUBLISHED listing (trial running), a tourist with an active
 * price alert on it, and their conversation holding two messages.
 */
async function arrange() {
    await ensureAccommodationCatalog();
    resetPublicationControls();
    const ownerId = await user();
    const touristId = await user();
    await createTrial({ userId: ownerId, status: 'TRIAL_ACTIVE' });
    const listingId = await createListing({
        ownerId,
        destinationId: await createVerticalDestination(),
        status: PublicationStatusEnum.PUBLISHED
    });
    createdListings.push(listingId);
    const [alert] = await getDb()
        .insert(touristPriceAlerts)
        .values({ userId: touristId, accommodationId: listingId, basePriceSnapshot: 10000 })
        .returning({ id: touristPriceAlerts.id });
    const [conversation] = await getDb()
        .insert(conversations)
        .values({ accommodationId: listingId, userId: touristId, status: 'PENDING_GUEST' })
        .returning({ id: conversations.id });
    if (!alert || !conversation) throw new Error('Fixture insert failed');
    await getDb()
        .insert(messages)
        .values([
            {
                conversationId: conversation.id,
                senderType: 'GUEST',
                userId: touristId,
                body: '¿Está libre en julio?'
            },
            {
                conversationId: conversation.id,
                senderType: 'OWNER',
                userId: ownerId,
                body: 'Sí, está libre.'
            }
        ]);
    return { ownerId, touristId, listingId, alertId: alert.id, conversationId: conversation.id };
}

async function messageCount(conversationId: string): Promise<number> {
    const result = await getDb().execute(
        sql<{
            n: number;
        }>`SELECT count(*)::int AS n FROM messages WHERE conversation_id = ${conversationId}::uuid`
    );
    return Number(result.rows[0]?.n);
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

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
});
afterEach(async () => {
    const users = createdUsers.splice(0);
    const listings = createdListings.splice(0);
    if (listings.length > 0) {
        const ids = sql.param(listings);
        await getDb().execute(
            sql`DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE accommodation_id = ANY(${ids}::uuid[]))`
        );
        await getDb().execute(
            sql`DELETE FROM conversations WHERE accommodation_id = ANY(${ids}::uuid[])`
        );
        await getDb().execute(
            sql`DELETE FROM tourist_price_alerts WHERE accommodation_id = ANY(${ids}::uuid[])`
        );
        await getDb().execute(
            sql`UPDATE accommodations SET deleted_at = now() WHERE id = ANY(${ids}::uuid[]) AND deleted_at IS NULL`
        );
    }
    if (users.length > 0) {
        await getDb().execute(
            sql`DELETE FROM email_outbox WHERE recipient_user_id = ANY(${sql.param(users)}::uuid[])`
        );
    }
});
afterAll(async () => testDb.teardown());

describe('HOS-1492 what hangs from a PURGED listing', () => {
    it('TEST:V8a:6 the alert closes with its email, both inboxes stay whole and read-only', async () => {
        // Arrange
        const fx = await arrange();

        // Act — PB12 through the owner's real route
        const purge = await readResponse(
            await app.request(`/api/v1/protected/accommodations/${fx.listingId}/purge`, {
                method: 'POST',
                headers: ownerHeaders(fx.ownerId)
            })
        );

        // Assert — the purge itself
        expect(purge.status).toBe(200);
        const listingRow = await getDb().execute(
            sql<{
                status: string;
            }>`SELECT publication_status AS status FROM accommodations WHERE id = ${fx.listingId}::uuid`
        );
        expect(listingRow.rows[0]?.status).toBe(PublicationStatusEnum.PURGED);

        // Assert — the alert, re-read by SQL
        const alertRow = await getDb().execute(
            sql<{
                isActive: boolean;
            }>`SELECT is_active AS "isActive" FROM tourist_price_alerts WHERE id = ${fx.alertId}::uuid`
        );
        expect(alertRow.rows[0]?.isActive).toBe(false);
        const outbox = await getDb().execute(
            sql`SELECT id FROM email_outbox WHERE recipient_user_id = ${fx.touristId}::uuid AND template = 'verticals.price-alert-closed'`
        );
        expect(outbox.rows).toHaveLength(1);

        // Assert — the tourist's alert list says the listing is gone
        const alerts = await readResponse(
            await app.request('/api/v1/protected/price-alerts', {
                headers: touristHeaders(fx.touristId)
            })
        );
        expect(alerts.status).toBe(200);
        const items = (alerts.body.data as { items: Array<Record<string, unknown>> }).items;
        const item = items.find((candidate) => candidate.id === fx.alertId);
        expect(item?.isActive).toBe(false);
        expect(item?.closedBecauseListingGone).toBe(true);

        // Assert — both threads whole, saying GONE
        const { tourist, owner } = await threads(fx);
        expect(tourist.status).toBe(200);
        expect(owner.status).toBe(200);
        const touristData = tourist.body.data as {
            messages: unknown[];
            listingAvailability: string;
        };
        const ownerData = owner.body.data as { messages: unknown[]; listingAvailability: string };
        expect(touristData.messages).toHaveLength(2);
        expect(ownerData.messages).toHaveLength(2);
        expect(touristData.listingAvailability).toBe('GONE');
        expect(ownerData.listingAvailability).toBe('GONE');

        // Assert — nobody writes a new message
        const touristReply = await readResponse(
            await reply({
                side: 'tourist',
                actorId: fx.touristId,
                conversationId: fx.conversationId
            })
        );
        const ownerReply = await readResponse(
            await reply({ side: 'owner', actorId: fx.ownerId, conversationId: fx.conversationId })
        );
        expect(touristReply.status).toBe(422);
        expect(touristReply.body.error?.code).toBe('VALIDATION_ERROR');
        expect(ownerReply.status).toBe(422);
        expect(ownerReply.body.error?.code).toBe('VALIDATION_ERROR');
        expect(await messageCount(fx.conversationId)).toBe(2);
    });
});

describe('HOS-1492 row 35: a listing that stopped being published', () => {
    it('TEST:V8a:6 after PB6 the tourist reads NOT_PUBLISHED and cannot write; the owner can', async () => {
        // Arrange
        const fx = await arrange();

        // Act — PB6 through the owner's real route
        const unpublish = await readResponse(
            await app.request(`/api/v1/protected/accommodations/${fx.listingId}/unpublish`, {
                method: 'POST',
                headers: ownerHeaders(fx.ownerId)
            })
        );

        // Assert — the listing is a DRAFT now
        expect(unpublish.status).toBe(201);
        const listingRow = await getDb().execute(
            sql<{
                status: string;
            }>`SELECT publication_status AS status FROM accommodations WHERE id = ${fx.listingId}::uuid`
        );
        expect(listingRow.rows[0]?.status).toBe(PublicationStatusEnum.DRAFT);

        // Assert — the threads
        const { tourist, owner } = await threads(fx);
        expect(tourist.status).toBe(200);
        expect(owner.status).toBe(200);
        const touristData = tourist.body.data as {
            messages: unknown[];
            listingAvailability: string;
        };
        const ownerData = owner.body.data as { messages: unknown[]; listingAvailability: string };
        expect(touristData.messages).toHaveLength(2);
        expect(touristData.listingAvailability).toBe('NOT_PUBLISHED');
        expect(ownerData.listingAvailability).toBe('AVAILABLE');

        // Assert — the tourist cannot write, the owner can
        const touristReply = await readResponse(
            await reply({
                side: 'tourist',
                actorId: fx.touristId,
                conversationId: fx.conversationId
            })
        );
        // The reply route's existing mapping: createMessage's NOT_FOUND (precision 7,
        // it never says why) answers 400.
        expect(touristReply.status).toBe(400);
        expect(touristReply.body.error?.code).toBe('NOT_FOUND');
        expect(await messageCount(fx.conversationId)).toBe(2);
        const ownerReply = await readResponse(
            await reply({ side: 'owner', actorId: fx.ownerId, conversationId: fx.conversationId })
        );
        expect(ownerReply.status).toBe(201);
        const rows = await getDb().execute(
            sql<{
                senderType: string;
                body: string;
            }>`SELECT sender_type AS "senderType", body FROM messages WHERE conversation_id = ${fx.conversationId}::uuid ORDER BY created_at DESC LIMIT 1`
        );
        expect(await messageCount(fx.conversationId)).toBe(3);
        expect(rows.rows[0]?.senderType).toBe('OWNER');
        expect(rows.rows[0]?.body).toBe('Un mensaje nuevo');

        // Assert — the alert is untouched by PB6
        const alertRow = await getDb().execute(
            sql<{
                isActive: boolean;
            }>`SELECT is_active AS "isActive" FROM tourist_price_alerts WHERE id = ${fx.alertId}::uuid`
        );
        expect(alertRow.rows[0]?.isActive).toBe(true);
    });
});
