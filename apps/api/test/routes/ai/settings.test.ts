/**
 * Tests for admin AI settings routes (SPEC-173 T-027).
 *
 * Uses the handler-capture-via-mock pattern.
 * Key invariants:
 * - GET returns the resolved config.
 * - PUT calls saveConfig with the body + actorId.
 * - saveConfig handles cache invalidation internally — assert it was called.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------

type CapturedHandler = (
    ctx: unknown,
    params?: Record<string, unknown>,
    body?: Record<string, unknown>,
    query?: Record<string, unknown>
) => Promise<unknown>;

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { capturedHandlers } = vi.hoisted(() => ({
    capturedHandlers: new Map<string, { method: string; handler: CapturedHandler }>()
}));

const { mockResolveConfig, mockReadAiSettings, mockSaveConfig } = vi.hoisted(() => ({
    mockResolveConfig: vi.fn(),
    mockReadAiSettings: vi.fn(),
    mockSaveConfig: vi.fn()
}));

const { mockActor } = vi.hoisted(() => ({
    mockActor: {
        id: '11111111-1111-4111-8111-111111111111',
        role: 'SUPER_ADMIN',
        permissions: ['ai.settings.manage']
    }
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../src/utils/route-factory', () => ({
    createAdminRoute: vi.fn(
        (config: { method: string; path: string; handler: CapturedHandler }) => {
            capturedHandlers.set(`${config.path}:${config.method}`, {
                method: config.method,
                handler: config.handler
            });
            return config.handler;
        }
    ),
    createAdminListRoute: vi.fn(
        (config: { method: string; path: string; handler: CapturedHandler }) => {
            capturedHandlers.set(`${config.path}:${config.method}`, {
                method: config.method,
                handler: config.handler
            });
            return config.handler;
        }
    )
}));

vi.mock('../../../src/utils/actor', () => ({
    getActorFromContext: () => mockActor
}));

vi.mock('../../../src/utils/create-app', () => ({
    createRouter: () => ({
        route: vi.fn()
    })
}));

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
        resolveConfig: mockResolveConfig,
        readAiSettings: mockReadAiSettings,
        saveConfig: mockSaveConfig,
        AiFeatureNotConfiguredError
    };
});

vi.mock('@repo/service-core', () => ({
    ServiceError: class ServiceError extends Error {
        constructor(
            public readonly code: string,
            message: string
        ) {
            super(message);
            this.name = 'ServiceError';
        }
    }
}));

// Importing the module captures the handlers.
await import('../../../src/routes/ai/settings/index');

const fakeCtx = {} as unknown;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_SETTINGS_BLOB = {
    providers: { openai: { enabled: true } },
    features: {
        text_improve: {
            enabled: true,
            primaryProvider: 'openai',
            fallbackChain: [],
            model: 'gpt-4o-mini',
            params: {}
        },
        chat: {
            enabled: false,
            primaryProvider: 'openai',
            fallbackChain: [],
            model: 'gpt-4o-mini',
            params: {}
        },
        search: {
            enabled: false,
            primaryProvider: 'openai',
            fallbackChain: [],
            model: 'gpt-4o-mini',
            params: {}
        },
        support: {
            enabled: false,
            primaryProvider: 'openai',
            fallbackChain: [],
            model: 'gpt-4o-mini',
            params: {}
        },
        translate: {
            enabled: false,
            primaryProvider: 'openai',
            fallbackChain: [],
            model: 'gpt-4o-mini',
            params: {}
        }
    }
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('admin AI settings routes (SPEC-173 T-027)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ---- GET ----------------------------------------------------------------

    describe('GET / (get settings)', () => {
        it('registers the GET route', () => {
            expect(capturedHandlers.has('/:get')).toBe(true);
        });

        it('returns the resolved config under `value`', async () => {
            mockResolveConfig.mockResolvedValue(VALID_SETTINGS_BLOB);
            mockReadAiSettings.mockResolvedValue(VALID_SETTINGS_BLOB);

            const entry = capturedHandlers.get('/:get');
            const handler = entry?.handler as CapturedHandler;
            const res = (await handler(fakeCtx)) as {
                key: string;
                value: typeof VALID_SETTINGS_BLOB;
                updatedAt: string;
                updatedBy: string;
            };

            expect(res.key).toBe('global');
            expect(res.value).toEqual(VALID_SETTINGS_BLOB);
            expect(typeof res.updatedAt).toBe('string');
            expect(typeof res.updatedBy).toBe('string');
        });

        it('calls resolveConfig once', async () => {
            mockResolveConfig.mockResolvedValue(VALID_SETTINGS_BLOB);
            mockReadAiSettings.mockResolvedValue(null);

            const entry = capturedHandlers.get('/:get');
            const handler = entry?.handler as CapturedHandler;
            await handler(fakeCtx);

            expect(mockResolveConfig).toHaveBeenCalledTimes(1);
        });

        // Regression test: empty DB / first-time setup must return 200 with
        // value.features = {} — NOT throw (which previously caused HTTP 500 via
        // stripWithSchema when AiSettingsResponseSchema validated the full record).
        it('returns 200-shape (no throw) when resolveConfig returns empty features (fresh DB)', async () => {
            // Arrange: the exact shape resolveConfig() returns when ai_settings is empty.
            const emptyConfig = { providers: {}, features: {} };
            mockResolveConfig.mockResolvedValue(emptyConfig);
            mockReadAiSettings.mockResolvedValue(null);

            const entry = capturedHandlers.get('/:get');
            const handler = entry?.handler as CapturedHandler;

            // Act + Assert — must NOT throw; before the fix this would propagate
            // as a ServiceError(INTERNAL_ERROR) → HTTP 500 from stripWithSchema.
            const res = (await handler(fakeCtx)) as {
                key: string;
                value: typeof emptyConfig;
            };

            expect(res.key).toBe('global');
            expect(res.value).toEqual(emptyConfig);
        });
    });

    // ---- PUT ----------------------------------------------------------------

    describe('PUT / (save settings)', () => {
        it('registers the PUT route', () => {
            expect(capturedHandlers.has('/:put')).toBe(true);
        });

        it('calls saveConfig with the body blob and actorId', async () => {
            mockSaveConfig.mockResolvedValue(undefined);

            const entry = capturedHandlers.get('/:put');
            const handler = entry?.handler as CapturedHandler;
            await handler(fakeCtx, undefined, VALID_SETTINGS_BLOB as Record<string, unknown>);

            expect(mockSaveConfig).toHaveBeenCalledWith(
                expect.objectContaining({
                    value: expect.objectContaining({ providers: VALID_SETTINGS_BLOB.providers }),
                    actorId: mockActor.id
                })
            );
        });

        it('returns the saved blob under `value`', async () => {
            mockSaveConfig.mockResolvedValue(undefined);

            const entry = capturedHandlers.get('/:put');
            const handler = entry?.handler as CapturedHandler;
            const res = (await handler(
                fakeCtx,
                undefined,
                VALID_SETTINGS_BLOB as Record<string, unknown>
            )) as { key: string; value: unknown; updatedBy: string };

            expect(res.key).toBe('global');
            expect(res.value).toEqual(VALID_SETTINGS_BLOB);
            expect(res.updatedBy).toBe(mockActor.id);
        });

        it('saveConfig is the only call needed (cache invalidation is internal)', async () => {
            mockSaveConfig.mockResolvedValue(undefined);

            const entry = capturedHandlers.get('/:put');
            const handler = entry?.handler as CapturedHandler;
            await handler(fakeCtx, undefined, VALID_SETTINGS_BLOB as Record<string, unknown>);

            // saveConfig handles validate + persist + invalidate — one call is enough.
            expect(mockSaveConfig).toHaveBeenCalledTimes(1);
        });
    });
});
