/** HOS-21: exclusive deals stay hidden while paid coverage is being replaced. */

import { RoleEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';

const BASE = '/api/v1/protected/owner-promotions/exclusive-deals';
const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function makeHeaders(): Record<string, string> {
    return {
        'user-agent': 'vitest',
        accept: 'application/json',
        'x-mock-actor-id': ACTOR_ID,
        'x-mock-actor-role': RoleEnum.USER,
        'x-mock-actor-permissions': JSON.stringify([])
    };
}

describe('GET /owner-promotions/exclusive-deals', () => {
    it('returns an empty collection to an authenticated tourist during the transition', async () => {
        const app = initApp();
        const res = await app.request(BASE, { headers: makeHeaders() });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.items).toEqual([]);
        expect(body.data.pagination.total).toBe(0);
    });
});
