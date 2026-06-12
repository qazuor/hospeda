/**
 * Tests for admin AI prompts routes (SPEC-173 T-028).
 *
 * Uses the handler-capture-via-mock pattern.
 * Key invariants:
 * - list returns versions for a feature with pagination.
 * - create calls createPromptVersion with actorId.
 * - activate calls activatePromptVersion and returns 404 when not found.
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

const { capturedAdminHandlers } = vi.hoisted(() => ({
    capturedAdminHandlers: new Map<string, CapturedHandler>()
}));

const { capturedListHandlers } = vi.hoisted(() => ({
    capturedListHandlers: new Map<string, CapturedHandler>()
}));

const { mockCreatePromptVersion, mockActivatePromptVersion, mockListPromptVersionsByFeature } =
    vi.hoisted(() => ({
        mockCreatePromptVersion: vi.fn(),
        mockActivatePromptVersion: vi.fn(),
        mockListPromptVersionsByFeature: vi.fn()
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
    createAdminRoute: vi.fn((config: { path: string; handler: CapturedHandler }) => {
        capturedAdminHandlers.set(config.path, config.handler);
        return config.handler;
    }),
    createAdminListRoute: vi.fn((config: { path: string; handler: CapturedHandler }) => {
        capturedListHandlers.set(config.path, config.handler);
        return config.handler;
    })
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
        createPromptVersion: mockCreatePromptVersion,
        activatePromptVersion: mockActivatePromptVersion,
        listPromptVersionsByFeature: mockListPromptVersionsByFeature,
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
await import('../../../src/routes/ai/prompts/index');

const fakeCtx = {} as unknown;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PROMPT_ROW_V1 = {
    id: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
    feature: 'text_improve',
    version: 1,
    content: 'You are a writing assistant.',
    isActive: true,
    createdBy: mockActor.id,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
    deletedById: null
};

const PROMPT_ROW_V2 = {
    ...PROMPT_ROW_V1,
    id: 'cccccccc-cccc-4ccc-cccc-cccccccccccc',
    version: 2,
    content: 'You are an expert writing assistant.',
    isActive: false
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('admin AI prompts routes (SPEC-173 T-028)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ---- List ---------------------------------------------------------------

    describe('GET / (list prompt versions)', () => {
        it('registers the list route', () => {
            expect(capturedListHandlers.has('/')).toBe(true);
        });

        it('returns paginated versions for a feature (desc order from storage)', async () => {
            mockListPromptVersionsByFeature.mockResolvedValue([PROMPT_ROW_V2, PROMPT_ROW_V1]);

            const handler = capturedListHandlers.get('/') as CapturedHandler;
            const res = (await handler(fakeCtx, undefined, undefined, {
                feature: 'text_improve'
            })) as { items: (typeof PROMPT_ROW_V1)[]; pagination: unknown };

            expect(res.items).toHaveLength(2);
            expect(res.items[0]?.version).toBe(2);
            expect(res.items[1]?.version).toBe(1);
        });

        it('calls listPromptVersionsByFeature with the feature param', async () => {
            mockListPromptVersionsByFeature.mockResolvedValue([]);

            const handler = capturedListHandlers.get('/') as CapturedHandler;
            await handler(fakeCtx, undefined, undefined, { feature: 'chat' });

            expect(mockListPromptVersionsByFeature).toHaveBeenCalledWith(
                expect.objectContaining({ feature: 'chat' })
            );
        });

        it('passes includeDeleted=true when query param is set', async () => {
            mockListPromptVersionsByFeature.mockResolvedValue([]);

            const handler = capturedListHandlers.get('/') as CapturedHandler;
            await handler(fakeCtx, undefined, undefined, {
                feature: 'text_improve',
                includeDeleted: 'true'
            });

            expect(mockListPromptVersionsByFeature).toHaveBeenCalledWith(
                expect.objectContaining({ includeDeleted: true })
            );
        });
    });

    // ---- Create -------------------------------------------------------------

    describe('POST / (create prompt version)', () => {
        it('registers the create route', () => {
            expect(capturedAdminHandlers.has('/')).toBe(true);
        });

        it('calls createPromptVersion with feature, content, isActive, actorId', async () => {
            mockCreatePromptVersion.mockResolvedValue(PROMPT_ROW_V1);

            const handler = capturedAdminHandlers.get('/') as CapturedHandler;
            const res = await handler(fakeCtx, undefined, {
                feature: 'text_improve',
                content: 'You are a writing assistant.',
                isActive: true
            });

            expect(mockCreatePromptVersion).toHaveBeenCalledWith(
                expect.objectContaining({
                    feature: 'text_improve',
                    content: 'You are a writing assistant.',
                    isActive: true,
                    actorId: mockActor.id
                })
            );
            expect((res as typeof PROMPT_ROW_V1).version).toBe(1);
        });

        it('defaults isActive to true (schema default)', async () => {
            mockCreatePromptVersion.mockResolvedValue(PROMPT_ROW_V1);

            const handler = capturedAdminHandlers.get('/') as CapturedHandler;
            await handler(fakeCtx, undefined, {
                feature: 'text_improve',
                content: 'prompt text'
                // isActive omitted — schema defaults to true
            });

            expect(mockCreatePromptVersion).toHaveBeenCalledWith(
                expect.objectContaining({ isActive: true })
            );
        });

        it('passes rules to createPromptVersion when provided', async () => {
            const rowWithRules = { ...PROMPT_ROW_V1, rules: 'Always respond in Spanish.' };
            mockCreatePromptVersion.mockResolvedValue(rowWithRules);

            const handler = capturedAdminHandlers.get('/') as CapturedHandler;
            const res = await handler(fakeCtx, undefined, {
                feature: 'text_improve',
                content: 'You are a writing assistant.',
                isActive: true,
                rules: 'Always respond in Spanish.'
            });

            expect(mockCreatePromptVersion).toHaveBeenCalledWith(
                expect.objectContaining({ rules: 'Always respond in Spanish.' })
            );
            expect((res as typeof rowWithRules).rules).toBe('Always respond in Spanish.');
        });

        it('passes rules as undefined when not provided (leaves it null/undefined on the row)', async () => {
            mockCreatePromptVersion.mockResolvedValue(PROMPT_ROW_V1);

            const handler = capturedAdminHandlers.get('/') as CapturedHandler;
            await handler(fakeCtx, undefined, {
                feature: 'text_improve',
                content: 'prompt text'
                // rules omitted
            });

            const call = mockCreatePromptVersion.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(call.rules).toBeUndefined();
        });
    });

    // ---- Activate -----------------------------------------------------------

    describe('PUT /{id}/activate', () => {
        it('registers the activate route', () => {
            expect(capturedAdminHandlers.has('/{id}/activate')).toBe(true);
        });

        it('calls activatePromptVersion with the id and returns the row', async () => {
            const activatedRow = { ...PROMPT_ROW_V1, isActive: true };
            mockActivatePromptVersion.mockResolvedValue(activatedRow);

            const handler = capturedAdminHandlers.get('/{id}/activate') as CapturedHandler;
            const res = await handler(fakeCtx, { id: PROMPT_ROW_V1.id });

            expect(mockActivatePromptVersion).toHaveBeenCalledWith(
                expect.objectContaining({ id: PROMPT_ROW_V1.id })
            );
            expect((res as typeof PROMPT_ROW_V1).isActive).toBe(true);
        });

        it('throws NOT_FOUND when activatePromptVersion returns null', async () => {
            mockActivatePromptVersion.mockResolvedValue(null);

            const handler = capturedAdminHandlers.get('/{id}/activate') as CapturedHandler;
            await expect(handler(fakeCtx, { id: 'nonexistent-uuid' })).rejects.toThrow('not found');
        });
    });
});
