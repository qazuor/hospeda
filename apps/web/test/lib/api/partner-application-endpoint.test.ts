/**
 * @file partner-application-endpoint.test.ts
 * @description Pins the public PP1 endpoint path and request body (AC:V7:15).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.hoisted(() => vi.fn());

vi.mock('../../../src/lib/api/client', () => ({ apiClient: { post } }));

import { partnerApplicationApi } from '../../../src/lib/api/endpoints';

describe('partnerApplicationApi (AC:V7:15)', () => {
    beforeEach(() => post.mockReset().mockResolvedValue({ ok: true, data: { submitted: true } }));

    it('posts the exact PP1 body to the public Partner application path', async () => {
        const body = { email: 'person@example.test', cfTurnstileToken: 'turnstile-token' };
        await partnerApplicationApi.submit(body);
        expect(post).toHaveBeenCalledWith({
            path: '/api/v1/public/partner-applications',
            body: { email: 'person@example.test', cfTurnstileToken: 'turnstile-token' }
        });
    });
});
