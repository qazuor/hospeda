/**
 * Unit tests for the owner self-service experience DRAFT delete route (HOS-1156 T-015,
 * AC-14): `DELETE /api/v1/protected/experiences/{id}`.
 *
 * The route factory is mocked to hand back its own config, so the route's
 * contract (method, path, tag, no staff permission) and its handler can be
 * asserted without booting the app. The service is a spy: what is under test is
 * the pass-through of the service's own result, including the error contract
 * (`apps/api/docs/error-contract.md`) — a foreign, missing or already-deleted
 * row is the service's NOT_FOUND (404, never 403), a non-DRAFT row its
 * validation refusal.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('../../../../src/utils/route-factory', () => ({
    createProtectedRoute: vi.fn((config: unknown) => config)
}));

const { mockSoftDeleteOwnDraft } = vi.hoisted(() => ({ mockSoftDeleteOwnDraft: vi.fn() }));
vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        ExperienceService: class MockExperienceService {
            softDeleteOwnDraft = mockSoftDeleteOwnDraft;
        }
    };
});

vi.mock('../../../../src/utils/actor', () => ({
    getActorFromContext: (ctx: { get: (key: string) => unknown }) => ctx.get('actor')
}));

import { protectedDeleteExperienceDraftRoute } from '../../../../src/routes/experience/protected/deleteDraft';

type RouteConfig = {
    method: string;
    path: string;
    tags: string[];
    requiredPermissions?: unknown;
    handler: (ctx: unknown, params: Record<string, unknown>) => Promise<unknown>;
};
const route = protectedDeleteExperienceDraftRoute as unknown as RouteConfig;

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const LISTING_ID = '00000000-0000-4000-a000-000000000001';
const ctx = { get: vi.fn((key: string) => (key === 'actor' ? { id: OWNER_ID } : undefined)) };

beforeEach(() => {
    vi.clearAllMocks();
    mockSoftDeleteOwnDraft.mockResolvedValue({ data: { deleted: true } });
});

describe('protectedDeleteExperienceDraftRoute', () => {
    it('is DELETE /{id}, tagged Experience, with no staff permission (ownership is the gate)', () => {
        expect(route.method).toBe('delete');
        expect(route.path).toBe('/{id}');
        expect(route.tags).toEqual(['Experience']);
        expect(route.requiredPermissions).toBeUndefined();
    });

    it('deletes through the experience service as the calling actor', async () => {
        const result = await route.handler(ctx, { id: LISTING_ID });

        expect(result).toEqual({ deleted: true });
        expect(mockSoftDeleteOwnDraft).toHaveBeenCalledWith({ id: OWNER_ID }, LISTING_ID);
    });

    it('surfaces a foreign or missing listing as NOT_FOUND, never FORBIDDEN', async () => {
        mockSoftDeleteOwnDraft.mockResolvedValue({
            error: { code: 'NOT_FOUND', message: 'experience not found' }
        });

        await expect(route.handler(ctx, { id: LISTING_ID })).rejects.toMatchObject({
            code: 'NOT_FOUND'
        });
    });

    it('rejects a malformed id before reaching the service', async () => {
        await expect(route.handler(ctx, { id: 'not-a-uuid' })).rejects.toThrow();
        expect(mockSoftDeleteOwnDraft).not.toHaveBeenCalled();
    });
});
