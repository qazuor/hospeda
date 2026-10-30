import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockResolve } = vi.hoisted(() => ({ mockResolve: vi.fn() }));
vi.mock('../../src/services/listing-publication/subscribe-destination.service', () => ({
    resolveSubscribeDestinationForUser: (...args: unknown[]) => mockResolve(...args)
}));

import { initApp } from '../../src/app.js';

const url = '/api/v1/protected/publish/subscribe-destination/accommodation';
const actorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const headers = {
    'user-agent': 'vitest',
    accept: 'application/json',
    'content-type': 'application/json',
    'x-mock-actor-id': actorId,
    'x-mock-actor-role': 'USER',
    'x-mock-actor-permissions': '[]'
};

describe('TEST:V8a:1 GET subscribe destination', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockResolve.mockResolvedValue({ destination: 'PUBLISH', trialDays: 14 });
    });

    it('returns the canonical response for the authenticated subject', async () => {
        const response = await initApp().request(url, { headers });
        expect(response.status).toBe(200);
        expect((await response.json()).data).toEqual({ destination: 'PUBLISH', trialDays: 14 });
        expect(mockResolve).toHaveBeenCalledWith({ userId: actorId, vertical: 'accommodation' });
    });

    it('rejects a guest before validating the vertical', async () => {
        const response = await initApp().request(
            '/api/v1/protected/publish/subscribe-destination/unknown',
            {
                headers: {
                    ...headers,
                    'x-mock-actor-id': '00000000-0000-4000-8000-000000000000',
                    'x-mock-actor-role': 'GUEST'
                }
            }
        );
        expect(response.status).toBe(401);
        expect(mockResolve).not.toHaveBeenCalled();
    });

    it('rejects an unknown vertical for an authenticated actor', async () => {
        const response = await initApp().request(
            '/api/v1/protected/publish/subscribe-destination/unknown',
            { headers }
        );
        expect(response.status).toBe(400);
        expect(mockResolve).not.toHaveBeenCalled();
    });
});
