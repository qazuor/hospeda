import { UserModel } from '@repo/db';
import { PermissionEnum, TrialStatusEnum } from '@repo/schemas';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { readAdminTrialSummary } from '../../../../src/services/listing-notices/admin-trial-summary.service.js';
import type { AppOpenAPI } from '../../../../src/types.js';

vi.mock('../../../../src/services/listing-notices/admin-trial-summary.service.js', () => ({
    readAdminTrialSummary: vi.fn()
}));

const USER_ID = '11111111-1111-4111-8111-111111111111';
const ACTOR_ID = '22222222-2222-4222-8222-222222222222';
const base = `/api/v1/admin/users/${USER_ID}/trial-summary`;
const none = { summary: { status: 'NONE' as const }, ceilingDays: null };
const headers = (permissions: string[] = [PermissionEnum.BILLING_SUBSCRIPTION_INSPECT]) => ({
    authorization: 'Bearer mock-token',
    'user-agent': 'vitest',
    'x-mock-actor-id': ACTOR_ID,
    'x-mock-actor-role': 'ADMIN',
    'x-mock-actor-permissions': JSON.stringify([PermissionEnum.ACCESS_PANEL_ADMIN, ...permissions])
});

describe('TEST:V8a:7 (panel, fila 4) admin trial summary route', () => {
    let app: AppOpenAPI;
    beforeAll(() => {
        app = initApp();
    });
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(UserModel.prototype, 'findById').mockResolvedValue({ id: USER_ID } as never);
        vi.mocked(readAdminTrialSummary).mockResolvedValue(none);
    });

    it('returns every NONE response field', async () => {
        const response = await app.request(`${base}?vertical=accommodation`, {
            headers: headers()
        });
        expect(response.status).toBe(200);
        expect(((await response.json()) as { data: unknown }).data).toStrictEqual(none);
    });
    it('returns a complete trial response and passes the route subject, not the actor', async () => {
        const summary = {
            status: TrialStatusEnum.TRIAL_ACTIVE,
            startedAt: '2026-01-01T00:00:00.000Z',
            endsAt: '2026-02-15T00:00:00.000Z',
            totalDays: 45,
            origins: { base: 30, promo: 10, support: 5 }
        } as const;
        vi.mocked(readAdminTrialSummary).mockResolvedValue({ summary, ceilingDays: 90 });
        const response = await app.request(`${base}?vertical=experience`, { headers: headers() });
        expect(response.status).toBe(200);
        expect(((await response.json()) as { data: unknown }).data).toStrictEqual({
            summary,
            ceilingDays: 90
        });
        expect(readAdminTrialSummary).toHaveBeenCalledWith({
            userId: USER_ID,
            vertical: 'experience'
        });
    });
    it.each([
        'accommodation',
        'gastronomy',
        'experience'
    ])('accepts vertical %s', async (vertical) => {
        expect(
            (await app.request(`${base}?vertical=${vertical}`, { headers: headers() })).status
        ).toBe(200);
    });
    it.each(['tourist', 'partner'])('rejects %s', async (vertical) => {
        expect(
            (await app.request(`${base}?vertical=${vertical}`, { headers: headers() })).status
        ).toBe(400);
    });
    it('rejects missing vertical and malformed id', async () => {
        expect((await app.request(base, { headers: headers() })).status).toBe(400);
        expect(
            (
                await app.request(
                    '/api/v1/admin/users/not-uuid/trial-summary?vertical=experience',
                    { headers: headers() }
                )
            ).status
        ).toBe(400);
    });
    it('returns 404 before calling the service', async () => {
        vi.mocked(UserModel.prototype.findById).mockResolvedValue(null);
        expect(
            (await app.request(`${base}?vertical=experience`, { headers: headers() })).status
        ).toBe(404);
        expect(readAdminTrialSummary).not.toHaveBeenCalled();
    });
    it('returns 401 without a session', async () => {
        expect(
            (
                await app.request(`${base}?vertical=experience`, {
                    headers: { 'user-agent': 'vitest' }
                })
            ).status
        ).toBe(401);
    });
    it.each([
        PermissionEnum.ACCESS_PANEL_ADMIN,
        PermissionEnum.USER_CLOSE_ON_REQUEST,
        PermissionEnum.TRIAL_EXTEND
    ])('returns 403 with only %s', async (permission) => {
        expect(
            (await app.request(`${base}?vertical=experience`, { headers: headers([permission]) }))
                .status
        ).toBe(403);
    });
    it('checks permission before invalid query', async () => {
        expect(
            (await app.request(`${base}?vertical=tourist`, { headers: headers([]) })).status
        ).toBe(403);
    });
});
