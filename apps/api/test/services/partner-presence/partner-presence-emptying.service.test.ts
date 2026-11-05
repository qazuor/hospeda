import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    row: null as Record<string, unknown> | null,
    lockRow: null as Record<string, unknown> | null,
    deletions: [] as string[],
    calls: [] as string[],
    invalidations: [] as unknown[],
    schedules: [] as unknown[],
    events: [] as unknown[],
    failSchedule: false,
    systemActor: false
}));

vi.mock('@repo/db', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/db')>();
    const schema = await vi.importActual<typeof import('@repo/db/schemas')>('@repo/db/schemas');
    return {
        ...original,
        partners: schema.partners,
        getDb: () => ({
            select: () => ({ from: () => ({ where: () => ({ limit: async () => [mocks.row] }) }) }),
            transaction: async (run: (tx: unknown) => unknown) => run({})
        }),
        PartnerModel: class {
            lockById = async () => mocks.lockRow;
            emptyPresenceContent = async () => {
                mocks.calls.push('empty');
            };
        },
        domainEventModel: {
            insert: async (value: unknown) => {
                mocks.events.push(value);
            }
        }
    };
});
vi.mock('../../../src/middlewares/cache', () => ({
    invalidateCacheByPathPrefix: (value: unknown) => mocks.invalidations.push(value)
}));
vi.mock('../../../src/utils/logger', () => ({ apiLogger: { error: vi.fn(), warn: vi.fn() } }));
vi.mock('@repo/service-core', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...original,
        getRevalidationService: () => ({
            scheduleRevalidation: (value: unknown) => {
                mocks.schedules.push(value);
                if (mocks.failSchedule) throw new Error('schedule failed');
            }
        }),
        isSystemActor: () => mocks.systemActor
    };
});

import { PermissionEnum } from '@repo/schemas';
import { emptyPartnerPresence } from '../../../src/services/partner-presence/partner-presence-emptying.service';

const partnerRow = (overrides: Record<string, unknown> = {}) => ({
    id: '11111111-1111-4111-8111-111111111111',
    slug: 'partner-test',
    ownerUserId: 'owner-id',
    logoUrl: 'https://images.pexels.com/a.png',
    pendingLogoUrl: null,
    description: 'text',
    websiteUrl: null,
    contactInfo: null,
    socialNetworks: null,
    pendingDescription: null,
    pendingWebsiteUrl: null,
    contentReviewState: 'pending',
    contentReviewNote: null,
    ...overrides
});
const actor = {
    id: 'admin-id',
    permissions: [PermissionEnum.PARTNER_EMPTY_PRESENCE],
    roles: [],
    isAuthenticated: true
} as never;
const deps = {
    mediaProvider: {
        delete: vi.fn(async ({ publicId }: { publicId: string }) => {
            mocks.calls.push('delete');
            mocks.deletions.push(publicId);
            return { wasPresent: true };
        })
    },
    cloudName: 'hospeda-test',
    clock: { now: () => new Date('2026-01-01T00:00:00.000Z') }
};

describe('emptyPartnerPresence', () => {
    beforeEach(() => {
        mocks.row = partnerRow();
        mocks.lockRow = partnerRow();
        mocks.deletions = [];
        mocks.calls = [];
        mocks.invalidations = [];
        mocks.schedules = [];
        mocks.events = [];
        mocks.failSchedule = false;
        mocks.systemActor = false;
        deps.mediaProvider.delete.mockClear();
    });

    it('invalidates cache and schedules revalidation once after the transaction succeeds', async () => {
        mocks.failSchedule = true;
        await expect(
            emptyPartnerPresence(
                { actor, partnerId: String(mocks.row?.id), reason: ' reason ' },
                deps
            )
        ).resolves.toMatchObject({
            clearedFields: ['logo_url', 'description', 'content_review_state'],
            remoteAssetsDeleted: 0,
            remoteAssetsSkipped: 1
        });
        expect(mocks.invalidations).toEqual([{ pathPrefix: '/api/v1/public/partners' }]);
        expect(mocks.schedules).toEqual([
            { entityType: 'partner', id: mocks.row?.id, slug: 'partner-test' }
        ]);
        expect(mocks.events).toHaveLength(1);
        expect(mocks.events[0]).toMatchObject({ reason: 'reason' });
    });

    it('does not call the provider when authorization fails or presence is already empty', async () => {
        const noPermission = {
            id: 'admin-id',
            permissions: [],
            roles: [],
            isAuthenticated: true
        } as never;
        await expect(
            emptyPartnerPresence(
                { actor: noPermission, partnerId: String(mocks.row?.id), reason: 'reason' },
                deps
            )
        ).rejects.toMatchObject({ code: 'FORBIDDEN' });
        mocks.row = partnerRow({ logoUrl: null, description: null, contentReviewState: null });
        await expect(
            emptyPartnerPresence(
                { actor, partnerId: String(mocks.row?.id), reason: 'reason' },
                deps
            )
        ).rejects.toMatchObject({ reason: 'PRESENCE_ALREADY_EMPTY' });
        expect(deps.mediaProvider.delete).not.toHaveBeenCalled();
    });

    it('rejects system actors and an owner acting on their own Partner before remote deletion', async () => {
        const systemActor = actor;
        mocks.systemActor = true;
        await expect(
            emptyPartnerPresence(
                { actor: systemActor, partnerId: String(mocks.row?.id), reason: 'reason' },
                deps
            )
        ).rejects.toMatchObject({ code: 'FORBIDDEN' });
        mocks.systemActor = false;
        const ownerActor = {
            id: 'owner-id',
            permissions: [PermissionEnum.PARTNER_EMPTY_PRESENCE],
            roles: [],
            isAuthenticated: true
        } as never;
        await expect(
            emptyPartnerPresence(
                { actor: ownerActor, partnerId: String(mocks.row?.id), reason: 'reason' },
                deps
            )
        ).rejects.toMatchObject({ code: 'FORBIDDEN' });
        expect(deps.mediaProvider.delete).not.toHaveBeenCalled();
    });

    it('deletes planned external assets before clearing content and skips empty plans', async () => {
        const asset =
            'https://res.cloudinary.com/hospeda-test/image/upload/v1/hospeda/partner/logo.png';
        mocks.row = partnerRow({ logoUrl: asset, pendingLogoUrl: null });
        mocks.lockRow = partnerRow({ logoUrl: asset, pendingLogoUrl: null });
        await expect(
            emptyPartnerPresence({ actor, partnerId: String(mocks.row.id), reason: 'reason' }, deps)
        ).resolves.toMatchObject({ remoteAssetsDeleted: 1 });
        expect(mocks.calls).toEqual(['delete', 'empty']);
        mocks.calls = [];
        mocks.row = partnerRow({ logoUrl: null, pendingLogoUrl: null });
        mocks.lockRow = partnerRow({ logoUrl: null, pendingLogoUrl: null });
        await emptyPartnerPresence(
            { actor, partnerId: String(mocks.row.id), reason: 'reason' },
            deps
        );
        expect(mocks.calls).toEqual(['empty']);
    });
});
