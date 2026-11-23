/**
 * HOS-2571: anonymous inquiries left in PENDING_VERIFICATION for more than 7 days are
 * hard-deleted, verified conversations never are, and the link of a deleted row lands on
 * the expired-link page. Runs against the real database through the real public routes.
 */
import { randomUUID } from 'node:crypto';
import { getDb, sql } from '@repo/db';
import { PublicationStatusEnum } from '@repo/schemas';
import { computeInquiryPayloadHash, purgeUnverifiedInquiries } from '@repo/service-core';
import { SignJWT } from 'jose';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    createListing,
    createOwner,
    createVerticalDestination,
    ensureAccommodationCatalog
} from '../listing-publication/publication-routes.helpers';

const app = initApp();
const createdListings: string[] = [];
const createdUsers: string[] = [];
const GUEST_NAME = 'Ana Visitante';

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

/** Current status of a conversation. */
async function readStatus(id: string): Promise<string> {
    const result = await getDb().execute(
        sql`SELECT status FROM conversations WHERE id = ${id}::uuid`
    );
    return (result.rows[0] as unknown as { status: string }).status;
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

/** Moves a conversation's creation date `days` into the past. */
async function backdate(args: { readonly id: string; readonly days: number }): Promise<void> {
    await getDb().execute(
        sql`UPDATE conversations SET created_at = now() - make_interval(days => ${args.days}) WHERE id = ${args.id}::uuid`
    );
}

/** Whether the conversation row still exists. */
async function exists(id: string): Promise<boolean> {
    const result = await getDb().execute(sql`SELECT 1 FROM conversations WHERE id = ${id}::uuid`);
    return result.rows.length === 1;
}

/** Counts rows of a dependent table for a conversation. */
async function countDependents(args: {
    readonly table: 'messages' | 'conversation_access_tokens';
    readonly id: string;
}): Promise<number> {
    const result = await getDb().execute(
        sql`SELECT count(*)::int AS n FROM ${sql.identifier(args.table)} WHERE conversation_id = ${args.id}::uuid`
    );
    return (result.rows[0] as unknown as { n: number }).n;
}

describe('HOS-2571 unverified inquiry cleanup', () => {
    it('deletes an 8-day-old PENDING_VERIFICATION row, keeps a 6-day-old one and an old verified one', async () => {
        const { listingId } = await createFixture();
        const old = await initiate({
            listingId,
            email: `old-${randomUUID()}@example.test`,
            message: 'Texto viejo sin verificar'
        });
        const recent = await initiate({
            listingId,
            email: `recent-${randomUUID()}@example.test`,
            message: 'Texto reciente sin verificar'
        });
        const verifiedMessage = 'Texto verificado';
        const verifiedInquiry = await initiate({
            listingId,
            email: `verified-${randomUUID()}@example.test`,
            message: verifiedMessage
        });
        const verified = await verify(
            await mintToken({
                conversationId: verifiedInquiry.conversationId,
                message: verifiedMessage
            })
        );
        expect(redirectTarget(verified)).not.toContain('verify-expired');
        expect(await readStatus(verifiedInquiry.conversationId)).toBe('PENDING_OWNER');

        // Dependent rows on the doomed conversation must not block the delete (FK cascade).
        await getDb().execute(sql`INSERT INTO messages (conversation_id, sender_type, body)
            VALUES (${old.conversationId}::uuid, 'GUEST', 'dependiente')`);
        await getDb().execute(sql`INSERT INTO conversation_access_tokens
            (conversation_id, token_hash, expires_at)
            VALUES (${old.conversationId}::uuid, ${randomUUID().replaceAll('-', '')}, now() + interval '1 day')`);

        await backdate({ id: old.conversationId, days: 8 });
        await backdate({ id: recent.conversationId, days: 6 });
        await backdate({ id: verifiedInquiry.conversationId, days: 30 });

        const { deleted } = await purgeUnverifiedInquiries({ clock: { now: () => new Date() } });

        expect(deleted).toBeGreaterThanOrEqual(1);
        expect(await exists(old.conversationId)).toBe(false);
        expect(await countDependents({ table: 'messages', id: old.conversationId })).toBe(0);
        expect(
            await countDependents({ table: 'conversation_access_tokens', id: old.conversationId })
        ).toBe(0);
        expect(await exists(recent.conversationId)).toBe(true);
        expect(await readStatus(recent.conversationId)).toBe('PENDING_VERIFICATION');
        expect(await exists(verifiedInquiry.conversationId)).toBe(true);
        expect(await readStatus(verifiedInquiry.conversationId)).toBe('PENDING_OWNER');
    });

    it('sends the verification link of a deleted row to the expired-link page, never a 500', async () => {
        const { listingId } = await createFixture();
        const message = 'Se va a borrar';
        const created = await initiate({
            listingId,
            email: `gone-${randomUUID()}@example.test`,
            message
        });
        const token = await mintToken({ conversationId: created.conversationId, message });
        await backdate({ id: created.conversationId, days: 8 });
        await purgeUnverifiedInquiries({ clock: { now: () => new Date() } });
        expect(await exists(created.conversationId)).toBe(false);

        const response = await verify(token);

        expect(response.status).toBe(302);
        expect(redirectTarget(response)).toContain('/guest/messages/verify-expired');
    });
});
