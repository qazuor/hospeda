import {
    PermissionEnum,
    PublicationStatusEnum,
    RoleEnum,
    ServiceErrorCode,
    VerticalEnum
} from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createErrorHandler } from '../../../src/middlewares/response';
import { adminAddMediaRoute } from '../../../src/routes/accommodation/admin/addMedia';
import { adminInspectSubscriptionRoute } from '../../../src/routes/billing-subscription/admin/inspect';
import { protectedReadSubscriptionRoute } from '../../../src/routes/billing-subscription/read';
import type { AppBindings } from '../../../src/types';

const mocks = vi.hoisted(() => ({
    read: vi.fn(),
    audit: vi.fn(),
    loadFacts: vi.fn(),
    coverage: vi.fn(),
    effectiveSet: vi.fn(),
    gallery: vi.fn(),
    getById: vi.fn(),
    addMedia: vi.fn()
}));

vi.mock('../../../src/routes/billing-subscription/read-subscription', () => ({
    readSubscription: mocks.read
}));
vi.mock('../../../src/utils/audit-logger', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    auditLog: mocks.audit
}));
vi.mock('../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        loadFacts: mocks.loadFacts,
        billing: { coverage: mocks.coverage },
        effectiveSet: mocks.effectiveSet
    })
}));
vi.mock('@repo/db', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    accommodationMediaModel: { findByAccommodation: mocks.gallery }
}));
vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    AccommodationService: class {
        getById = mocks.getById;
        addMedia = mocks.addMedia;
    }
}));

const ACCOUNT_A = '11111111-1111-4111-8111-111111111111';
const ACCOUNT_B = '22222222-2222-4222-8222-222222222222';
const ADMIN = '33333333-3333-4333-8333-333333333333';
const SUBSCRIPTION = '44444444-4444-4444-8444-444444444444';
const LISTING = '55555555-5555-4555-8555-555555555555';
const row = {
    id: SUBSCRIPTION,
    userId: ACCOUNT_B,
    vertical: 'accommodation',
    status: 'ACTIVE',
    class: 'PRINCIPAL',
    paymentMethod: 'CARD',
    nextChargeAt: null,
    serviceEndsAt: null,
    createdAt: new Date('2026-10-01T00:00:00.000Z')
};
const baseSource = {
    type: 'BASE',
    reference: { kind: 'PLAN_VERSION', planVersionId: 'base' },
    scope: 'VERTICAL',
    target: null,
    since: new Date('2026-01-01'),
    until: 'NEVER_EXPIRES',
    charged: null,
    floor: null
};

function app(actorId: string, permissions: PermissionEnum[]) {
    const router = new Hono<AppBindings>();
    router.onError(createErrorHandler());
    router.use((ctx, next) => {
        ctx.set('actor', {
            id: actorId,
            roles: [actorId === ADMIN ? RoleEnum.ADMIN : RoleEnum.USER],
            permissions,
            emailVerified: true
        });
        return next();
    });
    router.route('/protected/billing-subscription', protectedReadSubscriptionRoute);
    router.route('/admin/billing-subscription', adminInspectSubscriptionRoute);
    router.route('/admin/accommodations', adminAddMediaRoute);
    return router;
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.read.mockImplementation(async (id: string) =>
        id === SUBSCRIPTION ? { row, subjectId: row.userId } : null
    );
    mocks.loadFacts.mockResolvedValue({
        facts: { ownerId: ACCOUNT_B, publicationStatus: PublicationStatusEnum.PUBLISHED },
        ownerId: ACCOUNT_B
    });
    mocks.coverage.mockResolvedValue({ covered: false, sources: [baseSource] });
    mocks.effectiveSet.mockImplementation(async ({ userId }: { userId: string }) =>
        rehydrateEffectiveSet({
            version: 1,
            userId,
            vertical: VerticalEnum.ACCOMMODATION,
            hasLiveNonTrialTitle: false,
            entries: [
                { key: 'edit_accommodation_info', value: 1, strategy: 'MAX' },
                {
                    key: 'max_photos_per_accommodation',
                    value: userId === ACCOUNT_B ? 10 : 100,
                    strategy: 'SUM'
                }
            ]
        })
    );
    mocks.gallery.mockResolvedValue({ total: 10 });
    mocks.getById.mockResolvedValue({ data: { id: LISTING } });
    mocks.addMedia.mockResolvedValue({
        data: {
            media: {
                id: crypto.randomUUID(),
                accommodationId: LISTING,
                url: 'https://example.com/photo.jpg',
                moderationState: 'APPROVED',
                state: 'visible',
                isFeatured: false,
                sortOrder: 9,
                createdAt: new Date(),
                updatedAt: new Date()
            }
        }
    });
});

describe('TEST:V5:9 subscription subjects and action 15 owner limit', () => {
    it('gives the same 404 for a foreign and missing subscription, and reads the own row', async () => {
        const path = `/protected/billing-subscription/${SUBSCRIPTION}`;
        const caller = app(ACCOUNT_A, [PermissionEnum.BILLING_VIEW_OWN]);
        const foreign = await caller.request(path);
        const missing = await caller.request(
            `/protected/billing-subscription/${crypto.randomUUID()}`
        );
        expect(foreign.status).toBe(404);
        expect((await foreign.json()).error).toEqual((await missing.json()).error);
        expect((await app(ACCOUNT_B, [PermissionEnum.BILLING_VIEW_OWN]).request(path)).status).toBe(
            200
        );
    });

    it('checks inspection permission before reading and audits the subject from the row', async () => {
        const path = `/admin/billing-subscription/${SUBSCRIPTION}?subjectId=${ACCOUNT_A}`;
        const denied = await app(ADMIN, [PermissionEnum.ACCESS_PANEL_ADMIN]).request(path);
        expect(denied.status).toBe(403);
        expect(mocks.read).not.toHaveBeenCalled();
        const allowed = await app(ADMIN, [
            PermissionEnum.ACCESS_PANEL_ADMIN,
            PermissionEnum.BILLING_SUBSCRIPTION_INSPECT
        ]).request(path);
        expect(allowed.status).toBe(200);
        expect(mocks.audit).toHaveBeenCalledWith(
            expect.objectContaining({
                auditEvent: 'billing.read',
                actorId: ADMIN,
                resourceType: 'subscription',
                resourceId: SUBSCRIPTION,
                metadata: { subjectId: ACCOUNT_B }
            })
        );
    });

    it('enforces the owner photo limit and reaches the service when restoring to ten', async () => {
        const permissions = [
            PermissionEnum.ACCESS_PANEL_ADMIN,
            PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT
        ];
        const path = `/admin/accommodations/${LISTING}/media`;
        const post = () =>
            app(ADMIN, permissions).request(path, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ url: 'https://example.com/photo.jpg' })
            });
        const denied = await post();
        expect(denied.status).toBe(403);
        expect((await denied.json()).error).toMatchObject({
            code: ServiceErrorCode.LIMIT_REACHED,
            details: { limitKey: 'max_photos_per_accommodation', maxAllowed: 10 }
        });
        expect(mocks.addMedia).not.toHaveBeenCalled();
        mocks.gallery.mockResolvedValue({ total: 9 });
        expect((await post()).status).toBe(201);
        expect(mocks.addMedia).toHaveBeenCalledOnce();
        expect(mocks.effectiveSet).toHaveBeenCalledWith({
            userId: ACCOUNT_B,
            vertical: VerticalEnum.ACCOMMODATION
        });
        expect(mocks.effectiveSet).not.toHaveBeenCalledWith(
            expect.objectContaining({ userId: ADMIN })
        );
    });
});
