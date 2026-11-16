/**
 * Analytics capture tests for POST /api/v1/protected/conversations/initiate
 * (HOS-2119 T-024).
 *
 * Imports the route directly and mocks the infrastructure, so no DB is needed.
 * Verifies `contact_owner_completed` / `contact_owner_failed` are captured
 * through `lib/analytics-client` (not the retired PostHog wrapper).
 *
 * @module test/routes/conversations/protected/initiate-analytics
 */
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types';

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const ACCOMMODATION_ID = '550e8400-e29b-41d4-a716-446655440000';
const CONVERSATION_ID = '550e8400-e29b-41d4-a716-446655440001';

const mocks = vi.hoisted(() => ({
    capture: vi.fn(),
    initiateAuthenticated: vi.fn(),
    getMessages: vi.fn(),
    createMessage: vi.fn()
}));

vi.mock('../../../../src/lib/analytics-client', () => ({
    captureServerAnalyticsEvent: (...args: unknown[]) => mocks.capture(...args)
}));

vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

vi.mock('../../../../src/lib/conversation-mailer', () => ({
    createConversationMailer: vi.fn(() => ({}))
}));

vi.mock('@repo/db', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/db')>();
    const chain = {
        select: () => chain,
        from: () => chain,
        where: () => chain,
        limit: async () => [{ destinationId: 'dest-1', ownerId: 'owner-1' }]
    };
    return {
        ...original,
        accommodations: { id: 'id', destinationId: 'destinationId', ownerId: 'ownerId' },
        eq: vi.fn(),
        getDb: () => chain
    };
});

vi.mock('@repo/service-core', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...original,
        ConversationService: vi.fn().mockImplementation(function () {
            return { initiateAuthenticated: mocks.initiateAuthenticated };
        }),
        MessageService: vi.fn().mockImplementation(function () {
            return { getMessages: mocks.getMessages, createMessage: mocks.createMessage };
        })
    };
});

import { initiateProtectedConversationRoute } from '../../../../src/routes/conversations/protected/initiate.js';

function buildApp(): Hono<AppBindings> {
    const app = new Hono<AppBindings>({ strict: false });
    app.use('*', async (c, next) => {
        c.set('actor', {
            id: ACTOR_ID,
            roles: ['USER'],
            permissions: []
        } as unknown as AppBindings['Variables']['actor']);
        await next();
    });
    app.route('/initiate', initiateProtectedConversationRoute);
    return app;
}

async function post(
    app: Hono<AppBindings>,
    extraHeaders: Record<string, string> = {}
): Promise<Response> {
    return app.request('/initiate/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...extraHeaders },
        body: JSON.stringify({ accommodationId: ACCOMMODATION_ID, message: 'Hello there!' })
    });
}

describe('POST /api/v1/protected/conversations/initiate analytics', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('captures contact_owner_completed through the analytics client for a new conversation', async () => {
        // Arrange
        mocks.initiateAuthenticated.mockResolvedValueOnce({
            data: { conversationId: CONVERSATION_ID, isNew: true }
        });
        mocks.getMessages.mockResolvedValueOnce({ data: { messages: [] } });

        // Act
        const res = await post(buildApp());

        // Assert
        expect(res.status).toBe(201);
        expect(mocks.capture).toHaveBeenCalledWith(
            expect.objectContaining({
                distinctId: ACTOR_ID,
                name: 'contact_owner_completed',
                properties: expect.objectContaining({
                    accommodation_id: ACCOMMODATION_ID,
                    destination_id: 'dest-1',
                    owner_id: 'owner-1',
                    conversation_flow: 'authenticated',
                    is_authenticated: true
                })
            })
        );
    });

    it('captures contact_owner_completed for a message appended to an existing conversation', async () => {
        // Arrange
        mocks.initiateAuthenticated.mockResolvedValueOnce({
            data: { conversationId: CONVERSATION_ID, isNew: false }
        });
        mocks.createMessage.mockResolvedValueOnce({
            data: { id: '550e8400-e29b-41d4-a716-446655440002' }
        });

        // Act
        const res = await post(buildApp());

        // Assert
        expect(res.status).toBe(201);
        expect(mocks.capture).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'contact_owner_completed' })
        );
    });

    it('captures contact_owner_failed through the analytics client when the service errors', async () => {
        // Arrange
        mocks.initiateAuthenticated.mockResolvedValueOnce({
            error: { code: 'ALREADY_EXISTS', message: 'dup' }
        });

        // Act
        const res = await post(buildApp());

        // Assert
        expect(res.status).not.toBe(201);
        expect(mocks.capture).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'contact_owner_failed',
                properties: expect.objectContaining({ failure_reason: 'conversation_duplicate' })
            })
        );
    });

    describe('visitor context', () => {
        const VISITOR_HEADERS = { 'cf-connecting-ip': '203.0.113.7', 'user-agent': 'UA/1' };

        it('passes the visitor from request headers on completed (new conversation)', async () => {
            mocks.initiateAuthenticated.mockResolvedValueOnce({
                data: { conversationId: CONVERSATION_ID, isNew: true }
            });
            mocks.getMessages.mockResolvedValueOnce({ data: { messages: [] } });

            await post(buildApp(), VISITOR_HEADERS);

            expect(mocks.capture).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'contact_owner_completed',
                    visitor: { ip: '203.0.113.7', userAgent: 'UA/1' }
                })
            );
        });

        it('passes the visitor on completed (existing conversation)', async () => {
            mocks.initiateAuthenticated.mockResolvedValueOnce({
                data: { conversationId: CONVERSATION_ID, isNew: false }
            });
            mocks.createMessage.mockResolvedValueOnce({ data: { id: 'm-1' } });

            await post(buildApp(), VISITOR_HEADERS);

            expect(mocks.capture).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'contact_owner_completed',
                    visitor: { ip: '203.0.113.7', userAgent: 'UA/1' }
                })
            );
        });

        it('passes the visitor on failed', async () => {
            mocks.initiateAuthenticated.mockResolvedValueOnce({
                error: { code: 'ALREADY_EXISTS', message: 'dup' }
            });

            await post(buildApp(), VISITOR_HEADERS);

            expect(mocks.capture).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'contact_owner_failed',
                    visitor: { ip: '203.0.113.7', userAgent: 'UA/1' }
                })
            );
        });

        it('omits the visitor when the headers are absent', async () => {
            mocks.initiateAuthenticated.mockResolvedValueOnce({
                data: { conversationId: CONVERSATION_ID, isNew: true }
            });
            mocks.getMessages.mockResolvedValueOnce({ data: { messages: [] } });

            await post(buildApp());

            expect(mocks.capture).toHaveBeenCalledTimes(1);
            expect(mocks.capture.mock.calls[0]?.[0]).not.toHaveProperty('visitor');
        });
    });
});
