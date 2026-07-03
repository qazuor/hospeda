/**
 * Tests for admin social credential vault routes (HOS-64 G-4, T-026/T-027).
 *
 * Uses the handler-capture-via-mock pattern (mirrors test/routes/ai/credentials.test.ts):
 * - Mock `createAdminRoute` / `createAdminListRoute` to capture handlers by path.
 * - Mock `getActorFromContext` as SUPER_ADMIN.
 * - Mock the credential vault service functions.
 * - Assert service is called with the right args; response never contains secrets.
 *
 * Audit-row-per-mutation (AC-5) is proven at the service layer
 * (test/services/social-credential-vault.service.test.ts, T-018/T-019) — each
 * service call here asserts exactly one call to the mocked mutation function,
 * consistent with that guarantee.
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

// createAdminRoute is mocked below to capture handlers by path only, but
// PATCH /{key} and DELETE /{key} share the same path string — keying by
// `${method} ${path}` keeps them distinct.
type CapturedRouteConfig = { method: string; path: string; handler: CapturedHandler };

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { capturedAdminHandlers } = vi.hoisted(() => ({
    capturedAdminHandlers: new Map<string, CapturedHandler>()
}));

const { capturedListHandlers } = vi.hoisted(() => ({
    capturedListHandlers: new Map<string, CapturedHandler>()
}));

const {
    mockListCredentials,
    mockCreateCredential,
    mockRotateCredential,
    mockUpdateCredentialMetadata,
    mockDeleteCredential
} = vi.hoisted(() => ({
    mockListCredentials: vi.fn(),
    mockCreateCredential: vi.fn(),
    mockRotateCredential: vi.fn(),
    mockUpdateCredentialMetadata: vi.fn(),
    mockDeleteCredential: vi.fn()
}));

const { mockActor } = vi.hoisted(() => ({
    mockActor: {
        id: '11111111-1111-4111-8111-111111111111',
        role: 'SUPER_ADMIN',
        permissions: ['socialSettings.manage']
    }
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../../src/utils/route-factory', () => ({
    createAdminRoute: vi.fn((config: CapturedRouteConfig) => {
        capturedAdminHandlers.set(`${config.method} ${config.path}`, config.handler);
        return config.handler;
    }),
    createAdminListRoute: vi.fn((config: { path: string; handler: CapturedHandler }) => {
        capturedListHandlers.set(config.path, config.handler);
        return config.handler;
    })
}));

vi.mock('../../../../src/utils/actor', () => ({
    getActorFromContext: () => mockActor
}));

vi.mock('../../../../src/utils/create-app', () => ({
    createRouter: () => ({
        route: vi.fn()
    })
}));

vi.mock('../../../../src/middlewares/rate-limit', () => ({
    getClientIp: () => '127.0.0.1'
}));

vi.mock('../../../../src/services/social-credential-vault.service', () => ({
    SOCIAL_CREDENTIAL_KEYS: ['make_webhook_url', 'make_api_key', 'ai_social_key', 'operator_pin'],
    listSocialCredentials: mockListCredentials,
    createSocialCredential: mockCreateCredential,
    rotateSocialCredential: mockRotateCredential,
    updateSocialCredentialMetadata: mockUpdateCredentialMetadata,
    deleteSocialCredential: mockDeleteCredential
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

// Importing the modules runs createAdminRoute/createAdminListRoute and captures handlers.
await import('../../../../src/routes/social/admin/credentials/list');
await import('../../../../src/routes/social/admin/credentials/create');
await import('../../../../src/routes/social/admin/credentials/rotate');
await import('../../../../src/routes/social/admin/credentials/update');
await import('../../../../src/routes/social/admin/credentials/delete');

const fakeCtx = {} as unknown;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MASKED_CREDENTIAL = {
    id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    key: 'make_webhook_url',
    label: 'Production webhook',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('admin social credential vault routes (HOS-64 G-4, T-026)', () => {
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
                expect(item.id).toBe(MASKED_CREDENTIAL.id);
                expect(item.key).toBe('make_webhook_url');
                // CRITICAL: secret fields must never appear
                expect('ciphertext' in item).toBe(false);
                expect('iv' in item).toBe(false);
                expect('authTag' in item).toBe(false);
                expect('plaintext' in item).toBe(false);
            }
        });

        it('passes includeDeleted=true to the service when query param is set', async () => {
            mockListCredentials.mockResolvedValue({ data: { items: [], total: 0 } });

            const handler = capturedListHandlers.get('/') as CapturedHandler;
            await handler(fakeCtx, undefined, undefined, { includeDeleted: 'true' });

            expect(mockListCredentials).toHaveBeenCalledWith({ includeDeleted: true });
        });

        it('defaults includeDeleted to false when the query param is absent', async () => {
            mockListCredentials.mockResolvedValue({ data: { items: [], total: 0 } });

            const handler = capturedListHandlers.get('/') as CapturedHandler;
            await handler(fakeCtx, undefined, undefined, undefined);

            expect(mockListCredentials).toHaveBeenCalledWith({ includeDeleted: false });
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
            expect(capturedAdminHandlers.has('post /')).toBe(true);
        });

        it('calls service with actorId + ipAddress and returns {id, key}', async () => {
            const expectedResult = { id: MASKED_CREDENTIAL.id, key: 'make_webhook_url' };
            mockCreateCredential.mockResolvedValue({ data: expectedResult });

            const handler = capturedAdminHandlers.get('post /') as CapturedHandler;
            const res = (await handler(fakeCtx, undefined, {
                key: 'make_webhook_url',
                plaintext: 'https://hook.make.com/secret'
            })) as { id: string; key: string };

            expect(mockCreateCredential).toHaveBeenCalledWith(
                expect.objectContaining({
                    actorId: mockActor.id,
                    ipAddress: '127.0.0.1',
                    key: 'make_webhook_url',
                    plaintext: 'https://hook.make.com/secret'
                })
            );

            // Response must not contain the plaintext or ciphertext.
            expect(res.id).toBe(MASKED_CREDENTIAL.id);
            expect(res.key).toBe('make_webhook_url');
            expect('plaintext' in res).toBe(false);
            expect('ciphertext' in res).toBe(false);
        });

        it('throws when the service returns an error (e.g. duplicate active key)', async () => {
            mockCreateCredential.mockResolvedValue({
                error: { code: 'VALIDATION_ERROR', message: 'already exists' }
            });

            const handler = capturedAdminHandlers.get('post /') as CapturedHandler;
            await expect(
                handler(fakeCtx, undefined, { key: 'make_webhook_url', plaintext: 'x' })
            ).rejects.toThrow('already exists');
        });
    });

    // ---- Rotate ---------------------------------------------------------------

    describe('POST /{key}/rotate', () => {
        it('registers the rotate route', () => {
            expect(capturedAdminHandlers.has('post /{key}/rotate')).toBe(true);
        });

        it('calls rotateSocialCredential once with actorId + ipAddress and returns {id, key}', async () => {
            mockRotateCredential.mockResolvedValue({
                data: { id: 'new-id', key: 'make_webhook_url' }
            });

            const handler = capturedAdminHandlers.get('post /{key}/rotate') as CapturedHandler;
            const res = (await handler(
                fakeCtx,
                { key: 'make_webhook_url' },
                { newPlaintext: 'https://hook.make.com/new-secret' }
            )) as { id: string; key: string };

            expect(mockRotateCredential).toHaveBeenCalledTimes(1);
            expect(mockRotateCredential).toHaveBeenCalledWith(
                expect.objectContaining({
                    actorId: mockActor.id,
                    ipAddress: '127.0.0.1',
                    key: 'make_webhook_url',
                    newPlaintext: 'https://hook.make.com/new-secret'
                })
            );
            expect(res.id).toBe('new-id');
            expect('newPlaintext' in res).toBe(false);
            expect('ciphertext' in res).toBe(false);
        });

        it('throws NOT_FOUND when no active credential exists for the key', async () => {
            mockRotateCredential.mockResolvedValue({
                error: {
                    code: 'NOT_FOUND',
                    message: "No active credential found for key 'make_webhook_url'"
                }
            });

            const handler = capturedAdminHandlers.get('post /{key}/rotate') as CapturedHandler;
            await expect(
                handler(fakeCtx, { key: 'make_webhook_url' }, { newPlaintext: 'x' })
            ).rejects.toThrow('No active credential found');
        });
    });

    // ---- Update metadata --------------------------------------------------------

    describe('PATCH /{key}', () => {
        it('registers the update route', () => {
            expect(capturedAdminHandlers.has('patch /{key}')).toBe(true);
        });

        it('calls updateSocialCredentialMetadata once with actorId + ipAddress and returns {id, key}', async () => {
            mockUpdateCredentialMetadata.mockResolvedValue({
                data: { id: MASKED_CREDENTIAL.id, key: 'make_webhook_url' }
            });

            const handler = capturedAdminHandlers.get('patch /{key}') as CapturedHandler;
            const res = (await handler(
                fakeCtx,
                { key: 'make_webhook_url' },
                { label: 'New label' }
            )) as { id: string; key: string };

            expect(mockUpdateCredentialMetadata).toHaveBeenCalledTimes(1);
            expect(mockUpdateCredentialMetadata).toHaveBeenCalledWith(
                expect.objectContaining({
                    actorId: mockActor.id,
                    ipAddress: '127.0.0.1',
                    key: 'make_webhook_url',
                    label: 'New label'
                })
            );
            expect(res.id).toBe(MASKED_CREDENTIAL.id);
            expect(res.key).toBe('make_webhook_url');
        });

        it('throws NOT_FOUND when no active credential exists for the key', async () => {
            mockUpdateCredentialMetadata.mockResolvedValue({
                error: {
                    code: 'NOT_FOUND',
                    message: "No active credential found for key 'make_webhook_url'"
                }
            });

            const handler = capturedAdminHandlers.get('patch /{key}') as CapturedHandler;
            await expect(
                handler(fakeCtx, { key: 'make_webhook_url' }, { label: 'x' })
            ).rejects.toThrow('No active credential found');
        });
    });

    // ---- Delete -------------------------------------------------------------

    describe('DELETE /{key}', () => {
        it('registers the delete route', () => {
            expect(capturedAdminHandlers.has('delete /{key}')).toBe(true);
        });

        it('calls deleteSocialCredential once with actorId + ipAddress and returns {key}', async () => {
            mockDeleteCredential.mockResolvedValue({ data: { key: 'make_webhook_url' } });

            const handler = capturedAdminHandlers.get('delete /{key}') as CapturedHandler;
            const res = (await handler(fakeCtx, { key: 'make_webhook_url' })) as { key: string };

            expect(mockDeleteCredential).toHaveBeenCalledTimes(1);
            expect(mockDeleteCredential).toHaveBeenCalledWith(
                expect.objectContaining({
                    actorId: mockActor.id,
                    ipAddress: '127.0.0.1',
                    key: 'make_webhook_url'
                })
            );
            expect(res.key).toBe('make_webhook_url');
        });

        it('throws NOT_FOUND when no active credential exists for the key', async () => {
            mockDeleteCredential.mockResolvedValue({
                error: {
                    code: 'NOT_FOUND',
                    message: "No active credential found for key 'make_webhook_url'"
                }
            });

            const handler = capturedAdminHandlers.get('delete /{key}') as CapturedHandler;
            await expect(handler(fakeCtx, { key: 'make_webhook_url' })).rejects.toThrow(
                'No active credential found'
            );
        });
    });
});
