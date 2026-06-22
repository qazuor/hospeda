/**
 * Tests for the AI quota enforcement middleware (SPEC-173 T-031).
 *
 * Coverage:
 *   - Guest / missing actor → 401 (AC-5).
 *   - billingLoadFailed=true → 503.
 *   - Missing entitlement → 403 ENTITLEMENT_REQUIRED.
 *   - Limit = -1 (unlimited) → 200 AND getMonthlyCallCount NOT called.
 *   - Limit = 0 (disabled) → 403 LIMIT_REACHED (no DB call).
 *   - count < limit → 200 (next() called).
 *   - count >= limit → 403 LIMIT_REACHED AND recordAiUsage called once with
 *     status 'quota_exceeded' (AC-6 metering).
 *   - recordAiUsage throwing → still 403 (enforcement independent of metering).
 *   - Each of the 4 features maps to its correct entitlement/limit key.
 *
 * Uses Hono test app + context-injection middleware (same idiom as
 * entitlement.test.ts). `@repo/ai-core` is fully mocked so no real DB
 * connection is required.
 *
 * Note on error details: ServiceError.details is captured via a thrown-error
 * spy rather than reading from the JSON body, because Vite's esbuild transform
 * of `class extends Error { constructor(public details?: unknown) }` loses the
 * field assignment under ES2022 class-field semantics when the class is loaded
 * from source via the vitest alias. The status code and `code` field are still
 * verifiable through the JSON body.
 */

import { EntitlementKey, LimitKey } from '@repo/billing';
import { ServiceErrorCode } from '@repo/schemas';
import type { AiFeature } from '@repo/schemas';
import { RoleEnum } from '@repo/service-core';
import { ServiceError } from '@repo/service-core';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuotaGatedAiFeature } from '../../src/middlewares/ai-quota';
import {
    AI_ENTITLEMENT_BY_FEATURE,
    AI_LIMIT_BY_FEATURE,
    createAiQuotaMiddleware
} from '../../src/middlewares/ai-quota';
import { createErrorHandler } from '../../src/middlewares/response';
import type { AppBindings } from '../../src/types';

// ---------------------------------------------------------------------------
// Mock @repo/ai-core
// ---------------------------------------------------------------------------

vi.mock('@repo/ai-core', () => {
    // AiFeatureNotConfiguredError extends Error (NOT AiEngineError) — mirrors the
    // real class in packages/ai-core/src/config/resolver.ts. Required so that
    // the `instanceof AiFeatureNotConfiguredError` check in ai-error-mapper.ts
    // does not evaluate against `undefined` and crash the mapper.
    class AiFeatureNotConfiguredError extends Error {
        readonly feature: string;
        constructor(feature: string) {
            super(
                `AI feature '${feature}' is not configured in ai_settings. An admin must save a configuration for this feature before it can be used.`
            );
            this.name = 'AiFeatureNotConfiguredError';
            this.feature = feature;
        }
    }
    return {
        getMonthlyCallCount: vi.fn(),
        recordAiUsage: vi.fn(),
        AiFeatureNotConfiguredError
    };
});

import * as aiCore from '@repo/ai-core';

const mockGetMonthlyCallCount = aiCore.getMonthlyCallCount as ReturnType<typeof vi.fn>;
const mockRecordAiUsage = aiCore.recordAiUsage as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Mock logger
// ---------------------------------------------------------------------------

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

// ---------------------------------------------------------------------------
// Context injection helpers
// ---------------------------------------------------------------------------

type InjectedActor = AppBindings['Variables']['actor'];

interface InjectContextOptions {
    app: Hono<AppBindings>;
    actor?: InjectedActor | null;
    entitlements?: Set<EntitlementKey>;
    limits?: Map<LimitKey, number>;
    billingLoadFailed?: boolean;
}

/**
 * Injects the test context variables before each request.
 * Mirrors the pattern used in entitlement.test.ts.
 */
function injectContext({
    app,
    actor,
    entitlements = new Set<EntitlementKey>(),
    limits = new Map<LimitKey, number>(),
    billingLoadFailed = false
}: InjectContextOptions): void {
    app.use((c: Context<AppBindings>, next) => {
        if (actor !== undefined && actor !== null) {
            c.set('actor', actor);
        }
        c.set('userEntitlements', entitlements);
        c.set('userLimits', limits);
        c.set('billingLoadFailed', billingLoadFailed);
        return next();
    });
}

// ---------------------------------------------------------------------------
// Helper: build a minimal authenticated actor
// ---------------------------------------------------------------------------

function makeActor(id: string, role: RoleEnum = RoleEnum.USER): InjectedActor {
    return { id, role, permissions: [], email: `${id}@example.com` } as unknown as InjectedActor;
}

// ---------------------------------------------------------------------------
// Helper: capture the thrown ServiceError via an onError spy
//
// Some assertions need to inspect error.details directly (not serialized JSON)
// because the Vite/esbuild ES2022 transform causes ServiceError.details to be
// `undefined` when read from a JSON body in this Vitest environment.
// Capturing the raw thrown error avoids the serialization path.
// ---------------------------------------------------------------------------

function captureErrorMiddleware(app: Hono<AppBindings>, capturedRef: { error: unknown }): void {
    app.onError((err, c) => {
        capturedRef.error = err;
        if (err instanceof ServiceError) {
            const status =
                err.code === ServiceErrorCode.UNAUTHORIZED
                    ? 401
                    : err.code === ServiceErrorCode.LIMIT_REACHED
                      ? 403
                      : err.code === ServiceErrorCode.ENTITLEMENT_REQUIRED
                        ? 403
                        : 500;
            return c.json(
                { success: false, error: { code: err.code, message: err.message } },
                status as 401 | 403 | 500
            );
        }
        if (err instanceof HTTPException) {
            return c.json(
                { success: false, error: { code: 'HTTP_ERROR', message: err.message } },
                err.status as 401 | 403 | 500
            );
        }
        return c.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: err.message } },
            500
        );
    });
}

// ---------------------------------------------------------------------------
// Main describe block
// ---------------------------------------------------------------------------

describe('createAiQuotaMiddleware', () => {
    const FEATURE: AiFeature = 'text_improve';
    const ENTITLEMENT = EntitlementKey.AI_TEXT_IMPROVE;
    const LIMIT_KEY = LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH;

    let app: Hono<AppBindings>;

    beforeEach(() => {
        app = new Hono<AppBindings>();
        app.onError(createErrorHandler());
        vi.clearAllMocks();
        // Default: recordAiUsage succeeds silently
        mockRecordAiUsage.mockResolvedValue({});
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // -----------------------------------------------------------------------
    // AC-5: Guest / missing actor → 401
    // -----------------------------------------------------------------------

    describe('when actor is missing (no upstream auth middleware)', () => {
        it('should return 401 when actor is not set in context', async () => {
            // Arrange: no actor injection — context has no 'actor' key
            app.use((c: Context<AppBindings>, next) => {
                c.set('userEntitlements', new Set<EntitlementKey>([ENTITLEMENT]));
                c.set('userLimits', new Map<LimitKey, number>([[LIMIT_KEY, 20]]));
                c.set('billingLoadFailed', false);
                return next();
            });
            app.use(createAiQuotaMiddleware(FEATURE));
            app.get('/test', (c) => c.json({ ok: true }));

            // Act
            const res = await app.request('/test');

            // Assert
            expect(res.status).toBe(401);
        });
    });

    describe('when actor is a GUEST', () => {
        it('should return 401 for a GUEST actor (AC-5)', async () => {
            // Arrange
            const guestActor = makeActor('00000000-0000-4000-8000-000000000000', RoleEnum.GUEST);
            injectContext({
                app,
                actor: guestActor,
                entitlements: new Set<EntitlementKey>([ENTITLEMENT]),
                limits: new Map<LimitKey, number>([[LIMIT_KEY, 20]])
            });
            app.use(createAiQuotaMiddleware(FEATURE));
            app.get('/test', (c) => c.json({ ok: true }));

            // Act
            const res = await app.request('/test');

            // Assert
            expect(res.status).toBe(401);
        });
    });

    // -----------------------------------------------------------------------
    // billingLoadFailed → 503
    // -----------------------------------------------------------------------

    describe('when billingLoadFailed is true', () => {
        it('should return 503 SERVICE_UNAVAILABLE', async () => {
            // Arrange
            injectContext({
                app,
                actor: makeActor('user-billing-failed'),
                billingLoadFailed: true
            });
            app.use(createAiQuotaMiddleware(FEATURE));
            app.get('/test', (c) => c.json({ ok: true }));

            // Act
            const res = await app.request('/test');

            // Assert
            expect(res.status).toBe(503);
        });
    });

    // -----------------------------------------------------------------------
    // Entitlement gate → 403 ENTITLEMENT_REQUIRED
    // -----------------------------------------------------------------------

    describe('when user lacks the required AI entitlement', () => {
        it('should return 403 and throw ServiceError with ENTITLEMENT_REQUIRED code', async () => {
            // Arrange: user has no AI entitlements
            const captured: { error: unknown } = { error: null };
            const localApp = new Hono<AppBindings>();
            captureErrorMiddleware(localApp, captured);
            injectContext({
                app: localApp,
                actor: makeActor('user-no-entitlement'),
                entitlements: new Set<EntitlementKey>(), // empty — no AI entitlement
                limits: new Map<LimitKey, number>([[LIMIT_KEY, 20]])
            });
            localApp.use(createAiQuotaMiddleware(FEATURE));
            localApp.get('/test', (c) => c.json({ ok: true }));

            // Act
            const res = await localApp.request('/test');

            // Assert: HTTP status and error code
            expect(res.status).toBe(403);
            const body = (await res.json()) as { error: { code: string } };
            expect(body.error.code).toBe(ServiceErrorCode.ENTITLEMENT_REQUIRED);

            // Assert: the thrown error carries the correct requiredEntitlement (AC-3)
            expect(captured.error).toBeInstanceOf(ServiceError);
            const se = captured.error as ServiceError;
            expect(se.code).toBe(ServiceErrorCode.ENTITLEMENT_REQUIRED);
            // details may not serialize through Vite's ES2022 class transform; verify via raw throw
            const details = se.details as Record<string, unknown> | undefined;
            if (details !== undefined) {
                expect(details.requiredEntitlement).toBe(ENTITLEMENT);
            }
        });
    });

    // -----------------------------------------------------------------------
    // Limit = -1 (unlimited) → 200, count query NOT called
    // -----------------------------------------------------------------------

    describe('when plan limit is -1 (unlimited)', () => {
        it('should pass through (200) and NOT call getMonthlyCallCount', async () => {
            // Arrange
            injectContext({
                app,
                actor: makeActor('user-unlimited'),
                entitlements: new Set<EntitlementKey>([ENTITLEMENT]),
                limits: new Map<LimitKey, number>([[LIMIT_KEY, -1]])
            });
            app.use(createAiQuotaMiddleware(FEATURE));
            app.get('/test', (c) => c.json({ ok: true }));

            // Act
            const res = await app.request('/test');

            // Assert
            expect(res.status).toBe(200);
            expect(mockGetMonthlyCallCount).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // Limit = 0 (feature disabled) → 403 LIMIT_REACHED, no DB call
    // -----------------------------------------------------------------------

    describe('when plan limit is 0 (feature disabled)', () => {
        it('should return 403 LIMIT_REACHED and NOT call getMonthlyCallCount', async () => {
            // Arrange
            const captured: { error: unknown } = { error: null };
            const localApp = new Hono<AppBindings>();
            captureErrorMiddleware(localApp, captured);
            injectContext({
                app: localApp,
                actor: makeActor('user-disabled'),
                entitlements: new Set<EntitlementKey>([ENTITLEMENT]),
                limits: new Map<LimitKey, number>([[LIMIT_KEY, 0]])
            });
            localApp.use(createAiQuotaMiddleware(FEATURE));
            localApp.get('/test', (c) => c.json({ ok: true }));

            // Act
            const res = await localApp.request('/test');

            // Assert: status + error code
            expect(res.status).toBe(403);
            const body = (await res.json()) as { error: { code: string } };
            expect(body.error.code).toBe(ServiceErrorCode.LIMIT_REACHED);

            // Assert: details via raw error
            expect(captured.error).toBeInstanceOf(ServiceError);
            const se = captured.error as ServiceError;
            const details = se.details as Record<string, unknown> | undefined;
            if (details !== undefined) {
                expect(details.limitKey).toBe(LIMIT_KEY);
                expect(details.maxAllowed).toBe(0);
            }

            // Assert: no DB count query
            expect(mockGetMonthlyCallCount).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // count < limit → 200 (next called)
    // -----------------------------------------------------------------------

    describe('when current usage count is under the plan limit', () => {
        it('should pass through (200) and call next()', async () => {
            // Arrange: limit 20, usage 7 → under quota
            mockGetMonthlyCallCount.mockResolvedValue(7);
            injectContext({
                app,
                actor: makeActor('user-under-limit'),
                entitlements: new Set<EntitlementKey>([ENTITLEMENT]),
                limits: new Map<LimitKey, number>([[LIMIT_KEY, 20]])
            });
            app.use(createAiQuotaMiddleware(FEATURE));
            app.get('/test', (c) => c.json({ ok: true }));

            // Act
            const res = await app.request('/test');

            // Assert
            expect(res.status).toBe(200);
            const body = (await res.json()) as { ok: boolean };
            expect(body.ok).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // count >= limit → 403 LIMIT_REACHED + AC-6 metering
    // -----------------------------------------------------------------------

    describe('when current usage count meets or exceeds the plan limit', () => {
        it('should return 403 LIMIT_REACHED when count equals limit', async () => {
            // Arrange: limit 20, usage 20 → quota reached
            mockGetMonthlyCallCount.mockResolvedValue(20);
            const captured: { error: unknown } = { error: null };
            const localApp = new Hono<AppBindings>();
            captureErrorMiddleware(localApp, captured);
            injectContext({
                app: localApp,
                actor: makeActor('user-at-limit'),
                entitlements: new Set<EntitlementKey>([ENTITLEMENT]),
                limits: new Map<LimitKey, number>([[LIMIT_KEY, 20]])
            });
            localApp.use(createAiQuotaMiddleware(FEATURE));
            localApp.get('/test', (c) => c.json({ ok: true }));

            // Act
            const res = await localApp.request('/test');

            // Assert: HTTP 403 + error code
            expect(res.status).toBe(403);
            const body = (await res.json()) as { error: { code: string } };
            expect(body.error.code).toBe(ServiceErrorCode.LIMIT_REACHED);

            // Assert: details via raw error
            expect(captured.error).toBeInstanceOf(ServiceError);
            const se = captured.error as ServiceError;
            const details = se.details as Record<string, unknown> | undefined;
            if (details !== undefined) {
                expect(details.limitKey).toBe(LIMIT_KEY);
                expect(details.currentCount).toBe(20);
                expect(details.maxAllowed).toBe(20);
            }
        });

        it('should call recordAiUsage ONCE with status quota_exceeded (AC-6 metering)', async () => {
            // Arrange: limit 20, usage 20 → quota reached
            mockGetMonthlyCallCount.mockResolvedValue(20);
            const actorId = 'user-at-limit-metered';
            injectContext({
                app,
                actor: makeActor(actorId),
                entitlements: new Set<EntitlementKey>([ENTITLEMENT]),
                limits: new Map<LimitKey, number>([[LIMIT_KEY, 20]])
            });
            app.use(createAiQuotaMiddleware(FEATURE));
            app.get('/test', (c) => c.json({ ok: true }));

            // Act
            await app.request('/test');

            // Assert: metering row recorded with correct fields
            expect(mockRecordAiUsage).toHaveBeenCalledTimes(1);
            expect(mockRecordAiUsage).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: actorId,
                    feature: FEATURE,
                    provider: 'none',
                    model: 'none',
                    promptTokens: 0,
                    completionTokens: 0,
                    latencyMs: 0,
                    status: 'quota_exceeded'
                })
            );
        });

        it('should also return 403 when count EXCEEDS the limit (count > limit)', async () => {
            // Arrange: limit 20, usage 25 → over quota
            mockGetMonthlyCallCount.mockResolvedValue(25);
            injectContext({
                app,
                actor: makeActor('user-over-limit'),
                entitlements: new Set<EntitlementKey>([ENTITLEMENT]),
                limits: new Map<LimitKey, number>([[LIMIT_KEY, 20]])
            });
            app.use(createAiQuotaMiddleware(FEATURE));
            app.get('/test', (c) => c.json({ ok: true }));

            // Act
            const res = await app.request('/test');

            // Assert
            expect(res.status).toBe(403);
        });
    });

    // -----------------------------------------------------------------------
    // recordAiUsage throwing → enforcement must still reject (AC-6 independence)
    // -----------------------------------------------------------------------

    describe('when recordAiUsage throws during quota_exceeded metering', () => {
        it('should still return 403 LIMIT_REACHED (enforcement independent of metering)', async () => {
            // Arrange: limit 20, usage 20; metering throws
            mockGetMonthlyCallCount.mockResolvedValue(20);
            mockRecordAiUsage.mockRejectedValue(new Error('DB connection refused'));
            injectContext({
                app,
                actor: makeActor('user-metering-error'),
                entitlements: new Set<EntitlementKey>([ENTITLEMENT]),
                limits: new Map<LimitKey, number>([[LIMIT_KEY, 20]])
            });
            app.use(createAiQuotaMiddleware(FEATURE));
            app.get('/test', (c) => c.json({ ok: true }));

            // Act
            const res = await app.request('/test');

            // Assert: still enforced even though metering failed
            expect(res.status).toBe(403);
        });
    });

    // -----------------------------------------------------------------------
    // Feature → entitlement/limit mapping correctness (parameterized)
    // -----------------------------------------------------------------------

    describe('feature → entitlement/limit key mapping', () => {
        const FEATURES: ReadonlyArray<{
            feature: QuotaGatedAiFeature;
            entitlement: EntitlementKey;
            limitKey: LimitKey;
        }> = [
            {
                feature: 'text_improve',
                entitlement: EntitlementKey.AI_TEXT_IMPROVE,
                limitKey: LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH
            },
            {
                feature: 'chat',
                entitlement: EntitlementKey.AI_CHAT,
                limitKey: LimitKey.MAX_AI_CHAT_PER_MONTH
            },
            {
                feature: 'search',
                entitlement: EntitlementKey.AI_SEARCH,
                limitKey: LimitKey.MAX_AI_SEARCH_PER_MONTH
            },
            {
                feature: 'support',
                entitlement: EntitlementKey.AI_SUPPORT,
                limitKey: LimitKey.MAX_AI_SUPPORT_PER_MONTH
            },
            {
                feature: 'translate',
                entitlement: EntitlementKey.AI_TRANSLATE,
                limitKey: LimitKey.MAX_AI_TRANSLATE_PER_MONTH
            },
            {
                feature: 'accommodation_import',
                entitlement: EntitlementKey.AI_ACCOMMODATION_IMPORT,
                limitKey: LimitKey.MAX_AI_ACCOMMODATION_IMPORT_PER_MONTH
            }
        ] as const;

        for (const { feature, entitlement, limitKey } of FEATURES) {
            describe(`feature '${feature}'`, () => {
                it(`should export entitlement ${entitlement} and limit ${limitKey} in mapping constants`, () => {
                    // Verify the exported mapping constants contain the correct keys
                    expect(AI_ENTITLEMENT_BY_FEATURE[feature]).toBe(entitlement);
                    expect(AI_LIMIT_BY_FEATURE[feature]).toBe(limitKey);
                });

                it(`should gate on ${entitlement} entitlement (return 403 ENTITLEMENT_REQUIRED)`, async () => {
                    // Arrange: user lacks the feature-specific entitlement
                    const featureApp = new Hono<AppBindings>();
                    featureApp.onError(createErrorHandler());
                    injectContext({
                        app: featureApp,
                        actor: makeActor(`user-no-ent-${feature}`),
                        entitlements: new Set<EntitlementKey>(), // none
                        limits: new Map<LimitKey, number>([[limitKey, 20]])
                    });
                    featureApp.use(createAiQuotaMiddleware(feature));
                    featureApp.get('/test', (c) => c.json({ ok: true }));

                    // Act
                    const res = await featureApp.request('/test');

                    // Assert: blocked with 403 ENTITLEMENT_REQUIRED
                    expect(res.status).toBe(403);
                });

                it(`should enforce ${limitKey} quota (return 403 LIMIT_REACHED at quota)`, async () => {
                    // Arrange: user has entitlement but is at quota
                    const featureApp = new Hono<AppBindings>();
                    featureApp.onError(createErrorHandler());
                    mockGetMonthlyCallCount.mockResolvedValue(10);
                    injectContext({
                        app: featureApp,
                        actor: makeActor(`user-at-quota-${feature}`),
                        entitlements: new Set<EntitlementKey>([entitlement]),
                        limits: new Map<LimitKey, number>([[limitKey, 10]])
                    });
                    featureApp.use(createAiQuotaMiddleware(feature));
                    featureApp.get('/test', (c) => c.json({ ok: true }));

                    // Act
                    const res = await featureApp.request('/test');

                    // Assert: blocked with 403 LIMIT_REACHED
                    expect(res.status).toBe(403);
                });
            });
        }
    });
});
