/**
 * HOS-2570: the per-email limiter on POST /api/v1/public/conversations/request-access.
 *
 * Every call may mail an access link to an address the caller only has to type, so the
 * route caps it at 3 per hour per normalized email. The keyed limiter reads the validated
 * body through `c.get`, but the route used to store it as a bare property, so the limiter
 * never had a key and only the per-IP cap applied (same bug HOS-2568 fixed in `initiate`).
 */
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../src/utils/env', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../../src/utils/env')>();
    return {
        ...actual,
        env: {
            ...actual.env,
            NODE_ENV: 'test',
            HOSPEDA_TESTING_RATE_LIMIT: true,
            HOSPEDA_BETTER_AUTH_SECRET: 'test-secret-at-least-32-characters-long!!',
            HOSPEDA_SITE_URL: 'http://localhost:4321'
        }
    };
});
vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));
vi.mock('../../../../src/utils/redis', () => ({
    getRedisClient: vi.fn().mockResolvedValue(undefined)
}));
vi.mock('@repo/service-core', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...original,
        ConversationService: vi.fn().mockImplementation(function () {
            return { requestAccessByEmail: vi.fn().mockResolvedValue(undefined) };
        })
    };
});

import { requestAccessPublicConversationRoute } from '../../../../src/routes/conversations/public/request-access.js';

const app = new Hono({ strict: false }).route(
    '/request-access',
    requestAccessPublicConversationRoute
);

function submit(email: string) {
    return app.request('/request-access/', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            // A fresh client address per call keeps the 10/10min IP limiter out of the way.
            'x-forwarded-for': `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.1`
        },
        body: JSON.stringify({ email })
    });
}

describe('request-access per-email rate limit (HOS-2570)', () => {
    it('allows 3 requests per email per hour, then answers 429', async () => {
        const email = `ra-${crypto.randomUUID()}@example.test`;

        const statuses: number[] = [];
        for (let i = 0; i < 4; i++) statuses.push((await submit(email)).status);

        expect(statuses).toEqual([200, 200, 200, 429]);
    });

    it('treats case variants of one email as a single bucket', async () => {
        const local = `ra-${crypto.randomUUID()}`;
        const variants = [
            `${local}@example.test`,
            `${local.toUpperCase()}@EXAMPLE.test`,
            `${local}@example.test`,
            `${local.toUpperCase()}@example.test`
        ];

        const statuses: number[] = [];
        for (const email of variants) statuses.push((await submit(email)).status);

        expect(statuses).toEqual([200, 200, 200, 429]);
    });

    it('counts a different email separately', async () => {
        const email = `ra-${crypto.randomUUID()}@example.test`;
        for (let i = 0; i < 3; i++) await submit(email);

        const other = await submit(`ra-${crypto.randomUUID()}@example.test`);

        expect(other.status).toBe(200);
    });
});
