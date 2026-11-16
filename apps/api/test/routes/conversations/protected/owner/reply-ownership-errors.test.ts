/**
 * Regression tests for the ownership gate of
 * POST /api/v1/protected/conversations/owner/:id/messages.
 *
 * Only NOT_FOUND / FORBIDDEN (or a missing row) may answer 404. Any other
 * service error must keep its own status (error-contract.md: a 5xx is never
 * masked as 404).
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFindOwned, mockCreateMessage } = vi.hoisted(() => ({
    mockFindOwned: vi.fn(),
    mockCreateMessage: vi.fn()
}));

vi.mock('@repo/service-core', async () => {
    const actual = await vi.importActual<typeof import('@repo/service-core')>('@repo/service-core');
    return {
        ...actual,
        ConversationService: vi.fn().mockImplementation(function () {
            return { findOwnedConversation: mockFindOwned };
        }),
        MessageService: vi.fn().mockImplementation(function () {
            return { createMessage: mockCreateMessage };
        })
    };
});

import { replyOwnerConversationRoute } from '../../../../../src/routes/conversations/protected/owner/reply.js';

const ACTOR = {
    id: '22222222-2222-4222-8222-222222222222',
    roles: ['HOST'],
    permissions: ['conversation.reply.own']
};
const CONVERSATION_ID = '11111111-1111-4111-8111-111111111111';

function buildApp() {
    const app = new Hono();
    app.use('*', async (c, next) => {
        c.set('actor' as never, ACTOR as never);
        await next();
    });
    app.route('/', replyOwnerConversationRoute as never);
    return app;
}

async function post(app: ReturnType<typeof buildApp>) {
    return app.request(`/${CONVERSATION_ID}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'Hola' })
    });
}

describe('owner reply ownership gate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('answers 404 when the conversation is not the owner (data null)', async () => {
        mockFindOwned.mockResolvedValue({ data: null });

        const res = await post(buildApp());

        expect(res.status).toBe(404);
        expect(mockCreateMessage).not.toHaveBeenCalled();
    });

    it.each(['NOT_FOUND', 'FORBIDDEN'])('answers 404 for a %s service error', async (code) => {
        mockFindOwned.mockResolvedValue({ error: { code, message: 'x' } });

        const res = await post(buildApp());

        expect(res.status).toBe(404);
        expect(mockCreateMessage).not.toHaveBeenCalled();
    });

    it('does not mask an INTERNAL_ERROR as 404', async () => {
        mockFindOwned.mockResolvedValue({ error: { code: 'INTERNAL_ERROR', message: 'db down' } });

        const res = await post(buildApp());

        expect(res.status).toBe(500);
        expect(mockCreateMessage).not.toHaveBeenCalled();
    });

    it('does not mask a SERVICE_UNAVAILABLE as 404', async () => {
        mockFindOwned.mockResolvedValue({
            error: { code: 'SERVICE_UNAVAILABLE', message: 'down' }
        });

        const res = await post(buildApp());

        expect(res.status).toBe(503);
    });
});
