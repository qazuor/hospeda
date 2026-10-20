import { VerticalEnum } from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';
import { getListingAccessPorts } from '../../../../src/utils/listing-access/ports.js';

vi.mock('../../../../src/utils/listing-access/ports.js', () => ({
    getListingAccessPorts: vi.fn()
}));
const USER_ID = '00000000-0000-4000-8000-000000000099';
const base = '/api/v1/protected/users/me/effective-set';
const effectiveSet = vi.fn();
const snapshot = (vertical: VerticalEnum, entries: { key: string; value: number }[]) =>
    rehydrateEffectiveSet({
        version: 1,
        userId: USER_ID,
        vertical,
        hasLiveNonTrialTitle: false,
        inheritsTouristVip: false,
        entries: entries.map(({ key, value }) => ({ key, value, strategy: 'MAX' as const }))
    });
const headers = (role = 'USER') => ({
    authorization: 'Bearer mock-token',
    'user-agent': 'vitest',
    'x-mock-actor-id': USER_ID,
    'x-mock-actor-role': role,
    'x-mock-actor-permissions': '[]'
});

describe('TEST:B13a:24 AC:B13a:26 protected effective set route', () => {
    let app: AppOpenAPI;
    beforeAll(() => {
        app = initApp();
    });
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getListingAccessPorts).mockReturnValue({ effectiveSet } as never);
        effectiveSet.mockResolvedValue(
            snapshot(VerticalEnum.ACCOMMODATION, [
                { key: 'view_basic_stats', value: 1 },
                { key: 'max_accommodations', value: Number.POSITIVE_INFINITY }
            ])
        );
    });
    it('returns resolved catalog keys only and encodes Infinity', async () => {
        const response = await app.request(`${base}?vertical=accommodation`, {
            headers: headers()
        });
        expect(response.status).toBe(200);
        expect(((await response.json()) as { data: unknown }).data).toStrictEqual({
            userId: USER_ID,
            vertical: 'accommodation',
            hasLiveNonTrialTitle: false,
            entitlements: { view_basic_stats: 1 },
            limits: { max_accommodations: 'Infinity' }
        });
    });
    it('resolves distinct verticals for the session user', async () => {
        effectiveSet.mockImplementation(({ vertical }) =>
            Promise.resolve(
                snapshot(vertical, [
                    {
                        key:
                            vertical === VerticalEnum.TOURIST
                                ? 'can_compare_accommodations'
                                : 'view_basic_stats',
                        value: 1
                    }
                ])
            )
        );
        const first = await app.request(`${base}?vertical=accommodation`, { headers: headers() });
        const second = await app.request(`${base}?vertical=tourist`, { headers: headers() });
        expect(((await first.json()) as { data: unknown }).data).not.toEqual(
            ((await second.json()) as { data: unknown }).data
        );
        expect(effectiveSet).toHaveBeenNthCalledWith(1, {
            userId: USER_ID,
            vertical: VerticalEnum.ACCOMMODATION
        });
        expect(effectiveSet).toHaveBeenNthCalledWith(2, {
            userId: USER_ID,
            vertical: VerticalEnum.TOURIST
        });
    });
    it.each(['nope', ''])('rejects invalid or absent vertical (%s)', async (vertical) => {
        const response = await app.request(`${base}${vertical ? `?vertical=${vertical}` : ''}`, {
            headers: headers()
        });
        expect(response.status).toBe(400);
        expect(((await response.json()) as { error: { code: string } }).error.code).toBe(
            'VALIDATION_ERROR'
        );
        expect(effectiveSet).not.toHaveBeenCalled();
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
    it('returns 401 for the guest actor', async () => {
        expect(
            (
                await app.request(`${base}?vertical=accommodation`, {
                    headers: {
                        ...headers('GUEST'),
                        'x-mock-actor-id': '00000000-0000-4000-8000-000000000000'
                    }
                })
            ).status
        ).toBe(401);
    });
    it('does not register the retired route', async () => {
        expect(
            (await app.request('/api/v1/protected/users/me/entitlements', { headers: headers() }))
                .status
        ).toBe(404);
        expect(effectiveSet).not.toHaveBeenCalled();
    });
    it('ignores a userId query parameter', async () => {
        await app.request(
            `${base}?vertical=accommodation&userId=22222222-2222-4222-8222-222222222222`,
            { headers: headers() }
        );
        expect(effectiveSet).toHaveBeenCalledWith({
            userId: USER_ID,
            vertical: VerticalEnum.ACCOMMODATION
        });
    });
    it('does not return capabilities when the port fails', async () => {
        effectiveSet.mockRejectedValue(new Error('failure'));
        const response = await app.request(`${base}?vertical=accommodation`, {
            headers: headers()
        });
        expect(response.status).toBeGreaterThanOrEqual(500);
        expect(await response.text()).not.toContain('view_basic_stats');
    });
});
