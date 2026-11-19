import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { protectedPartnerClaimCheckRoute } from '../../../../src/routes/partner-application/protected/check';
import type { AppBindings } from '../../../../src/types';
import { createGuestActor } from '../../../../src/utils/actor';

const mocks = vi.hoisted(() => ({ check: vi.fn() }));

vi.mock('../../../../src/services/partner-application/partner-link-claim.service', () => ({
    checkPartnerClaimEmail: mocks.check
}));

const PARTNER_ID = 'd32b0f9b-0864-49d8-bf8f-0fb52c40fd15';
const accountActor: Actor = {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    roles: [RoleEnum.USER],
    permissions: [PermissionEnum.ACCESS_API_PUBLIC, PermissionEnum.ACCESS_API_PRIVATE],
    emailVerified: false
};

async function post(actor: Actor, body: unknown) {
    const app = new Hono<AppBindings>();
    app.use((c, next) => {
        c.set('actor', actor);
        return next();
    });
    app.route('/', protectedPartnerClaimCheckRoute);
    const response = await app.request('/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
    });
    const text = await response.text();
    let parsed: Record<string, unknown> = {};
    try {
        parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
        // plain-text 401 from the auth guard
    }
    return { response, body: parsed };
}

describe('POST /protected/partner-claims/check (HOS-2353)', () => {
    beforeEach(() => {
        mocks.check.mockReset().mockResolvedValue({ emailMatches: false });
    });

    it('answers 401 without a session and never checks', async () => {
        const { response } = await post(createGuestActor(), { partnerId: PARTNER_ID, secret: 's' });
        expect(response.status).toBe(401);
        expect(mocks.check).not.toHaveBeenCalled();
    });

    it('answers only { emailMatches } and no email anywhere in the body', async () => {
        const { response, body } = await post(accountActor, { partnerId: PARTNER_ID, secret: 's' });
        expect(response.status).toBe(200);
        expect(body.data).toEqual({ emailMatches: false });
        expect(JSON.stringify(body)).not.toMatch(/@/);
        expect(mocks.check).toHaveBeenCalledExactlyOnceWith({
            actorUserId: accountActor.id,
            partnerId: PARTNER_ID,
            secret: 's'
        });
    });

    it('rejects a body with unknown fields', async () => {
        const { response } = await post(accountActor, {
            partnerId: PARTNER_ID,
            secret: 's',
            email: 'x@example.test'
        });
        expect(response.status).toBe(400);
        expect(mocks.check).not.toHaveBeenCalled();
    });
});
