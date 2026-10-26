import { PermissionEnum, RoleEnum, VerticalEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';

type CapturedRoute = {
    requiredPermissions?: readonly unknown[];
    handler: (ctx: unknown, params: unknown, body: unknown) => Promise<unknown>;
};
const { captured, moderate } = vi.hoisted(() => ({
    captured: [] as CapturedRoute[],
    moderate: vi.fn()
}));
vi.mock('../../../src/utils/route-factory', () => ({
    createAdminRoute: (config: CapturedRoute) => {
        captured.push(config);
        return config;
    }
}));
vi.mock('../../../src/utils/actor', () => ({
    getActorFromContext: () => ({
        id: 'admin',
        roles: [RoleEnum.ADMIN],
        permissions: [PermissionEnum.LISTING_MODERATE]
    })
}));
vi.mock('../../../src/services/listing-publication/listing-moderation.service', () => ({
    ListingModerationService: class {
        moderate = moderate;
    }
}));

await import('../../../src/routes/accommodation/admin/moderate');
await import('../../../src/routes/venue/admin/moderate');
await import('../../../src/routes/experience/admin/moderate');

describe('TEST:V6:12 listing moderation route adapters', () => {
    it('TEST:V6:12 declares only LISTING_MODERATE and delegates with each vertical', async () => {
        const body = { action: 'TAKE_DOWN', reason: 'policy' };
        for (const [index, vertical] of [
            VerticalEnum.ACCOMMODATION,
            VerticalEnum.VENUE,
            VerticalEnum.EXPERIENCE
        ].entries()) {
            const route = captured[index];
            if (!route) throw new Error(`Route ${index} was not registered`);
            expect(route.requiredPermissions).toEqual([PermissionEnum.LISTING_MODERATE]);
            moderate.mockResolvedValueOnce({ ok: true });
            await route.handler({ auth: true }, { id: 'listing-id' }, body);
            expect(moderate).toHaveBeenLastCalledWith({
                actor: expect.objectContaining({ id: 'admin' }),
                vertical,
                id: 'listing-id',
                body
            });
        }
    });

    it('TEST:V6:12 rethrows service errors', async () => {
        const error = new Error('service error');
        moderate.mockRejectedValueOnce(error);
        const route = captured[0];
        if (!route) throw new Error('Accommodation route was not registered');
        await expect(
            route.handler({}, { id: 'listing-id' }, { action: 'TAKE_DOWN', reason: 'x' })
        ).rejects.toBe(error);
    });
});
