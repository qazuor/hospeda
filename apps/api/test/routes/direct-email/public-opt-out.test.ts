/**
 * Route tests for the public direct email opt-out (HOS-2685, AC-5): the GET validates
 * the token and NEVER writes; the POST writes the suppression; a bad token is a 400.
 */
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ previewOptOut: vi.fn(), optOut: vi.fn() }));

vi.mock('../../../src/routes/direct-email/_singletons', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../../src/routes/direct-email/_singletons')>()),
    getDirectEmailSuppressionService: () => mocks
}));

vi.mock('../../../src/middlewares/rate-limit', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../../src/middlewares/rate-limit')>()),
    createPerRouteRateLimitMiddleware: () => async (_c: unknown, next: () => Promise<void>) => {
        await next();
    }
}));

import { Hono } from 'hono';
import { createErrorHandler } from '../../../src/middlewares/response';
import { directEmailPublicRoutes } from '../../../src/routes/direct-email';
import type { AppBindings } from '../../../src/types';
import { createGuestActor } from '../../../src/utils/actor';

const URL_BASE = '/api/v1/public/direct-emails/opt-out';

function buildApp() {
    const app = new Hono<AppBindings>();
    app.onError(createErrorHandler());
    app.use('*', async (c, next) => {
        c.set('actor', createGuestActor());
        await next();
    });
    app.route('/api/v1/public/direct-emails', directEmailPublicRoutes);
    return app;
}

const badToken = () => ({
    error: new ServiceError(
        ServiceErrorCode.VALIDATION_ERROR,
        'The opt-out link is not valid',
        undefined,
        'DIRECT_EMAIL_TOKEN_INVALID'
    )
});

describe('public direct email opt-out', () => {
    beforeEach(() => {
        mocks.previewOptOut.mockReset();
        mocks.optOut.mockReset();
    });

    it('GET returns the masked address and does not write', async () => {
        // Arrange
        mocks.previewOptOut.mockResolvedValue({ data: { maskedEmail: 'j***@example.com' } });

        // Act
        const res = await buildApp().request(`${URL_BASE}?token=abc.def`);

        // Assert
        expect(res.status).toBe(200);
        expect((await res.json()).data).toEqual({ maskedEmail: 'j***@example.com' });
        expect(mocks.previewOptOut).toHaveBeenCalledWith({ token: 'abc.def' });
        expect(mocks.optOut).not.toHaveBeenCalled();
    });

    it('GET answers 400 without a token', async () => {
        const res = await buildApp().request(URL_BASE);
        expect(res.status).toBe(400);
        expect(mocks.previewOptOut).not.toHaveBeenCalled();
    });

    it('GET answers 400 with the token reason for a forged token', async () => {
        mocks.previewOptOut.mockResolvedValue(badToken());
        const res = await buildApp().request(`${URL_BASE}?token=forged.token`);
        expect(res.status).toBe(400);
        expect((await res.json()).error.reason).toBe('DIRECT_EMAIL_TOKEN_INVALID');
    });

    it('POST suppresses the address of a valid token', async () => {
        // Arrange
        mocks.optOut.mockResolvedValue({ data: { maskedEmail: 'j***@example.com' } });

        // Act
        const res = await buildApp().request(URL_BASE, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ token: 'abc.def' })
        });

        // Assert
        expect(res.status).toBe(200);
        expect((await res.json()).data).toEqual({
            maskedEmail: 'j***@example.com',
            suppressed: true
        });
        expect(mocks.optOut).toHaveBeenCalledWith({ token: 'abc.def' });
    });

    it('POST answers 400 for a forged token and for a missing token', async () => {
        mocks.optOut.mockResolvedValue(badToken());
        const app = buildApp();
        const post = (body: unknown) =>
            app.request(URL_BASE, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(body)
            });
        expect((await post({ token: 'forged.token' })).status).toBe(400);
        mocks.optOut.mockClear();
        expect((await post({})).status).toBe(400);
        expect(mocks.optOut).not.toHaveBeenCalled();
    });
});
