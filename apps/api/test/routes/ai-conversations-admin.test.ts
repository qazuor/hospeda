/**
 * GET /api/v1/admin/ai/conversations (HOS-2075), through the real app.
 *
 * Refusal order: no session 401, no permission 403, malformed input 400 (before
 * any read), unknown id 404. The service is mocked; its SQL mapping is covered in
 * `test/services/ai-conversations-admin.test.ts`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockList, mockGet } = vi.hoisted(() => ({ mockList: vi.fn(), mockGet: vi.fn() }));

// The global setup swaps `ServiceError` for a double the error handler does not
// recognise; the real class is restored so 404 / 400 map correctly.
vi.mock('@repo/service-core', async () => vi.importActual('@repo/service-core'));

vi.mock('../../src/services/ai-conversations-admin.service.js', () => ({
    listConversations: mockList,
    getConversation: mockGet
}));

import { initApp } from '../../src/app.js';
import type { AppOpenAPI } from '../../src/types.js';

const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CONVERSATION_ID = '33333333-3333-4333-8333-333333333333';
const LISTING_ID = '11111111-1111-4111-8111-111111111111';
const BASE = '/api/v1/admin/ai/conversations';

const headersWith = (permissions: readonly string[]) => ({
    'user-agent': 'vitest',
    'x-mock-actor-id': ACTOR_ID,
    'x-mock-actor-role': 'ADMIN',
    'x-mock-actor-permissions': JSON.stringify(['access.panelAdmin', ...permissions])
});
const WITH_PERMISSION = headersWith(['aiConversation.viewAny']);
const WITHOUT_PERMISSION = headersWith(['ai.settings.manage']);

const LIST_ITEM = {
    id: CONVERSATION_ID,
    entityType: 'accommodation',
    entityId: LISTING_ID,
    startedAt: '2026-11-09T12:00:00.000Z',
    lastMessageAt: '2026-11-09T12:01:00.000Z',
    messageCount: 2,
    firstQuestion: '¿Aceptan mascotas?'
};

describe('admin AI conversations routes', () => {
    let app: AppOpenAPI;

    beforeEach(() => {
        vi.clearAllMocks();
        app = initApp();
        mockList.mockResolvedValue({ items: [LIST_ITEM], total: 1 });
        mockGet.mockResolvedValue({
            id: CONVERSATION_ID,
            entityType: 'accommodation',
            entityId: LISTING_ID,
            startedAt: '2026-11-09T12:00:00.000Z',
            turns: [
                {
                    id: '44444444-4444-4444-8444-444444444444',
                    role: 'user',
                    content: '¿Aceptan mascotas?',
                    createdAt: '2026-11-09T12:00:00.000Z'
                }
            ]
        });
    });

    it.each([
        BASE,
        `${BASE}/${CONVERSATION_ID}`
    ])('answers 401 without a session: %s', async (url) => {
        const res = await app.request(url, { headers: { 'user-agent': 'vitest' } });
        expect(res.status).toBe(401);
        expect(mockList).not.toHaveBeenCalled();
        expect(mockGet).not.toHaveBeenCalled();
    });

    it.each([
        BASE,
        `${BASE}/${CONVERSATION_ID}`
    ])('answers 403 without the permission, never reading: %s', async (url) => {
        const res = await app.request(url, { headers: WITHOUT_PERMISSION });
        expect(res.status).toBe(403);
        expect(mockList).not.toHaveBeenCalled();
        expect(mockGet).not.toHaveBeenCalled();
    });

    it('lists conversations with the permission and exact item keys', async () => {
        const res = await app.request(`${BASE}?entityType=accommodation&entityId=${LISTING_ID}`, {
            headers: WITH_PERMISSION
        });

        expect(res.status, await res.clone().text()).toBe(200);
        const body = (await res.json()) as { data: { items: Record<string, unknown>[] } };
        expect(Object.keys(body.data.items[0] ?? {}).sort()).toEqual(
            [
                'entityId',
                'entityType',
                'firstQuestion',
                'id',
                'lastMessageAt',
                'messageCount',
                'startedAt'
            ].sort()
        );
        expect(JSON.stringify(body)).not.toContain(ACTOR_ID);
        expect(mockList).toHaveBeenCalledWith(
            expect.objectContaining({ entityType: 'accommodation', entityId: LISTING_ID })
        );
    });

    it('passes the resolved day range to the service', async () => {
        const res = await app.request(`${BASE}?from=2026-11-01&to=2026-11-03`, {
            headers: WITH_PERMISSION
        });
        expect(res.status).toBe(200);
        expect(mockList).toHaveBeenCalledWith(
            expect.objectContaining({
                range: {
                    lowerBound: new Date('2026-11-01T00:00:00.000Z'),
                    upperExclusive: new Date('2026-11-04T00:00:00.000Z')
                }
            })
        );
    });

    it.each([
        ['a non-uuid listing id', 'entityId=abc'],
        ['an unknown vertical', 'entityType=partner'],
        ['from after to', 'from=2026-11-05&to=2026-11-01'],
        ['a from older than the horizon', 'from=2000-01-01'],
        ['a malformed day', 'from=2026-13-45']
    ])('answers 400 for %s before any read', async (_label, query) => {
        const res = await app.request(`${BASE}?${query}`, { headers: WITH_PERMISSION });
        expect(res.status).toBe(400);
        expect(mockList).not.toHaveBeenCalled();
    });

    it('returns the conversation turns with the permission', async () => {
        const res = await app.request(`${BASE}/${CONVERSATION_ID}`, { headers: WITH_PERMISSION });
        expect(res.status, await res.clone().text()).toBe(200);
        const body = (await res.json()) as { data: { turns: { role: string }[] } };
        expect(body.data.turns[0]?.role).toBe('user');
        expect(Object.keys(body.data).sort()).toEqual(
            ['entityId', 'entityType', 'id', 'startedAt', 'turns'].sort()
        );
    });

    it('answers 404 for an unknown conversation', async () => {
        mockGet.mockResolvedValueOnce(null);
        const res = await app.request(`${BASE}/${CONVERSATION_ID}`, { headers: WITH_PERMISSION });
        expect(res.status).toBe(404);
    });

    it('answers 400 for a non-uuid conversation id before reading', async () => {
        const res = await app.request(`${BASE}/not-a-uuid`, { headers: WITH_PERMISSION });
        expect(res.status).toBe(400);
        expect(mockGet).not.toHaveBeenCalled();
    });
});
