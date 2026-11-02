import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { ServiceError } from '@repo/service-core/types';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { publicSubmitPartnerApplicationRoute } from '../../../../src/routes/partner-application/public/submit';
import type { AppBindings } from '../../../../src/types';
import { createGuestActor } from '../../../../src/utils/actor';

const mocks = vi.hoisted(() => ({
    submit: vi.fn(),
    getSecret: vi.fn(),
    verify: vi.fn()
}));

vi.mock(
    '../../../../src/services/partner-application/partner-application-submission.service',
    () => ({
        submitPartnerApplication: mocks.submit
    })
);
vi.mock('../../../../src/utils/turnstile', () => ({
    getTurnstileSecret: mocks.getSecret,
    verifyCfTurnstileToken: mocks.verify
}));
vi.mock('../../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => {
        throw new Error('Listing access ports must not be used by PP1');
    }
}));

const accountActor: Actor = {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    roles: [RoleEnum.USER],
    permissions: [PermissionEnum.ACCESS_API_PUBLIC],
    emailVerified: false
};
const validBody = { email: 'person@example.test', cfTurnstileToken: 'valid-token' };

function buildApp(actor: Actor) {
    const app = new Hono<AppBindings>();
    app.use((c, next) => {
        c.set('actor', actor);
        return next();
    });
    app.route('/', publicSubmitPartnerApplicationRoute);
    return app;
}

async function post(actor: Actor, body: unknown) {
    const response = await buildApp(actor).request('/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
    });
    return { response, body: (await response.json()) as Record<string, unknown> };
}

beforeEach(() => {
    mocks.submit.mockReset().mockResolvedValue({ submitted: true });
    mocks.getSecret.mockReset().mockReturnValue('configured-secret');
    mocks.verify.mockReset().mockResolvedValue({ success: true });
});

describe('TEST:V7:23 PP1 public route', () => {
    it('lets a guest submit without invoking listing access', async () => {
        const { response, body } = await post(createGuestActor(), validBody);
        expect(response.status).toBe(201);
        expect(body).toEqual({
            success: true,
            data: { submitted: true },
            metadata: { timestamp: expect.any(String), requestId: 'unknown' }
        });
        expect(mocks.submit).toHaveBeenCalledExactlyOnceWith({ email: validBody.email });
    });

    it('does not apply step 2 to a guest with emailVerified false', async () => {
        const { response } = await post({ ...createGuestActor(), emailVerified: false }, validBody);
        expect(response.status).toBe(201);
        expect(mocks.submit).toHaveBeenCalledExactlyOnceWith({ email: validBody.email });
    });

    it('blocks a signed-in unverified account before submission', async () => {
        const { response, body } = await post(accountActor, validBody);
        expect(response.status).toBe(403);
        expect(body).toEqual({
            success: false,
            error: {
                code: ServiceErrorCode.EMAIL_NOT_VERIFIED,
                message: 'Email verification required'
            },
            metadata: { timestamp: expect.any(String), requestId: 'unknown' }
        });
        expect(mocks.submit).not.toHaveBeenCalled();
    });

    it('checks step 2 before validating an unverified account body', async () => {
        const { response, body } = await post(accountActor, { cfTurnstileToken: 'valid-token' });
        expect(response.status).toBe(403);
        expect(body).toEqual({
            success: false,
            error: {
                code: ServiceErrorCode.EMAIL_NOT_VERIFIED,
                message: 'Email verification required'
            },
            metadata: { timestamp: expect.any(String), requestId: 'unknown' }
        });
        expect(mocks.submit).not.toHaveBeenCalled();
    });

    it('allows a signed-in verified account', async () => {
        const { response } = await post({ ...accountActor, emailVerified: true }, validBody);
        expect(response.status).toBe(201);
        expect(mocks.submit).toHaveBeenCalledExactlyOnceWith({ email: validBody.email });
    });

    it('rejects a failed Turnstile verification', async () => {
        mocks.verify.mockResolvedValue({ success: false });
        const { response, body } = await post(createGuestActor(), validBody);
        expect(response.status).toBe(403);
        expect(body).toEqual({
            success: false,
            error: { code: ServiceErrorCode.FORBIDDEN, message: 'Security verification failed' }
        });
        expect(mocks.submit).not.toHaveBeenCalled();
    });

    it('silently accepts a filled honeypot without calling the service', async () => {
        const { response, body } = await post(createGuestActor(), { ...validBody, _hp: 'bot' });
        expect(response.status).toBe(201);
        expect(body).toEqual({
            success: true,
            data: { submitted: true },
            metadata: { timestamp: expect.any(String), requestId: 'unknown' }
        });
        expect(mocks.submit).toHaveBeenCalledTimes(0);
    });

    it('returns one opaque conflict for a database guard rejection', async () => {
        mocks.submit.mockRejectedValue(
            new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                'Partner application not accepted',
                undefined,
                'PARTNER_APPLICATION_UNAVAILABLE'
            )
        );
        const { response, body } = await post(createGuestActor(), validBody);
        expect(response.status, JSON.stringify(body)).toBe(409);
        expect(body).toEqual({
            success: false,
            error: {
                code: ServiceErrorCode.ALREADY_EXISTS,
                message: 'Partner application not accepted',
                reason: 'PARTNER_APPLICATION_UNAVAILABLE'
            },
            metadata: { timestamp: expect.any(String), requestId: 'unknown' }
        });
    });
});
