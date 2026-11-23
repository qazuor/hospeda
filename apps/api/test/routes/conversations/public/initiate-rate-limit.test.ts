/**
 * HOS-2568: the per-email limiters of POST /api/v1/public/conversations/initiate.
 *
 * Every submit mails a verification link to an address the caller only has to type, so
 * the route caps submits per email (5/hour, all listings) and per email+listing (3/hour).
 * Before this change the keyed limiters never saw the body (it was stored as a bare
 * property, not through `c.set`), so neither was effective.
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
vi.mock('../../../../src/lib/analytics-client', () => ({ captureServerAnalyticsEvent: vi.fn() }));
vi.mock('@repo/service-core', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...original,
        ConversationService: vi.fn().mockImplementation(function () {
            return {
                initiateAnonymous: vi.fn().mockResolvedValue({
                    data: { status: 'resent', conversationId: crypto.randomUUID() }
                })
            };
        })
    };
});

import { initiatePublicConversationRoute } from '../../../../src/routes/conversations/public/initiate.js';

const app = new Hono({ strict: false }).route('/initiate', initiatePublicConversationRoute);

function submit(args: { readonly email: string; readonly accommodationId: string }) {
    return app.request('/initiate', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            // A fresh client address per call keeps the 10/10min IP limiter out of the way.
            'x-forwarded-for': `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.1`
        },
        body: JSON.stringify({
            accommodationId: args.accommodationId,
            guestName: 'Ana',
            guestEmail: args.email,
            message: 'Hola, quiero consultar disponibilidad'
        })
    });
}

describe('initiate per-email rate limits (HOS-2568)', () => {
    it('allows 3 submits per email and listing per hour, then answers 429', async () => {
        const email = `rl-${crypto.randomUUID()}@example.test`;
        const accommodationId = crypto.randomUUID();

        const statuses: number[] = [];
        for (let i = 0; i < 4; i++) {
            statuses.push((await submit({ email, accommodationId })).status);
        }

        expect(statuses).toEqual([200, 200, 200, 429]);
    });

    it('treats case variants of the same listing id as one bucket', async () => {
        const email = `rl-${crypto.randomUUID()}@example.test`;
        const accommodationId = crypto.randomUUID();

        const statuses: number[] = [];
        for (const id of [
            accommodationId,
            accommodationId.toUpperCase(),
            accommodationId,
            accommodationId.toUpperCase()
        ]) {
            statuses.push((await submit({ email, accommodationId: id })).status);
        }

        expect(statuses).toEqual([200, 200, 200, 429]);
    });

    it('counts a different listing separately', async () => {
        const email = `rl-${crypto.randomUUID()}@example.test`;
        for (let i = 0; i < 3; i++) await submit({ email, accommodationId: crypto.randomUUID() });

        const other = await submit({ email, accommodationId: crypto.randomUUID() });

        expect(other.status).toBe(200);
    });

    it('caps one email at 5 submits per hour across listings', async () => {
        const email = `rl-${crypto.randomUUID()}@example.test`;
        const statuses: number[] = [];
        for (let i = 0; i < 6; i++) {
            statuses.push((await submit({ email, accommodationId: crypto.randomUUID() })).status);
        }

        expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
    });
});
