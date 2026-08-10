/**
 * Write budgets for the host-trade domain (HOS-376 T-039).
 *
 * The property worth pinning is the SPREAD, not the numbers. The email fallback
 * is the only channel a provider can drive without the host being present
 * (R-5), so it must run out of budget long before the selector does. A single
 * shared budget would have to be set for the spray case and would then block a
 * plumber catching up on his week.
 *
 * @module test/middlewares/host-trade-rate-limits
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../src/types';

process.env.HOSPEDA_TESTING_RATE_LIMIT = 'true';

vi.mock('../../src/utils/redis', () => ({
    getRedisClient: vi.fn().mockResolvedValue(undefined),
    disconnectRedis: vi.fn().mockResolvedValue(undefined),
    resetRedisState: vi.fn()
}));

vi.mock('../../src/utils/env', () => ({
    env: {
        NODE_ENV: 'test',
        HOSPEDA_TESTING_RATE_LIMIT: true,
        HOSPEDA_REDIS_URL: undefined
    },
    getRateLimitConfig: () => ({
        enabled: true,
        windowMs: 1000,
        maxRequests: 100,
        keyGenerator: 'ip',
        skip: 'none' as const,
        headers: 'legacy' as const,
        message: 'Too many requests',
        trustProxy: false,
        trustedProxies: [] as readonly string[]
    })
}));

const {
    HOST_TRADE_DECLARE_EMAIL_MAX,
    HOST_TRADE_DECLARE_SELECTOR_MAX,
    createProviderDeclarationRateLimit
} = await import('../../src/middlewares/host-trade-rate-limits.js');

/**
 * An app whose only job is to report whether the request got through, with a
 * fresh limiter per app so one test cannot spend another's budget.
 */
function buildApp(actorId: string) {
    const app = new Hono<AppBindings>();
    const limiter = createProviderDeclarationRateLimit();

    app.use((c, next) => {
        c.set('actor', { id: actorId } as never);
        return next();
    });
    app.post('/declare', limiter, (c) => c.json({ ok: true }));

    return app;
}

const declare = (app: Hono<AppBindings>, body: unknown) =>
    app.request('/declare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

const SELECTOR_BODY = {
    hostUserId: '11111111-1111-4111-8111-111111111111',
    servicedAt: '2026-08-01'
};
const EMAIL_BODY = { hostEmail: 'anfitrion@example.com', servicedAt: '2026-08-01' };

let counter = 0;
const uniqueActor = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`;

beforeEach(() => {
    vi.clearAllMocks();
});

describe('the email fallback is budgeted apart from the selector', () => {
    /** THE SPREAD. Same actor, same hour: the email channel dies first. */
    it('refuses the email channel while the selector still has budget', async () => {
        const app = buildApp(uniqueActor());

        for (let i = 0; i < HOST_TRADE_DECLARE_EMAIL_MAX; i++) {
            expect((await declare(app, EMAIL_BODY)).status).toBe(200);
        }

        expect((await declare(app, EMAIL_BODY)).status).toBe(429);
        expect((await declare(app, SELECTOR_BODY)).status).toBe(200);
    });

    it('keeps the two budgets in separate buckets', async () => {
        const app = buildApp(uniqueActor());

        for (let i = 0; i < HOST_TRADE_DECLARE_EMAIL_MAX + 1; i++) {
            await declare(app, EMAIL_BODY);
        }

        // The selector budget is untouched by the exhausted email one.
        for (let i = 0; i < HOST_TRADE_DECLARE_EMAIL_MAX + 1; i++) {
            expect((await declare(app, SELECTOR_BODY)).status).toBe(200);
        }
    });

    it('refuses the selector channel too, only much later', async () => {
        const app = buildApp(uniqueActor());

        for (let i = 0; i < HOST_TRADE_DECLARE_SELECTOR_MAX; i++) {
            expect((await declare(app, SELECTOR_BODY)).status).toBe(200);
        }

        expect((await declare(app, SELECTOR_BODY)).status).toBe(429);
    });

    /** The budgets are per user: one provider's spray cannot silence another. */
    it('budgets each provider separately', async () => {
        const first = buildApp(uniqueActor());
        const second = buildApp(uniqueActor());

        for (let i = 0; i < HOST_TRADE_DECLARE_EMAIL_MAX + 1; i++) {
            await declare(first, EMAIL_BODY);
        }

        expect((await declare(second, EMAIL_BODY)).status).toBe(200);
    });

    /**
     * A body that does not parse is charged to the generous budget on purpose:
     * the strict one exists to slow a WORKING spray, and a spray sends bodies
     * that parse. Refusing malformed input is the validator's job.
     */
    it('charges an unparseable body to the selector budget', async () => {
        const app = buildApp(uniqueActor());
        const send = () =>
            app.request('/declare', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: 'not json'
            });

        for (let i = 0; i < HOST_TRADE_DECLARE_EMAIL_MAX + 1; i++) {
            expect((await send()).status).toBe(200);
        }
    });

    it('leaves the email budget far below the selector one', () => {
        expect(HOST_TRADE_DECLARE_EMAIL_MAX).toBeLessThan(HOST_TRADE_DECLARE_SELECTOR_MAX);
    });
});
