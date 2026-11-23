/**
 * `POST /api/v1/protected/partners/mine/logo` rejects the guest actor (HOS-2506).
 *
 * The unit suite (`mine-logo.test.ts`) mocks `createProtectedRoute` to reach the
 * bare handler, so it cannot see the gate. This suite boots the real app: the
 * guest actor carries a REAL UUID (`apps/api/docs/error-contract.md`), so only
 * the route factory's gate keeps it from the partner lookup and the provider.
 *
 * @module test/routes/partners/protected/mine-logo.guest-gate
 */

import { PermissionEnum } from '@repo/schemas';
import { PartnerService } from '@repo/service-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

/** Guest: no `x-mock-actor-*` headers. `user-agent` is mandatory (else 400). */
const GUEST = { 'user-agent': 'vitest' };

describe('POST /protected/partners/mine/logo — guest gate', () => {
    let app: AppOpenAPI;
    let getOwnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        app = initApp();
        getOwnSpy = vi.spyOn(PartnerService.prototype, 'getOwn');
    });

    it('answers 401 UNAUTHORIZED and never resolves a partner', async () => {
        const form = new FormData();
        form.append(
            'file',
            new File([new Uint8Array([1, 2, 3])], 'logo.png', { type: 'image/png' })
        );

        const res = await app.request('/api/v1/protected/partners/mine/logo', {
            method: 'POST',
            headers: GUEST,
            body: form
        });

        expect(res.status).toBe(401);
        const json = (await res.json()) as { success: boolean; error?: { code?: string } };
        expect(json.success).toBe(false);
        expect(json.error?.code).toBe('UNAUTHORIZED');
        expect(getOwnSpy).not.toHaveBeenCalled();
    });

    it('an authenticated owner passes the gate and reaches the handler (proves the mount)', async () => {
        const res = await app.request('/api/v1/protected/partners/mine/logo', {
            method: 'POST',
            headers: {
                ...GUEST,
                'x-mock-actor-id': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                'x-mock-actor-role': 'USER',
                'x-mock-actor-permissions': JSON.stringify([PermissionEnum.PARTNER_EDIT_OWN])
            },
            body: new FormData()
        });

        // No file: the handler's own input check answers, not the gate.
        expect(res.status).toBe(400);
        expect(getOwnSpy).not.toHaveBeenCalled();
    });
});
