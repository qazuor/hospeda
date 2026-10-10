import {
    PermissionEnum as P,
    PublicationStatusEnum,
    RoleEnum,
    ServiceErrorCode,
    VerticalEnum
} from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { ADMINISTRATIVE_ACTION_PERMISSION_SET, rehydrateEffectiveSet } from '@repo/verticals';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    loadFacts: vi.fn(),
    coverage: vi.fn(),
    effectiveSet: vi.fn(),
    manualPayment: vi.fn(),
    getDb: vi.fn(),
    adminRoute: vi.fn()
}));

vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/service-core')>()),
    PartnerService: vi.fn(function () {
        return { registerManualPayment: mocks.manualPayment };
    })
}));
vi.mock('@repo/db', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/db')>()),
    getDb: mocks.getDb,
    partners: { id: 'id', ownerUserId: 'ownerUserId' }
}));
vi.mock('../../src/utils/route-factory', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../src/utils/route-factory')>()),
    createAdminRoute: (config: {
        path: string;
        handler: (...args: unknown[]) => Promise<unknown>;
    }) => {
        if (config.path === '/{id}/manual-payment') mocks.adminRoute(config);
        return config;
    }
}));
vi.mock('../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        loadFacts: mocks.loadFacts,
        billing: { coverage: mocks.coverage },
        effectiveSet: mocks.effectiveSet
    })
}));

const FULL = [
    P.CONVERSATION_VIEW_OWN,
    P.CONVERSATION_VIEW_ANY,
    P.CONVERSATION_VIEW_ALL,
    P.CONVERSATION_REPLY_OWN,
    P.CONVERSATION_REPLY_ANY,
    P.CONVERSATION_UPDATE_STATUS_OWN,
    P.CONVERSATION_UPDATE_STATUS_ANY,
    P.CONVERSATION_BLOCK_OWN,
    P.CONVERSATION_BLOCK_ANY,
    P.CONVERSATION_DELETE_ANY
];
const VIEW_THREE = FULL.slice(0, 3);
const VIEW_TWO = FULL.slice(0, 2);
const FOUR = [
    P.CONVERSATION_VIEW_OWN,
    P.CONVERSATION_VIEW_ANY,
    P.CONVERSATION_REPLY_OWN,
    P.CONVERSATION_REPLY_ANY
];
const ARCHIVE_SIX = [...FOUR, P.CONVERSATION_UPDATE_STATUS_OWN, P.CONVERSATION_UPDATE_STATUS_ANY];

const cases = [
    ['conversations/admin/archive', FULL],
    ['conversations/admin/delete', FULL],
    ['conversations/admin/list', FULL],
    ['conversations/admin/reply', FULL],
    ['conversations/admin/thread', FULL],
    ['conversations/admin/unread-count', VIEW_THREE],
    ['conversations/protected/archive', ARCHIVE_SIX],
    ['conversations/protected/initiate', FOUR],
    ['conversations/protected/reply', FOUR],
    ['conversations/protected/thread', FOUR],
    ['conversations/protected/unread-count', VIEW_TWO],
    ['conversations/protected/owner/system-actor', FULL],
    ['conversations/public/guest-reply', FOUR],
    ['conversations/public/guest-thread', FOUR],
    ['conversations/public/initiate', FOUR],
    ['conversations/public/verify', FOUR],
    ['cron/jobs/conversation-notification.job', FULL],
    ['cron/jobs/conversation-token-reminder.job', FULL],
    ['cron/jobs/refresh-external-reputation.job', [P.ACCOMMODATION_UPDATE_ANY]]
] as const;

const jobIdFor = (path: string) =>
    path === 'conversations/protected/owner/system-actor'
        ? 'conversations.protected.owner'
        : path.startsWith('conversations/')
          ? path.replaceAll('/', '.').replace('.system-actor', '')
          : path === 'utils/user-cache'
            ? 'api.user-cache'
            : path.replace('cron/jobs/', 'cron.').replace('.job', '');

const modules: Record<string, () => Promise<unknown>> = {
    '../../src/routes/conversations/admin/archive.ts': () =>
        import('../../src/routes/conversations/admin/archive'),
    '../../src/routes/conversations/admin/delete.ts': () =>
        import('../../src/routes/conversations/admin/delete'),
    '../../src/routes/conversations/admin/list.ts': () =>
        import('../../src/routes/conversations/admin/list'),
    '../../src/routes/conversations/admin/reply.ts': () =>
        import('../../src/routes/conversations/admin/reply'),
    '../../src/routes/conversations/admin/thread.ts': () =>
        import('../../src/routes/conversations/admin/thread'),
    '../../src/routes/conversations/admin/unread-count.ts': () =>
        import('../../src/routes/conversations/admin/unread-count'),
    '../../src/routes/conversations/protected/archive.ts': () =>
        import('../../src/routes/conversations/protected/archive'),
    '../../src/routes/conversations/protected/initiate.ts': () =>
        import('../../src/routes/conversations/protected/initiate'),
    '../../src/routes/conversations/protected/reply.ts': () =>
        import('../../src/routes/conversations/protected/reply'),
    '../../src/routes/conversations/protected/thread.ts': () =>
        import('../../src/routes/conversations/protected/thread'),
    '../../src/routes/conversations/protected/unread-count.ts': () =>
        import('../../src/routes/conversations/protected/unread-count'),
    '../../src/routes/conversations/protected/owner/system-actor.ts': () =>
        import('../../src/routes/conversations/protected/owner/system-actor'),
    '../../src/routes/conversations/public/guest-reply.ts': () =>
        import('../../src/routes/conversations/public/guest-reply'),
    '../../src/routes/conversations/public/guest-thread.ts': () =>
        import('../../src/routes/conversations/public/guest-thread'),
    '../../src/routes/conversations/public/initiate.ts': () =>
        import('../../src/routes/conversations/public/initiate'),
    '../../src/routes/conversations/public/verify.ts': () =>
        import('../../src/routes/conversations/public/verify'),
    '../../src/cron/jobs/conversation-notification.job.ts': () =>
        import('../../src/cron/jobs/conversation-notification.job'),
    '../../src/cron/jobs/conversation-token-reminder.job.ts': () =>
        import('../../src/cron/jobs/conversation-token-reminder.job'),
    '../../src/cron/jobs/refresh-external-reputation.job.ts': () =>
        import('../../src/cron/jobs/refresh-external-reputation.job')
};

describe('TEST:V5:14 — los actores de sistema de la API salen de la fábrica', () => {
    it('construye los 20 actores con roles, permisos y jobId correctos', async () => {
        vi.resetModules();
        const core = await import('@repo/service-core');
        const factory = vi.spyOn(core, 'createSystemActor');
        const seen = new Set<string>();
        for (const [path, permissions] of cases) {
            factory.mockClear();
            const modulePath = path.startsWith('conversations/')
                ? `../../src/routes/${path}.ts`
                : `../../src/${path}.ts`;
            const load = modules[modulePath];
            expect(load, modulePath).toBeDefined();
            await load!();
            const jobId = jobIdFor(path);
            const call = factory.mock.calls.find(([input]) => input.jobId === jobId);
            expect(call, path).toBeDefined();
            expect(call?.[0].permissions, path).toEqual(permissions);
            const result = factory.mock.results[factory.mock.calls.indexOf(call!)];
            if (result?.type !== 'return') throw new Error(`Actor construction failed: ${path}`);
            const actor = result.value as Actor;
            expect(actor.roles, path).toEqual([RoleEnum.SYSTEM]);
            expect(actor.roles, path).not.toContain(RoleEnum.SUPER_ADMIN);
            expect(actor.permissions, path).toEqual(permissions);
            expect(actor.permissions.length, path).toBeLessThan(Object.values(P).length);
            expect(
                actor.permissions.some((permission) =>
                    ADMINISTRATIVE_ACTION_PERMISSION_SET.has(permission)
                ),
                path
            ).toBe(false);
            expect(actor._systemJobId, path).toBe(jobId);
            expect(seen.has(jobId), path).toBe(false);
            seen.add(jobId);
        }
        expect(seen.size).toBe(19);
        factory.mockRestore();
    });

    it('construye el actor de user-cache al leer con USER_READ_ALL', async () => {
        vi.resetModules();
        const core = await import('@repo/service-core');
        const factory = vi.spyOn(core, 'createSystemActor');
        const { UserCache, userCache } = await import('../../src/utils/user-cache');
        const cache = new UserCache();
        const getById = vi.fn().mockResolvedValue({ data: null });
        (cache as unknown as { userService: { getById: typeof getById } }).userService = {
            getById
        };
        try {
            await cache.getUser('44444444-4444-4444-8444-444444444444');
            expect(factory).toHaveBeenCalledWith({
                jobId: 'api.user-cache',
                permissions: [P.USER_READ_ALL]
            });
            const actor = getById.mock.calls[0]?.[0] as Actor;
            expect(actor.roles).toEqual([RoleEnum.SYSTEM]);
            expect(actor.permissions).toEqual([P.USER_READ_ALL]);
            expect(actor._systemJobId).toBe('api.user-cache');
            expect(
                actor.permissions.some((permission) =>
                    ADMINISTRATIVE_ACTION_PERMISSION_SET.has(permission)
                )
            ).toBe(false);
        } finally {
            cache.destroy();
            userCache.destroy();
            factory.mockRestore();
        }
    });

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.loadFacts.mockResolvedValue({
            facts: {
                ownerId: '11111111-1111-4111-8111-111111111111',
                publicationStatus: PublicationStatusEnum.PUBLISHED
            },
            ownerId: '11111111-1111-4111-8111-111111111111'
        });
        mocks.coverage.mockResolvedValue({ covered: true, sources: [{ type: 'BASE' }] });
        mocks.effectiveSet.mockImplementation(async ({ userId }: { userId: string }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical: VerticalEnum.ACCOMMODATION,
                hasLiveNonTrialTitle: false,
                entries: [{ key: 'edit_accommodation_info', value: 1, strategy: 'MAX' }]
            })
        );
    });

    it('rechaza en el paso 3 la edición de una ficha ajena aunque el sistema lleve el permiso', async () => {
        const { enforceListingAccess } = await import('../../src/middlewares/listing-access');
        const actor = {
            id: '22222222-2222-4222-8222-222222222222',
            roles: [RoleEnum.SYSTEM],
            permissions: [P.LISTING_FOREIGN_CONTENT_EDIT],
            _isSystemActor: true
        } satisfies Actor;
        const ctx = { get: (key: string) => (key === 'actor' ? actor : undefined), set: vi.fn() };
        await expect(
            enforceListingAccess({
                ctx: ctx as never,
                params: { id: '33333333-3333-4333-8333-333333333333' },
                config: { vertical: VerticalEnum.ACCOMMODATION, operation: 'EDIT' },
                tier: 'admin'
            })
        ).rejects.toMatchObject({ code: ServiceErrorCode.FORBIDDEN });
        expect(mocks.coverage).not.toHaveBeenCalled();
    });

    it('rechaza el pago manual antes de llamar al servicio aunque el sistema lleve el permiso', async () => {
        const ownerId = '11111111-1111-4111-8111-111111111111';
        const actor = {
            id: '22222222-2222-4222-8222-222222222222',
            roles: [RoleEnum.SYSTEM],
            permissions: [P.PARTNER_MANAGE],
            _isSystemActor: true
        } satisfies Actor;
        const limit = vi.fn().mockResolvedValue([{ ownerUserId: ownerId }]);
        mocks.getDb.mockReturnValue({
            select: () => ({ from: () => ({ where: () => ({ limit }) }) })
        });
        await import('../../src/routes/partners/admin/manual-payment');
        const config = mocks.adminRoute.mock.calls[0]?.[0] as {
            handler: (...args: unknown[]) => Promise<unknown>;
        };
        expect(config).toBeDefined();
        const ctx = { get: (key: string) => (key === 'actor' ? actor : undefined) };
        await expect(
            config.handler(ctx, { id: '33333333-3333-4333-8333-333333333333' }, {})
        ).rejects.toMatchObject({ code: ServiceErrorCode.FORBIDDEN });
        expect(mocks.manualPayment).not.toHaveBeenCalled();
    });
});
