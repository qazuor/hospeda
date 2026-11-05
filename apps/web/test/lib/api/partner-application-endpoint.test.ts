/**
 * @file partner-application-endpoint.test.ts
 * @description Pins the protected PP1 request path and body (AC:V8b:5).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const postProtected = vi.hoisted(() => vi.fn());

vi.mock('../../../src/lib/api/client', () => ({ apiClient: { postProtected } }));

import { partnerApplicationApi } from '../../../src/lib/api/endpoints';

describe('partnerApplicationApi (AC:V7:15)', () => {
    beforeEach(() =>
        postProtected.mockReset().mockResolvedValue({ ok: true, data: { submitted: true } })
    );

    it('posts the exact PP1 body to the public Partner application path', async () => {
        const body = { email: 'person@example.test', cfTurnstileToken: 'turnstile-token' };
        await partnerApplicationApi.submit(body);
        expect(postProtected).toHaveBeenCalledExactlyOnceWith({
            path: '/api/v1/public/partner-applications',
            body: { email: 'person@example.test', cfTurnstileToken: 'turnstile-token' }
        });
    });
});
