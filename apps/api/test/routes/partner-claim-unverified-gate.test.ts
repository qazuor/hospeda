/** HOS-2237: an unverified account must reach the Partner claim handler. */
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../src/types';

const claimPartnerByLink = vi.hoisted(() => vi.fn());
vi.mock('../../src/services/partner-application/partner-link-claim.service', () => ({
    claimPartnerByLink
}));

import { protectedPartnerClaimRoute } from '../../src/routes/partner-application/protected/claim';

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const PARTNER_ID = '22222222-2222-4222-8222-222222222222';

function build(options: { readonly verified: boolean }) {
    const app = new Hono<AppBindings>();
    app.use('*', (c, next) => {
        c.set('actor', {
            id: ACTOR_ID,
            roles: [],
            permissions: [],
            emailVerified: options.verified
        });
        return next();
    });
    app.route('/', protectedPartnerClaimRoute);
    return app;
}

describe('HOS-2237 partner claim gate', () => {
    it('lets an unverified account reach the claim handler', async () => {
        claimPartnerByLink.mockResolvedValue({
            claimed: true,
            partnerId: PARTNER_ID,
            emailVerified: true
        });
        const response = await build({ verified: false }).request('/', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ partnerId: PARTNER_ID, secret: 'x'.repeat(32) })
        });
        expect(response.status).toBe(200);
        expect(claimPartnerByLink).toHaveBeenCalledOnce();
    });
});
