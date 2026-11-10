import {
    EntitlementKeyEnum,
    PermissionEnum,
    PublicationStatusEnum,
    type VerticalEnum
} from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types.js';

const OWNER = '11111111-1111-4111-8111-111111111111';
const SUPPORT = '22222222-2222-4222-8222-222222222222';
const VENUE = '33333333-3333-4333-8333-333333333333';
let actorId = OWNER;
let actorPermissions: PermissionEnum[] = [];
let ownerId = OWNER;
let businessLines: string[] = ['food'];
let listingType = 'RESTAURANT';
let ownerKeys: string[] = ['edit_venue_info'];
const effectiveRead = vi.fn();
const loadFacts = vi.fn(async () => ({
    facts: {
        ownerId,
        publicationStatus: PublicationStatusEnum.PUBLISHED,
        businessLines,
        type: listingType
    },
    ownerId
}));

vi.mock('../../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        loadFacts,
        billing: { coverage: async () => ({ covered: false, sources: [{ type: 'BASE' }] }) },
        effectiveSet: effectiveRead
    })
}));
const { protectedGetVenueSectionStatesRoute } = await import(
    '../../../../src/routes/venue/protected/sectionStates.js'
);
const { createErrorHandler } = await import('../../../../src/middlewares/response.js');

function app() {
    const instance = new Hono<AppBindings>();
    instance.onError(createErrorHandler());
    instance.use((ctx, next) => {
        ctx.set('actor', { id: actorId, roles: [], permissions: actorPermissions } as never);
        return next();
    });
    instance.route('/', protectedGetVenueSectionStatesRoute);
    return instance;
}

beforeEach(() => {
    vi.clearAllMocks();
    actorId = OWNER;
    ownerId = OWNER;
    businessLines = ['food'];
    listingType = 'RESTAURANT';
    ownerKeys = ['edit_venue_info'];
    actorPermissions = [];
    effectiveRead.mockImplementation(
        async ({ userId, vertical }: { userId: string; vertical: VerticalEnum }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical,
                hasLiveNonTrialTitle: false,
                inheritsTouristVip: false,
                entries: (userId === OWNER
                    ? ownerKeys
                    : ['edit_venue_info', 'manage_venue_menu']
                ).map((key) => ({ key, value: 1, strategy: 'MAX' }))
            })
    );
});

describe('TEST:3.5:1 AC:3:7 venue section states over protected HTTP route', () => {
    it('TEST:3.12:4 returns 503 when the effective set cannot be read', async () => {
        effectiveRead.mockRejectedValueOnce(new Error('unavailable'));
        const response = await app().request(`/${VENUE}/sections`);
        expect(response.status).toBe(503);
        expect((await response.json()).error.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('TEST:3.12:4 regression — ServiceError(SERVICE_UNAVAILABLE) keeps 503 through the real HTTP route', async () => {
        // The route throws `ServiceError`, not `HTTPException`; this is the case
        // that used to answer 500 when the handler and the route factory imported
        // two different ServiceError classes under the test resolver.
        effectiveRead.mockRejectedValueOnce(new Error('unavailable'));
        const response = await app().request(`/${VENUE}/sections`);
        const body = await response.json();
        expect(response.status).toBe(503);
        expect(body.error).toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
    });

    it('resolves the owner plan and all menu traits, including for action 15 support', async () => {
        const own = await app().request(`/${VENUE}/sections`);
        const ownBody = await own.json();
        expect(own.status).toBe(200);
        expect(loadFacts).toHaveBeenCalledTimes(1);
        expect(ownBody.data.sections.menu).toEqual({
            state: 'locked',
            traits: {
                itemPhotos: 'locked',
                translations: 'locked',
                qr: 'locked',
                qrMetrics: 'locked'
            }
        });

        actorId = SUPPORT;
        actorPermissions = [PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT];
        const support = await app().request(`/${VENUE}/sections`);
        const supportBody = await support.json();
        expect(support.status).toBe(200);
        expect(loadFacts).toHaveBeenCalledTimes(2);
        expect(supportBody.data.sections.menu.state).toBe('locked');
        expect(effectiveRead).toHaveBeenLastCalledWith({ userId: OWNER, vertical: 'venue' });
    });

    it('TEST:5.7:3 resolves the map for a hypothetical business-line selection', async () => {
        // The owner editor asks this before saving a removal: nightInfo must be
        // visible under the hypothetical selection, and the STORED row is not
        // modified by the read.
        const response = await app().request(`/${VENUE}/sections?businessLines=nightlife`);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.sections.nightInfo.state).toBe('available');
        expect(body.data.sections.menu.state).toBe('absent');
        expect(businessLines).toEqual(['food']);
    });

    it('TEST:5.7:3 rejects hypothetical lines that the listing type does not admit', async () => {
        listingType = 'HELADERIA';
        const response = await app().request(`/${VENUE}/sections?businessLines=nightlife`);
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error.code).toBe('VALIDATION_ERROR');
        expect(body.error.details).toMatchObject({
            field: 'businessLines',
            reason: 'NOT_ALLOWED_FOR_TYPE'
        });
    });

    it('hides a foreign listing without action 15 and resolves nightlife/multi-line sections', async () => {
        actorId = SUPPORT;
        expect((await app().request(`/${VENUE}/sections`)).status).toBe(404);
        actorId = OWNER;
        businessLines = ['nightlife'];
        const nightlife = await (await app().request(`/${VENUE}/sections`)).json();
        expect(nightlife.data.sections.menu).toMatchObject({
            state: 'absent',
            traits: { itemPhotos: 'absent' }
        });
        expect(nightlife.data.sections.nightInfo.state).toBe('available');
        businessLines = ['food', 'nightlife'];
        const multi = await (await app().request(`/${VENUE}/sections`)).json();
        expect(multi.data.multiLine).toBe(true);
    });
});

/**
 * TEST:7.4:2 (AC:7:5, the read half). The map a support member gets is the
 * OWNER's plan map: even when the support member's own plan is Premium, the
 * route evaluates the owner's effective set, so `menu` stays `locked` exactly
 * where the owner sees it locked. The engines compare the whole `data` object,
 * not just `menu`, so an ambient key leaking into any other section fails too.
 */
const BASIC_VENUE_KEYS = [EntitlementKeyEnum.EDIT_VENUE_INFO] as const;
const PREMIUM_VENUE_KEYS = [
    EntitlementKeyEnum.EDIT_VENUE_INFO,
    EntitlementKeyEnum.MANAGE_VENUE_MENU,
    EntitlementKeyEnum.MENU_ITEM_PHOTOS,
    EntitlementKeyEnum.MULTILINGUAL_VENUE_MENU,
    EntitlementKeyEnum.MENU_QR_SCAN_METRICS,
    EntitlementKeyEnum.MANAGE_VENUE_DAILY_SPECIAL,
    EntitlementKeyEnum.MANAGE_VENUE_EVENTS
] as const;

function planKeysFor(userId: string): readonly string[] {
    return userId === SUPPORT ? PREMIUM_VENUE_KEYS : BASIC_VENUE_KEYS;
}

describe('TEST:7.4:2 AC:7:5 the support map equals the owner plan map', () => {
    beforeEach(() => {
        effectiveRead.mockImplementation(
            async ({ userId, vertical }: { userId: string; vertical: VerticalEnum }) =>
                rehydrateEffectiveSet({
                    version: 1,
                    userId,
                    vertical,
                    hasLiveNonTrialTitle: false,
                    inheritsTouristVip: false,
                    entries: planKeysFor(userId).map((key) => ({
                        key,
                        value: 1,
                        strategy: 'MAX'
                    }))
                })
        );
    });

    async function ownerAndSupportMaps() {
        actorId = OWNER;
        actorPermissions = [];
        const own = await app().request(`/${VENUE}/sections`);
        actorId = SUPPORT;
        actorPermissions = [PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT];
        const support = await app().request(`/${VENUE}/sections`);
        return {
            own: { status: own.status, body: await own.json() },
            support: { status: support.status, body: await support.json() }
        };
    }

    it('with businessLines [food]: support sees exactly the owner map and every menu trait locked', async () => {
        const { own, support } = await ownerAndSupportMaps();

        expect(own.status).toBe(200);
        expect(support.status).toBe(200);
        expect(support.body.data).toEqual(own.body.data);
        expect(support.body.data.sections.menu).toEqual({
            state: 'locked',
            traits: {
                itemPhotos: 'locked',
                translations: 'locked',
                qr: 'locked',
                qrMetrics: 'locked'
            }
        });
        expect(effectiveRead).not.toHaveBeenCalledWith({
            userId: SUPPORT,
            vertical: 'venue'
        });
    });

    it('with businessLines [food, nightlife]: the two whole maps still match', async () => {
        businessLines = ['food', 'nightlife'];
        const { own, support } = await ownerAndSupportMaps();

        expect(own.status).toBe(200);
        expect(support.status).toBe(200);
        expect(own.body.data.multiLine).toBe(true);
        expect(support.body.data).toEqual(own.body.data);
        expect(support.body.data.sections.menu.state).toBe('locked');
        expect(effectiveRead).not.toHaveBeenCalledWith({
            userId: SUPPORT,
            vertical: 'venue'
        });
    });
});

describe('TEST:3.5:3 response schema', () => {
    it('rejects an unknown section id', async () => {
        const { VenueListingSectionStatesSchema } = await import('@repo/schemas');
        const response = await (await app().request(`/${VENUE}/sections`)).json();
        expect(VenueListingSectionStatesSchema.safeParse(response.data).success).toBe(true);
        expect(
            VenueListingSectionStatesSchema.safeParse({
                ...response.data,
                sections: {
                    ...response.data.sections,
                    invented: { state: 'available', traits: {} }
                }
            }).success
        ).toBe(false);
    });
});
