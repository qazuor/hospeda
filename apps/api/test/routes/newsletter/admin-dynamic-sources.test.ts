import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { adminDynamicSourcesRoute } from '../../../src/routes/newsletter/admin/dynamic-sources';
import type { AppBindings } from '../../../src/types';
import { handleRouteError } from '../../../src/utils/response-helpers';

function buildApp(input: { allowed: boolean }) {
    const app = new Hono<AppBindings>();
    app.onError((error, ctx) => handleRouteError(error, ctx));
    app.use('*', async (c, next) => {
        c.set('actor', {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            roles: [RoleEnum.ADMIN],
            emailVerified: true,
            permissions: [
                PermissionEnum.ACCESS_PANEL_ADMIN,
                ...(input.allowed ? [PermissionEnum.NEWSLETTER_CAMPAIGN_VIEW] : [])
            ]
        });
        await next();
    });
    app.route('/api/v1/admin/newsletter', adminDynamicSourcesRoute);
    return app;
}

describe('GET /dynamic-sources', () => {
    it('publishes all six types and the four accommodation sources with availability', async () => {
        const response = await buildApp({ allowed: true }).request(
            '/api/v1/admin/newsletter/dynamic-sources'
        );
        expect(response.status).toBe(200);
        expect((await response.json()).data).toEqual({
            entityTypes: [
                {
                    entityType: 'ACCOMMODATION',
                    enabled: true,
                    sources: [
                        { source: 'most_viewed', enabled: true },
                        { source: 'newest', enabled: true },
                        { source: 'top_rated', enabled: true },
                        { source: 'featured', enabled: false }
                    ]
                },
                ...['VENUE', 'POST', 'EVENT', 'EXPERIENCE', 'PARTNER'].map((entityType) => ({
                    entityType,
                    enabled: false,
                    sources: []
                }))
            ]
        });
    });
    it('requires the campaign-list read permission', async () => {
        const response = await buildApp({ allowed: false }).request(
            '/api/v1/admin/newsletter/dynamic-sources'
        );
        expect(response.status).toBe(403);
        expect((await response.json()).error.code).toBe('FORBIDDEN');
    });
});
