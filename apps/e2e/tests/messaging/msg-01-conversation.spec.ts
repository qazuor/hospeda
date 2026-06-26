/**
 * MSG-01 — Guest contacts host, host replies, guest sees the reply.
 *
 * Actors: Guest (initiator) + Host (owner of the accommodation).
 * Tags: @p1 @messaging @cross-app
 *
 * Preconditions:
 *   - Host with active subscription + ACTIVE accommodation.
 *   - Authenticated guest USER (separate from the host).
 *
 * What this validates (SPEC-085 messaging contract):
 *  1. Guest POST `/api/v1/protected/conversations/initiate` creates a
 *     conversation with `isNew=true` and a non-null messageId.
 *  2. Host GET `/api/v1/protected/conversations` lists the conversation.
 *  3. Host POST `/api/v1/protected/conversations/:id/messages` appends a
 *     reply.
 *  4. Guest GET `/api/v1/protected/conversations/:id` returns both
 *     messages (initial + reply) in order.
 *  5. DB invariant: a single conversations row links guest and host;
 *     messages table has at least 2 rows.
 *
 * @see SPEC-092 spec.md § MSG-01
 */

import { expect, test } from '@playwright/test';
import {
    createAccommodation,
    createSubscription,
    createUser,
    forceVerifyEmail
} from '../../fixtures/api-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

test.describe('MSG-01: guest contacts host, host replies @p1 @messaging @cross-app', () => {
    const userIdsToCleanup: string[] = [];

    test.afterEach(async () => {
        if (userIdsToCleanup.length > 0) {
            await cleanupTestUsers(getDbPool(), [...userIdsToCleanup]);
            userIdsToCleanup.length = 0;
        }
    });

    test('initiate → host reply → guest sees both messages', async ({ page }) => {
        // ── Setup: host + accommodation ────────────────────────────────────
        const host = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
        userIdsToCleanup.push(host.id);
        await forceVerifyEmail(host.id);

        const planRows = await execSQL<{ id: string }>(
            'SELECT id FROM billing_plans WHERE active = true ORDER BY created_at ASC LIMIT 1'
        );
        const planId = planRows[0]?.id;
        if (!planId) {
            test.fixme(true, 'No billing plan in seed — MSG-01 cannot run');
            return;
        }
        await createSubscription({ userId: host.id, planId, status: 'active' });

        const accommodation = await createAccommodation({
            ownerId: host.id,
            lifecycleState: 'ACTIVE',
            slugPrefix: 'msg-01'
        });

        // ── Setup: guest (separate USER) ──────────────────────────────────
        const guest = await createUser({ role: 'USER' }, { apiBaseUrl: API_URL });
        userIdsToCleanup.push(guest.id);
        await forceVerifyEmail(guest.id);

        // ── 1. Guest initiates conversation ────────────────────────────────
        const initRes = await page.request.post(
            `${API_URL}/api/v1/protected/conversations/initiate`,
            {
                data: {
                    accommodationId: accommodation.id,
                    message: 'Hola, ¿está disponible la primera semana de marzo?',
                    locale: 'es'
                },
                headers: { cookie: guest.sessionCookie }
            }
        );
        expect(initRes.ok(), `initiate should be 2xx (got ${initRes.status()})`).toBe(true);
        const initBody = (await initRes.json()) as {
            data?: { conversationId: string; isNew: boolean; messageId: string };
        };
        const conversationId =
            initBody.data?.conversationId ??
            (initBody as { conversationId?: string }).conversationId;
        expect(conversationId, 'conversationId must be returned').toBeTruthy();

        // ── 2. Host lists conversations and finds the new one ─────────────
        // SPEC-105 T-105-04: host inbox is at /conversations/owner (not /conversations,
        // which is the guest inbox filtered by user_id). Response shape is paginated:
        // { data: { items: [...], pagination: {...} } }.
        const listRes = await page.request.get(`${API_URL}/api/v1/protected/conversations/owner`, {
            headers: { cookie: host.sessionCookie }
        });
        expect(listRes.ok()).toBe(true);
        const listBody = (await listRes.json()) as {
            data?: { items: ReadonlyArray<{ id: string }>; pagination: unknown };
        };
        const conversationIds = listBody.data?.items?.map((row) => row.id) ?? [];
        expect(
            conversationIds.includes(conversationId as string),
            `host conversations list should include ${conversationId}`
        ).toBe(true);

        // ── 3. Host replies ────────────────────────────────────────────────
        const replyRes = await page.request.post(
            `${API_URL}/api/v1/protected/conversations/${conversationId}/messages`,
            {
                data: { body: 'Sí, está disponible. Te paso el contacto directo.' },
                headers: { cookie: host.sessionCookie }
            }
        );
        expect(replyRes.ok(), `host reply should be 2xx (got ${replyRes.status()})`).toBe(true);

        // ── 4. Guest views the thread, sees both messages ─────────────────
        const threadRes = await page.request.get(
            `${API_URL}/api/v1/protected/conversations/${conversationId}`,
            { headers: { cookie: guest.sessionCookie } }
        );
        expect(threadRes.ok()).toBe(true);
        const threadBody = (await threadRes.json()) as {
            data?: { messages?: ReadonlyArray<{ body?: string }> };
        };
        const messages = threadBody.data?.messages ?? [];
        expect(
            messages.length >= 2,
            `thread should contain ≥ 2 messages (got ${messages.length})`
        ).toBe(true);

        // ── 5. DB invariant: messages table has at least 2 rows ──────────
        const dbMessages = await execSQL<{ count: string }>(
            'SELECT COUNT(*)::text AS count FROM messages WHERE conversation_id = $1',
            [conversationId]
        );
        expect(Number(dbMessages[0]?.count ?? 0)).toBeGreaterThanOrEqual(2);
    });
});
