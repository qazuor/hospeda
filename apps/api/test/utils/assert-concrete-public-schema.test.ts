/**
 * Tests for {@link assertConcretePublicSchema} and the public-router boot
 * registration contract (SPEC-210 PR5 T-011).
 *
 * Boot test: verifies that importing the public conversations router (which
 * exercises the raw conversation routes with their new concrete schemas) does
 * not throw — i.e. the fail-closed backstop does not trip at registration time.
 *
 * Guard unit tests: verifies that assertConcretePublicSchema rejects permissive
 * schemas and passes concrete ones.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

// ── Infrastructure mocks (required by all route imports) ──────────────────────

vi.mock('../../src/utils/env', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../src/utils/env')>();
    return {
        ...actual,
        env: {
            ...actual.env,
            NODE_ENV: 'test',
            HOSPEDA_TESTING_RATE_LIMIT: false,
            HOSPEDA_BETTER_AUTH_SECRET: 'test-secret-at-least-32-characters-long!!',
            HOSPEDA_SITE_URL: 'http://localhost:4321'
        }
    };
});

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

vi.mock('../../src/utils/redis', () => ({
    getRedisClient: vi.fn().mockResolvedValue(undefined)
}));

// Mock DB models used by the guest-thread route enrichment
vi.mock('@repo/db', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/db')>();
    return {
        ...original,
        AccommodationModel: vi.fn().mockImplementation(() => ({
            findById: vi.fn().mockResolvedValue(null)
        })),
        UserModel: vi.fn().mockImplementation(() => ({
            findById: vi.fn().mockResolvedValue(null)
        }))
    };
});

// Mock service-core to avoid real service instantiation at import time
vi.mock('@repo/service-core', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...original,
        AccessTokenService: vi.fn().mockImplementation(() => ({
            validateToken: vi.fn()
        })),
        ConversationService: vi.fn().mockImplementation(() => ({
            getThread: vi.fn(),
            initiateAnonymous: vi.fn(),
            requestAccessByEmail: vi.fn()
        })),
        MessageService: vi.fn().mockImplementation(() => ({
            createMessage: vi.fn()
        }))
    };
});

// Import the guard function under test
import { assertConcretePublicSchema } from '../../src/utils/response-helpers';

// ── assertConcretePublicSchema unit tests ─────────────────────────────────────

describe('assertConcretePublicSchema — guard unit tests (SPEC-210 PR5 T-011)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('rejects permissive top-level schemas', () => {
        it('throws for z.any()', () => {
            expect(() => assertConcretePublicSchema(z.any())).toThrow(/z\.any\(\)/i);
        });

        it('throws for z.unknown()', () => {
            expect(() => assertConcretePublicSchema(z.unknown())).toThrow(/z\.unknown\(\)/i);
        });

        it('throws for top-level z.record()', () => {
            expect(() => assertConcretePublicSchema(z.record(z.string(), z.unknown()))).toThrow(
                /z\.record\(\)/i
            );
        });

        it('throws for z.object({}).passthrough()', () => {
            expect(() =>
                assertConcretePublicSchema(z.object({ id: z.string() }).passthrough())
            ).toThrow(/passthrough/i);
        });
    });

    describe('passes concrete schemas', () => {
        it('passes for a concrete z.object()', () => {
            expect(() =>
                assertConcretePublicSchema(z.object({ id: z.string(), name: z.string() }))
            ).not.toThrow();
        });

        it('passes for z.array(z.object())', () => {
            expect(() =>
                assertConcretePublicSchema(z.array(z.object({ id: z.string() })))
            ).not.toThrow();
        });

        it('passes for a z.object() containing a nested z.record() field (billing/listPlans pattern)', () => {
            // This is the critical test: PlanPublicSchema has `limits: z.record(z.string(), z.number())`
            // nested inside a z.object(). The guard must NOT reject this.
            const schema = z.object({
                id: z.string(),
                limits: z.record(z.string(), z.number())
            });
            expect(() => assertConcretePublicSchema(schema)).not.toThrow();
        });
    });
});

// ── Boot test: public conversations router registration ───────────────────────

describe('Public conversations router — boot registration (SPEC-210 PR5 T-011)', () => {
    it('importing the public conversations router does not throw', async () => {
        await expect(import('../../src/routes/conversations/public/index')).resolves.not.toThrow();
    });

    it('importing guest-thread route does not throw', async () => {
        await expect(
            import('../../src/routes/conversations/public/guest-thread')
        ).resolves.not.toThrow();
    });

    it('importing guest-reply route does not throw', async () => {
        await expect(
            import('../../src/routes/conversations/public/guest-reply')
        ).resolves.not.toThrow();
    });

    it('importing initiate route does not throw', async () => {
        await expect(
            import('../../src/routes/conversations/public/initiate')
        ).resolves.not.toThrow();
    });

    it('importing request-access route does not throw', async () => {
        await expect(
            import('../../src/routes/conversations/public/request-access')
        ).resolves.not.toThrow();
    });
});

// ── Boot test: factory-based public routers exercise the wired guard ──────────
//
// Importing these modules runs the createPublicRoute / createPublicListRoute /
// createSimpleRoute factories at module-load time, which now call
// assertConcretePublicSchema (SPEC-210 PR5 T-004). If any mounted public route
// declared a permissive top-level responseSchema, these imports would throw at
// boot. The billing listPlans route is the critical case: its PlanPublicSchema
// has `limits: z.record(z.string(), z.number())` NESTED inside a z.object(), so
// the top-level guard must accept it.

describe('Factory-based public routers — boot guard wiring (SPEC-210 PR5 T-004)', () => {
    it('importing the billing public listPlans route (createSimpleRoute + nested z.record) does not throw', async () => {
        await expect(import('../../src/routes/billing/public/listPlans')).resolves.not.toThrow();
    });

    it('importing the public accommodation routers (createPublicRoute / createPublicListRoute) does not throw', async () => {
        await expect(import('../../src/routes/accommodation/public/index')).resolves.not.toThrow();
    });
});
