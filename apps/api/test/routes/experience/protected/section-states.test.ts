import { PublicationStatusEnum, type VerticalEnum } from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types.js';

const OWNER = '11111111-1111-4111-8111-111111111111';
const EXPERIENCE = '33333333-3333-4333-8333-333333333333';
let keys: string[] = ['edit_experience_info'];
const effectiveRead = vi.fn();
const loadFacts = vi.fn(async () => ({
    facts: {
        ownerId: OWNER,
        publicationStatus: PublicationStatusEnum.PUBLISHED,
        businessLines: []
    },
    ownerId: OWNER
}));
vi.mock('../../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        loadFacts,
        billing: { coverage: async () => ({ covered: false, sources: [{ type: 'BASE' }] }) },
        effectiveSet: effectiveRead
    })
}));
const { protectedGetExperienceSectionStatesRoute } = await import(
    '../../../../src/routes/experience/protected/sectionStates.js'
);
const { createErrorHandler } = await import('../../../../src/middlewares/response.js');
function app() {
    const instance = new Hono<AppBindings>();
    instance.onError(createErrorHandler());
    instance.use((ctx, next) => {
        ctx.set('actor', { id: OWNER, roles: [], permissions: [] } as never);
        return next();
    });
    instance.route('/', protectedGetExperienceSectionStatesRoute);
    return instance;
}
beforeEach(() => {
    vi.clearAllMocks();
    keys = ['edit_experience_info'];
    effectiveRead.mockImplementation(
        async ({ userId, vertical }: { userId: string; vertical: VerticalEnum }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical,
                hasLiveNonTrialTitle: false,
                inheritsTouristVip: false,
                entries: keys.map((key) => ({ key, value: 1, strategy: 'MAX' }))
            })
    );
});
describe('TEST:3.5:2 experience section states', () => {
    it('reflects the owner key in meetingPoint.directions', async () => {
        const denied = await (await app().request(`/${EXPERIENCE}/sections`)).json();
        expect(loadFacts).toHaveBeenCalledTimes(1);
        expect(denied.data.sections.meetingPoint.traits.directions).toBe('locked');
        keys = ['edit_experience_info', 'manage_experience_directions'];
        const allowed = await (await app().request(`/${EXPERIENCE}/sections`)).json();
        expect(loadFacts).toHaveBeenCalledTimes(2);
        expect(allowed.data.sections.meetingPoint.traits.directions).toBe('available');
    });
});
