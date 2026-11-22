/**
 * Integration tests for the inquiry booking fields on the conversation
 * initiate routes (HOS-2534).
 *
 * Runs the real app against the ephemeral integration database: a visitor's
 * check-in, check-out and guest count must land in `conversations` columns,
 * invalid values must answer 400 VALIDATION_ERROR before anything is written,
 * and an inquiry without the fields must keep working.
 *
 * Endpoints:
 *   POST /api/v1/public/conversations/initiate
 *   POST /api/v1/protected/conversations/initiate
 */

import { conversations, eq, getDb } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { clearCache } from '../../../src/middlewares/cache';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import { buildMockActorHeaders, createMockActorUser } from '../helpers/mock-actor';
import {
    type SeededPublicAccommodation,
    seedPublicAccommodation
} from '../helpers/seed-public-accommodation';

const PUBLIC_URL = '/api/v1/public/conversations/initiate';
const PROTECTED_URL = '/api/v1/protected/conversations/initiate';

const publicHeaders = {
    'content-type': 'application/json',
    'user-agent': 'vitest',
    accept: 'application/json'
};

describe('conversation initiate: inquiry booking fields (HOS-2534)', () => {
    let app: ReturnType<typeof initApp>;
    let accommodation: SeededPublicAccommodation;
    let guestHeaders: Record<string, string>;
    let emailCounter = 0;

    beforeAll(async () => {
        await testDb.setup();
        validateApiEnv();
        app = initApp();
    });

    beforeEach(async () => {
        await testDb.clean();
        clearCache();
        accommodation = await seedPublicAccommodation();
        const guest = await createMockActorUser({ label: 'inquiry-guest' });
        guestHeaders = buildMockActorHeaders({
            actorId: guest.id,
            permissions: [
                PermissionEnum.CONVERSATION_VIEW_OWN,
                PermissionEnum.CONVERSATION_REPLY_OWN
            ]
        });
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    /** Anonymous body with a unique email so the per-email rate limit never interferes. */
    const anonBody = (extra: Record<string, unknown> = {}) => ({
        accommodationId: accommodation.id,
        guestName: 'Ana',
        guestEmail: `ana-${++emailCounter}-${Date.now()}@example.test`,
        message: 'Hola, ¿está disponible?',
        ...extra
    });

    const readConversation = async ({ id }: { readonly id: string }) => {
        const [row] = await getDb().select().from(conversations).where(eq(conversations.id, id));
        return row;
    };

    describe('public route', () => {
        it('stores check-in, check-out and guests as columns', async () => {
            const res = await app.request(PUBLIC_URL, {
                method: 'POST',
                headers: publicHeaders,
                body: JSON.stringify(
                    anonBody({ checkIn: '2026-12-12', checkOut: '2026-12-15', guests: 2 })
                )
            });

            expect(res.status).toBe(200);
            const { data } = (await res.json()) as { data: { conversationId: string } };
            const row = await readConversation({ id: data.conversationId });
            expect(row?.checkIn).toBe('2026-12-12');
            expect(row?.checkOut).toBe('2026-12-15');
            expect(row?.guests).toBe(2);
        });

        it('still creates the conversation when the fields are missing', async () => {
            const res = await app.request(PUBLIC_URL, {
                method: 'POST',
                headers: publicHeaders,
                body: JSON.stringify(anonBody())
            });

            expect(res.status).toBe(200);
            const { data } = (await res.json()) as { data: { conversationId: string } };
            const row = await readConversation({ id: data.conversationId });
            expect(row?.checkIn).toBeNull();
            expect(row?.checkOut).toBeNull();
            expect(row?.guests).toBeNull();
        });

        it.each([
            ['check-out not after check-in', { checkIn: '2026-12-15', checkOut: '2026-12-12' }],
            ['check-out equal to check-in', { checkIn: '2026-12-15', checkOut: '2026-12-15' }],
            ['a malformed date', { checkIn: '15/12/2026' }],
            ['an impossible date', { checkOut: '2026-02-31' }],
            ['zero guests', { guests: 0 }],
            ['a fractional guest count', { guests: 1.5 }]
        ])('answers 400 VALIDATION_ERROR for %s and writes nothing', async (_name, extra) => {
            const res = await app.request(PUBLIC_URL, {
                method: 'POST',
                headers: publicHeaders,
                body: JSON.stringify(anonBody(extra))
            });

            expect(res.status).toBe(400);
            const body = (await res.json()) as { error: { code: string } };
            expect(body.error.code).toBe('VALIDATION_ERROR');
            expect(await getDb().select().from(conversations)).toHaveLength(0);
        });
    });

    describe('protected route', () => {
        it('stores check-in, check-out and guests as columns', async () => {
            const res = await app.request(PROTECTED_URL, {
                method: 'POST',
                headers: guestHeaders,
                body: JSON.stringify({
                    accommodationId: accommodation.id,
                    message: 'Hola',
                    checkIn: '2026-12-12',
                    checkOut: '2026-12-15',
                    guests: 3
                })
            });

            expect(res.status).toBe(201);
            const { data } = (await res.json()) as { data: { conversationId: string } };
            const row = await readConversation({ id: data.conversationId });
            expect(row?.checkIn).toBe('2026-12-12');
            expect(row?.checkOut).toBe('2026-12-15');
            expect(row?.guests).toBe(3);
        });

        it('still creates the conversation when the fields are missing', async () => {
            const res = await app.request(PROTECTED_URL, {
                method: 'POST',
                headers: guestHeaders,
                body: JSON.stringify({ accommodationId: accommodation.id, message: 'Hola' })
            });

            expect(res.status).toBe(201);
            const { data } = (await res.json()) as { data: { conversationId: string } };
            const row = await readConversation({ id: data.conversationId });
            expect(row?.checkIn).toBeNull();
            expect(row?.guests).toBeNull();
        });

        it('answers 400 VALIDATION_ERROR when check-out is not after check-in', async () => {
            const res = await app.request(PROTECTED_URL, {
                method: 'POST',
                headers: guestHeaders,
                body: JSON.stringify({
                    accommodationId: accommodation.id,
                    message: 'Hola',
                    checkIn: '2026-12-15',
                    checkOut: '2026-12-12'
                })
            });

            expect(res.status).toBe(400);
            const body = (await res.json()) as { error: { code: string } };
            expect(body.error.code).toBe('VALIDATION_ERROR');
            expect(await getDb().select().from(conversations)).toHaveLength(0);
        });
    });
});
