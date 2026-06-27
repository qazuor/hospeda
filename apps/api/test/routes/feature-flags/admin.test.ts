import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app.js';
import type { AppOpenAPI } from '../../../src/types.js';

const { mockFeatureFlagService } = vi.hoisted(() => ({
    mockFeatureFlagService: {
        adminList: vi.fn(),
        createFlag: vi.fn(),
        getById: vi.fn(),
        updateFlag: vi.fn(),
        toggleFlag: vi.fn(),
        deleteFlag: vi.fn(),
        getAuditLog: vi.fn()
    }
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        FeatureFlagService: vi.fn().mockImplementation(() => mockFeatureFlagService)
    };
});

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() }
}));

const FLAG_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';

const FEATURE_FLAG = {
    id: FLAG_ID,
    key: 'new-checkout',
    description: 'Enable the new checkout flow',
    enabled: true,
    isActive: true,
    forceOnUserIds: [USER_ID],
    forceOffUserIds: [],
    enabledForRoles: [RoleEnum.ADMIN],
    createdAt: new Date('2025-01-01').toISOString(),
    updatedAt: new Date('2025-01-02').toISOString(),
    createdById: USER_ID,
    updatedById: USER_ID
};

const AUDIT_LOG = [
    {
        id: '33333333-3333-4333-8333-333333333333',
        flagId: FLAG_ID,
        action: 'updated',
        previousValue: { enabled: false },
        newValue: { enabled: true },
        reason: 'Rollout approved',
        performedById: USER_ID,
        createdAt: new Date('2025-01-03').toISOString()
    }
];

function buildAdminActor(permissions: PermissionEnum[]): Actor {
    return {
        id: USER_ID,
        role: RoleEnum.ADMIN,
        permissions: [
            PermissionEnum.ACCESS_PANEL_ADMIN,
            PermissionEnum.ACCESS_API_ADMIN,
            ...permissions
        ]
    };
}

function actorHeaders(actor: Actor): Record<string, string> {
    return {
        'content-type': 'application/json',
        'user-agent': 'vitest',
        accept: 'application/json',
        'x-mock-actor-id': actor.id,
        'x-mock-actor-role': actor.role,
        'x-mock-actor-permissions': JSON.stringify(actor.permissions)
    };
}

describe('Admin feature flag routes (SPEC-276)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('GET /api/v1/admin/flags', () => {
        it('returns 401 without authentication', async () => {
            const res = await app.request('/api/v1/admin/flags', {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });

            expect(res.status).toBe(401);
        });

        it('returns 403 without FEATURE_FLAG_MANAGE permission', async () => {
            const actor = buildAdminActor([]);

            const res = await app.request('/api/v1/admin/flags', {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            expect(res.status).toBe(403);
        });

        it('lists feature flags and forwards admin search query', async () => {
            const actor = buildAdminActor([PermissionEnum.FEATURE_FLAG_MANAGE]);
            mockFeatureFlagService.adminList.mockResolvedValue({
                items: [FEATURE_FLAG],
                pagination: {
                    page: 2,
                    pageSize: 5,
                    total: 1,
                    totalPages: 1,
                    hasNextPage: false,
                    hasPreviousPage: true
                }
            });

            const res = await app.request(
                '/api/v1/admin/flags?page=2&pageSize=5&search=checkout&isActive=true&enabled=true',
                {
                    method: 'GET',
                    headers: actorHeaders(actor)
                }
            );

            expect(res.status).toBe(200);
            expect(mockFeatureFlagService.adminList).toHaveBeenCalledOnce();
            expect(mockFeatureFlagService.adminList).toHaveBeenCalledWith(actor, {
                page: 2,
                pageSize: 5,
                search: 'checkout',
                isActive: true,
                enabled: true,
                includeDeleted: false,
                sort: 'createdAt:desc',
                status: 'all'
            });
        });
    });

    describe('POST /api/v1/admin/flags', () => {
        it('creates a feature flag with valid body', async () => {
            const actor = buildAdminActor([PermissionEnum.FEATURE_FLAG_MANAGE]);
            mockFeatureFlagService.createFlag.mockResolvedValue(FEATURE_FLAG);

            const payload = {
                key: 'new-checkout',
                description: 'Enable the new checkout flow',
                enabled: true,
                isActive: true,
                forceOnUserIds: [USER_ID],
                forceOffUserIds: [],
                enabledForRoles: [RoleEnum.ADMIN]
            };

            const res = await app.request('/api/v1/admin/flags', {
                method: 'POST',
                headers: actorHeaders(actor),
                body: JSON.stringify(payload)
            });

            expect(res.status).toBe(201);
            expect(mockFeatureFlagService.createFlag).toHaveBeenCalledWith(actor, payload);
        });
    });

    describe('GET /api/v1/admin/flags/:id', () => {
        it('returns a flag by id', async () => {
            const actor = buildAdminActor([PermissionEnum.FEATURE_FLAG_MANAGE]);
            mockFeatureFlagService.getById.mockResolvedValue(FEATURE_FLAG);

            const res = await app.request(`/api/v1/admin/flags/${FLAG_ID}`, {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            expect(res.status).toBe(200);
            expect(mockFeatureFlagService.getById).toHaveBeenCalledWith(actor, FLAG_ID);
        });
    });

    describe('PATCH /api/v1/admin/flags/:id', () => {
        it('updates a feature flag with partial body', async () => {
            const actor = buildAdminActor([PermissionEnum.FEATURE_FLAG_MANAGE]);
            mockFeatureFlagService.updateFlag.mockResolvedValue({
                ...FEATURE_FLAG,
                description: 'Updated description',
                enabled: false
            });

            const payload = {
                description: 'Updated description',
                enabled: false
            };

            const res = await app.request(`/api/v1/admin/flags/${FLAG_ID}`, {
                method: 'PATCH',
                headers: actorHeaders(actor),
                body: JSON.stringify(payload)
            });

            expect(res.status).toBe(200);
            expect(mockFeatureFlagService.updateFlag).toHaveBeenCalledWith(actor, FLAG_ID, payload);
        });
    });

    describe('POST /api/v1/admin/flags/:id/toggle', () => {
        it('toggles the kill-switch and forwards reason', async () => {
            const actor = buildAdminActor([PermissionEnum.FEATURE_FLAG_MANAGE]);
            mockFeatureFlagService.toggleFlag.mockResolvedValue({
                ...FEATURE_FLAG,
                isActive: false
            });

            const payload = {
                isActive: false,
                reason: 'Emergency rollback'
            };

            const res = await app.request(`/api/v1/admin/flags/${FLAG_ID}/toggle`, {
                method: 'POST',
                headers: actorHeaders(actor),
                body: JSON.stringify(payload)
            });

            expect(res.status).toBe(201);
            expect(mockFeatureFlagService.toggleFlag).toHaveBeenCalledWith(
                actor,
                FLAG_ID,
                false,
                'Emergency rollback'
            );
        });
    });

    describe('DELETE /api/v1/admin/flags/:id', () => {
        it('deletes a feature flag', async () => {
            const actor = buildAdminActor([PermissionEnum.FEATURE_FLAG_MANAGE]);
            mockFeatureFlagService.deleteFlag.mockResolvedValue(undefined);

            const res = await app.request(`/api/v1/admin/flags/${FLAG_ID}`, {
                method: 'DELETE',
                headers: actorHeaders(actor)
            });

            expect(res.status).toBe(200);
            expect(mockFeatureFlagService.deleteFlag).toHaveBeenCalledWith(actor, FLAG_ID);
        });
    });

    describe('GET /api/v1/admin/flags/:id/audit', () => {
        it('returns the audit log for a flag', async () => {
            const actor = buildAdminActor([PermissionEnum.FEATURE_FLAG_MANAGE]);
            mockFeatureFlagService.getAuditLog.mockResolvedValue(AUDIT_LOG);

            const res = await app.request(`/api/v1/admin/flags/${FLAG_ID}/audit`, {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            expect(res.status).toBe(200);
            expect(mockFeatureFlagService.getAuditLog).toHaveBeenCalledWith(actor, FLAG_ID);
        });
    });
});
