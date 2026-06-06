/**
 * Tests for admin AI credentials routes (SPEC-173 T-026).
 *
 * Uses the handler-capture-via-mock pattern (matches list.test.ts in app-logs):
 * - Mock `createAdminRoute` / `createAdminListRoute` to capture handlers by path.
 * - Mock `getActorFromContext` as SUPER_ADMIN.
 * - Mock the credential vault service functions.
 * - Assert service is called with the right args; response never contains secrets.
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

const { mockListCredentials, mockCreateCredential, mockRotateCredential, mockDeleteCredential } =
    vi.hoisted(() => ({
        mockListCredentials: vi.fn(),
        mockCreateCredential: vi.fn(),
        mockRotateCredential: vi.fn(),
        mockDeleteCredential: vi.fn()
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

vi.mock('../../../src/middlewares/rate-limit', () => ({
    getClientIp: () => '127.0.0.1'
}));

vi.mock('../../../src/services/ai-credential-vault.service', () => ({
    listAiProviderCredentials: mockListCredentials,
    createAiProviderCredential: mockCreateCredential,
    rotateAiProviderCredential: mockRotateCredential,
    deleteAiProviderCredential: mockDeleteCredential
}));

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

// Importing the module runs createAdminRoute/createAdminListRoute and captures handlers.
await import('../../../src/routes/ai/credentials/index');

const fakeCtx = {} as unknown;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MASKED_CREDENTIAL = {
    id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    providerId: 'openai',
    label: 'Production key',
    metadata: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('admin AI credentials routes (SPEC-173 T-026)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ---- List ---------------------------------------------------------------

    describe('GET / (list)', () => {
        it('registers the list route', () => {
            expect(capturedListHandlers.has('/')).toBe(true);
        });

        it('returns paginated masked items with no secret fields', async () => {
            mockListCredentials.mockResolvedValue({
                data: { items: [MASKED_CREDENTIAL], total: 1 }
            });

            const handler = capturedListHandlers.get('/') as CapturedHandler;
            const res = (await handler(fakeCtx, undefined, undefined, undefined)) as {
                items: (typeof MASKED_CREDENTIAL)[];
                pagination: unknown;
            };

            expect(res.items).toHaveLength(1);
            const item = res.items[0];
            expect(item).toBeDefined();
            if (item) {
                // Verify masked fields are present
                expect(item.id).toBe(MASKED_CREDENTIAL.id);
                expect(item.providerId).toBe('openai');
                // CRITICAL: secret fields must never appear
                expect('ciphertext' in item).toBe(false);
                expect('iv' in item).toBe(false);
                expect('authTag' in item).toBe(false);
                expect('plaintextKey' in item).toBe(false);
            }
        });

        it('passes includeDeleted=true to the service when query param is set', async () => {
            mockListCredentials.mockResolvedValue({ data: { items: [], total: 0 } });

            const handler = capturedListHandlers.get('/') as CapturedHandler;
            await handler(fakeCtx, undefined, undefined, { includeDeleted: 'true' });

            expect(mockListCredentials).toHaveBeenCalledWith({ includeDeleted: true });
        });

        it('throws when the service returns an error', async () => {
            mockListCredentials.mockResolvedValue({
                error: { code: 'INTERNAL_ERROR', message: 'db down' }
            });

            const handler = capturedListHandlers.get('/') as CapturedHandler;
            await expect(handler(fakeCtx, undefined, undefined, undefined)).rejects.toThrow(
                'db down'
            );
        });
    });

    // ---- Create -------------------------------------------------------------

    describe('POST / (create)', () => {
        it('registers the create route', () => {
            expect(capturedAdminHandlers.has('/')).toBe(true);
        });

        it('calls service with actor + ipAddress and returns {id, providerId}', async () => {
            const expectedResult = { id: MASKED_CREDENTIAL.id, providerId: 'openai' };
            mockCreateCredential.mockResolvedValue({ data: expectedResult });

            const handler = capturedAdminHandlers.get('/') as CapturedHandler;
            const res = (await handler(fakeCtx, undefined, {
                providerId: 'openai',
                plaintextKey: 'sk-secret'
            })) as { id: string; providerId: string };

            expect(mockCreateCredential).toHaveBeenCalledWith(
                expect.objectContaining({
                    actor: mockActor,
                    ipAddress: '127.0.0.1',
                    providerId: 'openai',
                    plaintextKey: 'sk-secret'
                })
            );

            // Response must not contain plaintext
            expect(res.id).toBe(MASKED_CREDENTIAL.id);
            expect(res.providerId).toBe('openai');
            expect('plaintextKey' in res).toBe(false);
            expect('ciphertext' in res).toBe(false);
        });

        it('throws when the service returns an error', async () => {
            mockCreateCredential.mockResolvedValue({
                error: { code: 'VALIDATION_ERROR', message: 'already exists' }
            });

            const handler = capturedAdminHandlers.get('/') as CapturedHandler;
            await expect(
                handler(fakeCtx, undefined, { providerId: 'openai', plaintextKey: 'sk-x' })
            ).rejects.toThrow('already exists');
        });
    });

    // ---- Rotate -------------------------------------------------------------

    describe('POST /{providerId}/rotate', () => {
        it('registers the rotate route', () => {
            expect(capturedAdminHandlers.has('/{providerId}/rotate')).toBe(true);
        });

        it('calls rotateAiProviderCredential with the correct args', async () => {
            mockRotateCredential.mockResolvedValue({
                data: { id: 'new-id', providerId: 'openai' }
            });

            const handler = capturedAdminHandlers.get('/{providerId}/rotate') as CapturedHandler;
            const res = (await handler(
                fakeCtx,
                { providerId: 'openai' },
                { newPlaintextKey: 'sk-new' }
            )) as { id: string; providerId: string };

            expect(mockRotateCredential).toHaveBeenCalledWith(
                expect.objectContaining({
                    actor: mockActor,
                    providerId: 'openai',
                    newPlaintextKey: 'sk-new'
                })
            );
            expect(res.id).toBe('new-id');
            expect('newPlaintextKey' in res).toBe(false);
        });
    });

    // ---- Delete -------------------------------------------------------------

    describe('DELETE /{providerId}', () => {
        it('registers the delete route', () => {
            expect(capturedAdminHandlers.has('/{providerId}')).toBe(true);
        });

        it('calls deleteAiProviderCredential and returns {providerId}', async () => {
            mockDeleteCredential.mockResolvedValue({ data: { providerId: 'openai' } });

            const handler = capturedAdminHandlers.get('/{providerId}') as CapturedHandler;
            const res = (await handler(fakeCtx, { providerId: 'openai' })) as {
                providerId: string;
            };

            expect(mockDeleteCredential).toHaveBeenCalledWith(
                expect.objectContaining({
                    actor: mockActor,
                    providerId: 'openai'
                })
            );
            expect(res.providerId).toBe('openai');
        });
    });
});
