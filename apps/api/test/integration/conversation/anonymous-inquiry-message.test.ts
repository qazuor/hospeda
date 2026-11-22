/**
 * HOS-2568: an anonymous guest's inquiry text must reach the host.
 *
 * Drives the real public routes (`POST /public/conversations/initiate` and
 * `GET /public/conversations/verify/:token`) against the real database and reads the
 * owner thread back. Before the fix `initiateAnonymous` dropped `message` and
 * `verifyEmailToken` inserted no message, so the host got an empty conversation.
 *
 * The verification email is not sent in tests (no mailer configured), so the JWT the
 * email would carry is minted here with the same secret and claims the service uses.
 */
import { randomUUID } from 'node:crypto';
import { getDb, sql } from '@repo/db';
import { PermissionEnum, PublicationStatusEnum } from '@repo/schemas';
import { SignJWT } from 'jose';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    createListing,
    createOwner,
    createVerticalDestination,
    ensureAccommodationCatalog
} from '../listing-publication/publication-routes.helpers';

const app = initApp();
const createdListings: string[] = [];
const createdUsers: string[] = [];

interface ConversationRow {
    readonly status: string;
    readonly pending_message: string | null;
    readonly guest_message_count: number;
    readonly first_guest_message_at: Date | null;
    readonly last_guest_message_at: Date | null;
    readonly last_activity_at: Date | null;
}

/** Fixture: an owner and one published listing. */
async function createFixture(): Promise<{ ownerId: string; listingId: string }> {
    await ensureAccommodationCatalog();
    const { id: ownerId } = await createOwner();
    createdUsers.push(ownerId);
    const destinationId = await createVerticalDestination();
    const listingId = await createListing({
        ownerId,
        destinationId,
        status: PublicationStatusEnum.PUBLISHED
    });
    createdListings.push(listingId);
    return { ownerId, listingId };
}

/** POSTs an anonymous inquiry through the public route. */
async function initiate(args: {
    readonly listingId: string;
    readonly email: string;
    readonly message: string;
}): Promise<{ status: number; conversationId: string; result: string }> {
    const response = await app.request('/api/v1/public/conversations/initiate', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
        body: JSON.stringify({
            accommodationId: args.listingId,
            guestName: 'Ana Visitante',
            guestEmail: args.email,
            message: args.message
        })
    });
    const body = (await response.json()) as {
        data?: { status?: string; conversationId?: string };
    };
    return {
        status: response.status,
        conversationId: body.data?.conversationId ?? '',
        result: body.data?.status ?? ''
    };
}

/** Mints the verification JWT the email would carry. */
async function mintToken(args: {
    readonly conversationId: string;
    readonly expiresIn?: string;
}): Promise<string> {
    return new SignJWT({ conversationId: args.conversationId })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime(args.expiresIn ?? '24h')
        .sign(new TextEncoder().encode(process.env.HOSPEDA_BETTER_AUTH_SECRET));
}

/** Calls the verify route with a token. */
async function verify(token: string): Promise<Response> {
    return app.request(`/api/v1/public/conversations/verify/${token}`, {
        headers: { 'user-agent': 'vitest' }
    });
}

async function readConversation(conversationId: string): Promise<ConversationRow> {
    const result = await getDb().execute(sql<ConversationRow>`
        SELECT status, pending_message, guest_message_count, first_guest_message_at,
               last_guest_message_at, last_activity_at
        FROM conversations WHERE id = ${conversationId}::uuid`);
    return result.rows[0] as unknown as ConversationRow;
}

async function readMessages(conversationId: string): Promise<
    ReadonlyArray<{
        readonly body: string;
        readonly sender_type: string;
        readonly user_id: string | null;
    }>
> {
    const result = await getDb().execute(sql`
        SELECT body, sender_type, user_id FROM messages
        WHERE conversation_id = ${conversationId}::uuid ORDER BY created_at`);
    return result.rows as unknown as ReadonlyArray<{
        body: string;
        sender_type: string;
        user_id: string | null;
    }>;
}

/** Reads the thread the way the host does. */
async function ownerThread(args: { readonly ownerId: string; readonly conversationId: string }) {
    const response = await app.request(
        `/api/v1/protected/conversations/owner/${args.conversationId}`,
        {
            headers: actorHeaders({
                id: args.ownerId,
                permissions: [
                    PermissionEnum.CONVERSATION_VIEW_OWN,
                    PermissionEnum.CONVERSATION_REPLY_OWN
                ]
            })
        }
    );
    const body = (await response.json()) as {
        data?: {
            conversation?: Record<string, unknown>;
            messages?: ReadonlyArray<{ body: string; senderType: string }>;
        };
    };
    return { status: response.status, data: body.data };
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
});

afterEach(async () => {
    const listings = createdListings.splice(0);
    const users = createdUsers.splice(0);
    if (listings.length > 0) {
        const ids = sql.param(listings);
        await getDb().execute(sql`DELETE FROM conversation_notification_schedules WHERE conversation_id IN
            (SELECT id FROM conversations WHERE accommodation_id = ANY(${ids}::uuid[]))`);
        await getDb().execute(sql`DELETE FROM conversation_access_tokens WHERE conversation_id IN
            (SELECT id FROM conversations WHERE accommodation_id = ANY(${ids}::uuid[]))`);
        await getDb().execute(sql`DELETE FROM messages WHERE conversation_id IN
            (SELECT id FROM conversations WHERE accommodation_id = ANY(${ids}::uuid[]))`);
        await getDb().execute(
            sql`DELETE FROM conversations WHERE accommodation_id = ANY(${ids}::uuid[])`
        );
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

describe('HOS-2568 anonymous inquiry message', () => {
    it('delivers the original message to the host after the email is verified', async () => {
        const { ownerId, listingId } = await createFixture();
        const email = `guest-${randomUUID()}@example.test`;

        const created = await initiate({ listingId, email, message: 'Hola, ¿hay lugar en enero?' });
        expect(created.status).toBe(200);
        expect(created.result).toBe('pending_verification');

        // Held, not visible: no message row, none of the counters set.
        expect(await readMessages(created.conversationId)).toHaveLength(0);
        const pending = await readConversation(created.conversationId);
        expect(pending.status).toBe('PENDING_VERIFICATION');
        expect(pending.pending_message).toBe('Hola, ¿hay lugar en enero?');
        expect(pending.guest_message_count).toBe(0);

        const verified = await verify(await mintToken({ conversationId: created.conversationId }));
        expect(verified.status).toBe(302);

        const row = await readConversation(created.conversationId);
        expect(row.status).toBe('PENDING_OWNER');
        expect(row.pending_message).toBeNull();
        expect(row.guest_message_count).toBe(1);
        expect(row.first_guest_message_at).not.toBeNull();
        expect(row.last_guest_message_at).not.toBeNull();
        expect(row.last_activity_at).not.toBeNull();

        const stored = await readMessages(created.conversationId);
        expect(stored).toEqual([
            { body: 'Hola, ¿hay lugar en enero?', sender_type: 'GUEST', user_id: null }
        ]);

        const thread = await ownerThread({ ownerId, conversationId: created.conversationId });
        expect(thread.status).toBe(200);
        expect(thread.data?.messages?.map((m) => [m.senderType, m.body])).toEqual([
            ['GUEST', 'Hola, ¿hay lugar en enero?']
        ]);
        expect(thread.data?.conversation).not.toHaveProperty('pendingMessage');
    });

    it('first submission wins: a re-submit with other text keeps the original', async () => {
        const { listingId } = await createFixture();
        const email = `guest-${randomUUID()}@example.test`;

        const first = await initiate({ listingId, email, message: 'Consulta original' });
        const second = await initiate({
            listingId,
            email,
            message: 'Texto escrito por otra persona'
        });
        expect(second.result).toBe('resent');
        expect(second.conversationId).toBe(first.conversationId);

        expect((await readConversation(first.conversationId)).pending_message).toBe(
            'Consulta original'
        );

        await verify(await mintToken({ conversationId: first.conversationId }));
        expect((await readMessages(first.conversationId)).map((m) => m.body)).toEqual([
            'Consulta original'
        ]);
    });

    it('verifying twice does not duplicate the message or the counters', async () => {
        const { listingId } = await createFixture();
        const created = await initiate({
            listingId,
            email: `guest-${randomUUID()}@example.test`,
            message: 'Una sola vez'
        });
        const token = await mintToken({ conversationId: created.conversationId });

        await verify(token);
        await verify(token);
        await Promise.all([verify(token), verify(token)]);

        expect(await readMessages(created.conversationId)).toHaveLength(1);
        expect((await readConversation(created.conversationId)).guest_message_count).toBe(1);
    });

    it('an expired token neither verifies nor delivers the message', async () => {
        const { listingId } = await createFixture();
        const created = await initiate({
            listingId,
            email: `guest-${randomUUID()}@example.test`,
            message: 'No debe salir'
        });
        const expired = await new SignJWT({ conversationId: created.conversationId })
            .setProtectedHeader({ alg: 'HS256' })
            .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
            .sign(new TextEncoder().encode(process.env.HOSPEDA_BETTER_AUTH_SECRET));

        await verify(expired);

        expect(await readMessages(created.conversationId)).toHaveLength(0);
        const row = await readConversation(created.conversationId);
        expect(row.status).toBe('PENDING_VERIFICATION');
        expect(row.pending_message).toBe('No debe salir');
    });
});
