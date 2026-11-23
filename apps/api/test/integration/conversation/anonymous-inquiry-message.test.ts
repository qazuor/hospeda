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
import { computeInquiryPayloadHash } from '@repo/service-core';
import { SignJWT } from 'jose';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
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

/** Verification emails the route actually dispatched, newest last (HOS-2568 review S2). */
const sentVerificationEmails = vi.hoisted(
    () => [] as Array<{ recipientEmail: string; verificationUrl: string; message?: string }>
);

// The production mailer is absent without an email key; swap in one that records what the
// service really sends, so tests can verify with the link a guest would actually click.
vi.mock('../../../src/lib/conversation-mailer', () => ({
    createConversationMailer: () => ({
        sendVerificationEmail: async (payload: {
            recipientEmail: string;
            verificationUrl: string;
            message?: string;
        }) => {
            sentVerificationEmails.push(payload);
        },
        sendAccessLinkEmail: async () => undefined
    })
}));

/** Token carried by the last verification email sent to `email`. */
function capturedToken(email: string): string {
    const sent = [...sentVerificationEmails].reverse().find((e) => e.recipientEmail === email);
    const token = sent ? new URL(sent.verificationUrl).searchParams.get('token') : null;
    if (!token) throw new Error(`no verification email captured for ${email}`);
    return token;
}

const app = initApp();
const createdListings: string[] = [];
const createdUsers: string[] = [];
const GUEST_NAME = 'Ana Visitante';

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
    readonly guestName?: string;
    readonly checkIn?: string;
    readonly checkOut?: string;
    readonly guests?: number;
}): Promise<{ status: number; conversationId: string; result: string }> {
    const response = await app.request('/api/v1/public/conversations/initiate', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
        body: JSON.stringify({
            accommodationId: args.listingId,
            guestName: args.guestName ?? GUEST_NAME,
            guestEmail: args.email,
            message: args.message,
            checkIn: args.checkIn,
            checkOut: args.checkOut,
            guests: args.guests
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

/**
 * Mints the verification JWT the email would carry. By default it is bound to the payload
 * of `message` (the claim `ConversationService.sendVerificationEmail` signs); pass
 * `payloadHash` to override it (`null` omits the claim) and `expiresIn` to age it.
 */
async function mintToken(args: {
    readonly conversationId: string;
    readonly message?: string;
    readonly guestName?: string;
    readonly checkIn?: string;
    readonly checkOut?: string;
    readonly guests?: number;
    readonly payloadHash?: string | null;
    readonly expiresIn?: string | number;
}): Promise<string> {
    let hash: string | null = null;
    if (args.payloadHash !== undefined) {
        hash = args.payloadHash;
    } else if (args.message !== undefined) {
        hash = computeInquiryPayloadHash({
            payload: {
                message: args.message,
                guestName: args.guestName ?? GUEST_NAME,
                checkIn: args.checkIn,
                checkOut: args.checkOut,
                guests: args.guests
            }
        }).hash;
    }
    return new SignJWT({
        conversationId: args.conversationId,
        ...(hash ? { payloadHash: hash } : {})
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime(args.expiresIn ?? '24h')
        .sign(new TextEncoder().encode(process.env.HOSPEDA_BETTER_AUTH_SECRET));
}

/** Location a verify response redirected to. */
function redirectTarget(response: Response): string {
    return response.headers.get('location') ?? '';
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

        const verified = await verify(
            await mintToken({
                conversationId: created.conversationId,
                message: 'Hola, ¿hay lugar en enero?'
            })
        );
        expect(verified.status).toBe(302);
        expect(redirectTarget(verified)).toContain('/guest/messages/');
        expect(redirectTarget(verified)).not.toContain('verify-expired');

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

    it('binds delivery to the clicked link: attacker text A, then victim text B', async () => {
        const { ownerId, listingId } = await createFixture();
        const email = `victim-${randomUUID()}@example.test`;

        // A stranger types the victim's email with hostile text, then the victim submits
        // their real inquiry: same row, last submission wins.
        const attacker = await initiate({ listingId, email, message: 'TEXTO A (atacante)' });
        const victim = await initiate({ listingId, email, message: 'TEXTO B (victima)' });
        expect(victim.result).toBe('resent');
        expect(victim.conversationId).toBe(attacker.conversationId);
        const id = victim.conversationId;
        expect((await readConversation(id)).pending_message).toBe('TEXTO B (victima)');

        // A's link is stale: nothing delivered, status untouched.
        const stale = await verify(
            await mintToken({ conversationId: id, message: 'TEXTO A (atacante)' })
        );
        expect(redirectTarget(stale)).toContain('verify-expired');
        expect(await readMessages(id)).toHaveLength(0);
        expect((await readConversation(id)).status).toBe('PENDING_VERIFICATION');

        // B's link delivers exactly B.
        const good = await verify(
            await mintToken({ conversationId: id, message: 'TEXTO B (victima)' })
        );
        expect(redirectTarget(good)).not.toContain('verify-expired');
        expect((await readMessages(id)).map((m) => m.body)).toEqual(['TEXTO B (victima)']);

        const thread = await ownerThread({ ownerId, conversationId: id });
        expect(thread.data?.messages?.map((m) => m.body)).toEqual(['TEXTO B (victima)']);
    });

    it('covers the declared name in the binding: changing the name invalidates the old link', async () => {
        const { listingId } = await createFixture();
        const email = `guest-${randomUUID()}@example.test`;
        const first = await initiate({
            listingId,
            email,
            message: 'Mismo texto',
            guestName: 'Nombre Uno'
        });
        await initiate({ listingId, email, message: 'Mismo texto', guestName: 'Nombre Dos' });

        const oldLink = await verify(
            await mintToken({
                conversationId: first.conversationId,
                message: 'Mismo texto',
                guestName: 'Nombre Uno'
            })
        );
        expect(redirectTarget(oldLink)).toContain('verify-expired');
        expect(await readMessages(first.conversationId)).toHaveLength(0);

        const newLink = await verify(
            await mintToken({
                conversationId: first.conversationId,
                message: 'Mismo texto',
                guestName: 'Nombre Dos'
            })
        );
        expect(redirectTarget(newLink)).not.toContain('verify-expired');
        expect(await readMessages(first.conversationId)).toHaveLength(1);
    });

    it('binds dates and guests too: the link only delivers the booking fields it was issued for', async () => {
        const { listingId } = await createFixture();
        const email = `guest-${randomUUID()}@example.test`;
        const first = await initiate({
            listingId,
            email,
            message: 'Mismo texto',
            checkIn: '2027-01-09',
            checkOut: '2027-01-11',
            guests: 2
        });
        await initiate({
            listingId,
            email,
            message: 'Mismo texto',
            checkIn: '2027-02-01',
            checkOut: '2027-02-05',
            guests: 5
        });
        const id = first.conversationId;

        const stale = await verify(
            await mintToken({
                conversationId: id,
                message: 'Mismo texto',
                checkIn: '2027-01-09',
                checkOut: '2027-01-11',
                guests: 2
            })
        );
        expect(redirectTarget(stale)).toContain('verify-expired');
        expect(await readMessages(id)).toHaveLength(0);

        const good = await verify(
            await mintToken({
                conversationId: id,
                message: 'Mismo texto',
                checkIn: '2027-02-01',
                checkOut: '2027-02-05',
                guests: 5
            })
        );
        expect(redirectTarget(good)).not.toContain('verify-expired');
        const row = await getDb().execute(
            sql`SELECT check_in::text AS check_in, check_out::text AS check_out, guests FROM conversations WHERE id = ${id}::uuid`
        );
        expect(row.rows[0]).toEqual({
            check_in: '2027-02-01',
            check_out: '2027-02-05',
            guests: 5
        });
    });

    it('rejects a token with a tampered hash or with no hash claim while a message is held', async () => {
        const { listingId } = await createFixture();
        const created = await initiate({
            listingId,
            email: `guest-${randomUUID()}@example.test`,
            message: 'Consulta real'
        });

        for (const payloadHash of ['f'.repeat(64), null]) {
            const response = await verify(
                await mintToken({ conversationId: created.conversationId, payloadHash })
            );
            expect(redirectTarget(response)).toContain('verify-expired');
        }

        expect(await readMessages(created.conversationId)).toHaveLength(0);
        const row = await readConversation(created.conversationId);
        expect(row.status).toBe('PENDING_VERIFICATION');
        expect(row.pending_message).toBe('Consulta real');
    });

    it('verifying twice in sequence does not duplicate the message or the counters', async () => {
        const { listingId } = await createFixture();
        const created = await initiate({
            listingId,
            email: `guest-${randomUUID()}@example.test`,
            message: 'Una sola vez'
        });
        const token = await mintToken({
            conversationId: created.conversationId,
            message: 'Una sola vez'
        });

        const first = await verify(token);
        const second = await verify(token);

        expect(redirectTarget(first)).not.toContain('verify-expired');
        expect(redirectTarget(second)).not.toContain('verify-expired');
        expect(await readMessages(created.conversationId)).toHaveLength(1);
        expect((await readConversation(created.conversationId)).guest_message_count).toBe(1);
    });

    it('concurrent verifications from a fresh pending row insert exactly one message', async () => {
        const { listingId } = await createFixture();
        const created = await initiate({
            listingId,
            email: `guest-${randomUUID()}@example.test`,
            message: 'Carrera de verificaciones'
        });
        expect((await readConversation(created.conversationId)).status).toBe(
            'PENDING_VERIFICATION'
        );
        const token = await mintToken({
            conversationId: created.conversationId,
            message: 'Carrera de verificaciones'
        });

        const responses = await Promise.all(Array.from({ length: 6 }, () => verify(token)));

        for (const response of responses) {
            expect(redirectTarget(response)).not.toContain('verify-expired');
        }
        expect(await readMessages(created.conversationId)).toHaveLength(1);
        const row = await readConversation(created.conversationId);
        expect(row.status).toBe('PENDING_OWNER');
        expect(row.guest_message_count).toBe(1);
    });

    it('round trip: the link the mailer really sent verifies and delivers (producer to DB to hash)', async () => {
        const { ownerId, listingId } = await createFixture();
        const email = `guest-${randomUUID()}@example.test`;
        const message = 'Consulta de punta a punta';

        const created = await initiate({
            listingId,
            email,
            message,
            guestName: 'Ana Round',
            checkIn: '2027-03-01',
            checkOut: '2027-03-04',
            guests: 3
        });
        const response = await verify(capturedToken(email));

        expect(redirectTarget(response)).not.toContain('verify-expired');
        const thread = await ownerThread({ ownerId, conversationId: created.conversationId });
        expect(thread.data?.messages?.map((m) => m.body)).toEqual([message]);
    });

    it('round trip with a re-submit: only the newest emailed link delivers', async () => {
        const { listingId } = await createFixture();
        const email = `guest-${randomUUID()}@example.test`;

        const first = await initiate({ listingId, email, message: 'Texto uno' });
        const olderToken = capturedToken(email);
        await initiate({ listingId, email, message: 'Texto dos' });
        const newerToken = capturedToken(email);
        expect(newerToken).not.toBe(olderToken);

        const older = await verify(olderToken);
        expect(redirectTarget(older)).toContain('verify-expired');
        expect(await readMessages(first.conversationId)).toHaveLength(0);

        const newer = await verify(newerToken);
        expect(redirectTarget(newer)).not.toContain('verify-expired');
        expect((await readMessages(first.conversationId)).map((m) => m.body)).toEqual([
            'Texto dos'
        ]);
    });

    it('a NUL character in the text is dropped instead of failing with a 500', async () => {
        const { listingId } = await createFixture();
        const email = `guest-${randomUUID()}@example.test`;

        const created = await initiate({ listingId, email, message: 'hola\u0000 mundo' });

        expect(created.status).toBe(200);
        expect((await readConversation(created.conversationId)).pending_message).toBe('hola mundo');
        const response = await verify(capturedToken(email));
        expect(redirectTarget(response)).not.toContain('verify-expired');
        expect((await readMessages(created.conversationId)).map((m) => m.body)).toEqual([
            'hola mundo'
        ]);
    });

    it('an expired token neither verifies nor delivers the message', async () => {
        const { listingId } = await createFixture();
        const created = await initiate({
            listingId,
            email: `guest-${randomUUID()}@example.test`,
            message: 'No debe salir'
        });
        const expired = await mintToken({
            conversationId: created.conversationId,
            message: 'No debe salir',
            expiresIn: Math.floor(Date.now() / 1000) - 60
        });

        await verify(expired);

        expect(await readMessages(created.conversationId)).toHaveLength(0);
        const row = await readConversation(created.conversationId);
        expect(row.status).toBe('PENDING_VERIFICATION');
        expect(row.pending_message).toBe('No debe salir');
    });
});
