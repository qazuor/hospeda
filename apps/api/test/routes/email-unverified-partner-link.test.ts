/** TEST:V5:3 TEST:1692:3 — Partner link is checked only for CHANGE_EMAIL. */
import { PartnerService } from '@repo/service-core';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { AppBindings } from '../../src/types';
import { createProtectedRoute } from '../../src/utils/route-factory';

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const change = createProtectedRoute({
    method: 'get',
    path: '/change',
    summary: 'change',
    description: 'change',
    tags: ['test'],
    emailUnverifiedOperation: 'CHANGE_EMAIL',
    responseSchema: z.object({ ok: z.boolean() }),
    handler: async () => ({ ok: true })
});
const own = createProtectedRoute({
    method: 'get',
    path: '/own',
    summary: 'own',
    description: 'own',
    tags: ['test'],
    emailUnverifiedOperation: 'READ_OWN',
    responseSchema: z.object({ ok: z.boolean() }),
    handler: async () => ({ ok: true })
});
function build(options: { readonly verified: boolean; readonly route?: typeof change }) {
    const { verified, route = change } = options;
    const app = new Hono<AppBindings>();
    app.onError((error, c) =>
        error instanceof HTTPException
            ? c.json(
                  {
                      error: {
                          code: error.status === 403 ? 'EMAIL_NOT_VERIFIED' : 'SERVICE_UNAVAILABLE'
                      }
                  },
                  error.status
              )
            : c.json({ error: { code: 'INTERNAL_ERROR' } }, 500)
    );
    app.use('*', (c, next) => {
        c.set('actor', { id: ACTOR_ID, roles: [], permissions: [], emailVerified: verified });
        return next();
    });
    app.route('/', route);
    return app;
}

describe('TEST:V5:3 TEST:1692:3 step 2 reads the Partner link only for CHANGE_EMAIL', () => {
    it('rejects an unverified owner with a Partner link', async () => {
        const spy = vi
            .spyOn(PartnerService.prototype, 'getOwn')
            .mockResolvedValue({ data: { partner: {} } } as never);
        const response = await build({ verified: false }).request('/change');
        expect(response.status).toBe(403);
        expect((await response.json()).error.code).toBe('EMAIL_NOT_VERIFIED');
        expect(spy).toHaveBeenCalledOnce();
        vi.restoreAllMocks();
    });
    it('allows an unverified account without a Partner link', async () => {
        vi.spyOn(PartnerService.prototype, 'getOwn').mockResolvedValue({
            data: { partner: null }
        } as never);
        expect((await build({ verified: false }).request('/change')).status).toBe(200);
        vi.restoreAllMocks();
    });
    it('does not look up a link for a verified account', async () => {
        const spy = vi.spyOn(PartnerService.prototype, 'getOwn');
        expect((await build({ verified: true }).request('/change')).status).toBe(200);
        expect(spy).not.toHaveBeenCalled();
        vi.restoreAllMocks();
    });
    it('does not look up a link for READ_OWN', async () => {
        const spy = vi.spyOn(PartnerService.prototype, 'getOwn');
        expect((await build({ verified: false, route: own }).request('/own')).status).toBe(200);
        expect(spy).not.toHaveBeenCalled();
        vi.restoreAllMocks();
    });
    it.each([
        vi.fn().mockResolvedValue({ error: { code: 'INTERNAL_ERROR', message: 'x' } }),
        vi.fn().mockRejectedValue(new Error('lookup failed'))
    ])('fails closed when getOwn fails', async (implementation) => {
        vi.spyOn(PartnerService.prototype, 'getOwn').mockImplementation(implementation as never);
        expect((await build({ verified: false }).request('/change')).status).toBe(503);
        vi.restoreAllMocks();
    });
    it('passes the request actor to getOwn', async () => {
        const spy = vi
            .spyOn(PartnerService.prototype, 'getOwn')
            .mockResolvedValue({ data: { partner: null } } as never);
        await build({ verified: false }).request('/change');
        expect(spy.mock.calls[0]?.[0].id).toBe(ACTOR_ID);
        vi.restoreAllMocks();
    });
});
