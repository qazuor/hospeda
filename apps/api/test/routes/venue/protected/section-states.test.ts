import { PermissionEnum, PublicationStatusEnum, type VerticalEnum } from '@repo/schemas';
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
let ownerKeys: string[] = ['edit_venue_info'];
const effectiveRead = vi.fn();

vi.mock('../../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        loadFacts: async () => ({
            facts: { ownerId, publicationStatus: PublicationStatusEnum.PUBLISHED, businessLines },
            ownerId
        }),
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
    it('resolves the owner plan and all menu traits, including for action 15 support', async () => {
        const own = await app().request(`/${VENUE}/sections`);
        const ownBody = await own.json();
        expect(own.status).toBe(200);
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
        expect(supportBody.data.sections.menu.state).toBe('locked');
        expect(effectiveRead).toHaveBeenLastCalledWith({ userId: OWNER, vertical: 'venue' });
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
