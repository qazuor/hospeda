import { UserModel } from '@repo/db';
import { PermissionEnum, VerticalEnum } from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';
import { getListingAccessPorts } from '../../../../src/utils/listing-access/ports.js';

vi.mock('../../../../src/utils/listing-access/ports.js', () => ({
    getListingAccessPorts: vi.fn()
}));

const USER_ID = '11111111-1111-4111-8111-111111111111';
const base = `/api/v1/admin/users/${USER_ID}/effective-set`;
const effectiveSet = vi.fn();

const snapshot = (vertical: VerticalEnum, entries: { key: string; value: number }[]) =>
    rehydrateEffectiveSet({
        version: 1,
        userId: USER_ID,
        vertical,
        hasLiveNonTrialTitle: false,
        entries: entries.map(({ key, value }) => ({ key, value, strategy: 'MAX' as const }))
    });

const headers = (permissions: string[] = [PermissionEnum.BILLING_SUBSCRIPTION_INSPECT]) => ({
    authorization: 'Bearer mock-token',
    'user-agent': 'vitest',
    'x-mock-actor-id': USER_ID,
    'x-mock-actor-role': 'ADMIN',
    'x-mock-actor-permissions': JSON.stringify([PermissionEnum.ACCESS_PANEL_ADMIN, ...permissions])
});

describe('TEST:B13a:23 AC:B13a:23 admin effective set route', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(UserModel.prototype, 'findById').mockResolvedValue({ id: USER_ID } as never);
        vi.mocked(getListingAccessPorts).mockReturnValue({ effectiveSet } as never);
        effectiveSet.mockResolvedValue(
            snapshot(VerticalEnum.ACCOMMODATION, [
                { key: 'respond_reviews', value: 1 },
                { key: 'max_accommodations', value: Number.POSITIVE_INFINITY }
            ])
        );
    });

    it('returns only resolved catalog keys, encoding Infinity', async () => {
        const response = await app.request(`${base}?vertical=accommodation`, {
            headers: headers()
        });
        expect(response.status).toBe(200);
        expect(((await response.json()) as { data: unknown }).data).toStrictEqual({
            userId: USER_ID,
            vertical: 'accommodation',
            hasLiveNonTrialTitle: false,
            entitlements: { respond_reviews: 1 },
            limits: { max_accommodations: 'Infinity' }
        });
    });

    it('asks the port for the requested vertical', async () => {
        effectiveSet.mockImplementation(async ({ vertical }) =>
            vertical === VerticalEnum.GASTRONOMY
                ? snapshot(VerticalEnum.GASTRONOMY, [{ key: 'manage_gastronomy_menu', value: 1 }])
                : snapshot(VerticalEnum.ACCOMMODATION, [{ key: 'respond_reviews', value: 1 }])
        );
        const accommodation = await app.request(`${base}?vertical=accommodation`, {
            headers: headers()
        });
        const gastronomy = await app.request(`${base}?vertical=gastronomy`, { headers: headers() });
        expect(((await accommodation.json()) as { data: unknown }).data).not.toStrictEqual(
            ((await gastronomy.json()) as { data: unknown }).data
        );
        expect(effectiveSet).toHaveBeenCalledWith({
            userId: USER_ID,
            vertical: VerticalEnum.ACCOMMODATION
        });
        expect(effectiveSet).toHaveBeenCalledWith({
            userId: USER_ID,
            vertical: VerticalEnum.GASTRONOMY
        });
    });

    it('returns 400 for invalid vertical', async () => {
        expect((await app.request(`${base}?vertical=nope`, { headers: headers() })).status).toBe(
            400
        );
    });
    it('returns 404 for missing user', async () => {
        vi.mocked(UserModel.prototype.findById).mockResolvedValue(null);
        expect(
            (await app.request(`${base}?vertical=accommodation`, { headers: headers() })).status
        ).toBe(404);
    });
    it('returns 401 without a session', async () => {
        expect(
            (
                await app.request(`${base}?vertical=accommodation`, {
                    headers: { 'user-agent': 'vitest' }
                })
            ).status
        ).toBe(401);
    });
    it('returns 403 without the inspect permission', async () => {
        expect(
            (await app.request(`${base}?vertical=accommodation`, { headers: headers([]) })).status
        ).toBe(403);
    });
});
