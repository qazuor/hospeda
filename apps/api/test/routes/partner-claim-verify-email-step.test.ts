/** TEST:V7:10 (c) — the claim route admits an unverified account through step 2 as VERIFY_EMAIL. */
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../src/types';

const claimPartnerByLink = vi.fn();
vi.mock('../../src/services/partner-application/partner-link-claim.service', () => ({
    claimPartnerByLink
}));

const { protectedPartnerClaimRoute } = await import(
    '../../src/routes/partner-application/protected/claim'
);

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const PARTNER_ID = '22222222-2222-4222-8222-222222222222';

function build(options: { readonly verified: boolean }) {
    const app = new Hono<AppBindings>();
    app.onError((error, c) =>
        error instanceof HTTPException
            ? c.json({ error: { code: 'HTTP_EXCEPTION' } }, error.status)
            : c.json({ error: { code: 'INTERNAL_ERROR' } }, 500)
    );
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

const claim = (app: Hono<AppBindings>) =>
    app.request('/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ partnerId: PARTNER_ID, secret: 'secret' })
    });

describe('TEST:V7:10 (c) the claim route declares VERIFY_EMAIL', () => {
    afterEach(() => {
        claimPartnerByLink.mockReset();
    });

    it('lets an unverified account reach the claim service', async () => {
        // Arrange
        claimPartnerByLink.mockResolvedValue({
            claimed: true,
            partnerId: PARTNER_ID,
            emailVerified: true
        });

        // Act
        const response = await claim(build({ verified: false }));

        // Assert
        expect(response.status).toBe(200);
        expect(claimPartnerByLink).toHaveBeenCalledOnce();
        expect(claimPartnerByLink).toHaveBeenCalledWith(
            expect.objectContaining({ actorUserId: ACTOR_ID, partnerId: PARTNER_ID })
        );
    });
});
