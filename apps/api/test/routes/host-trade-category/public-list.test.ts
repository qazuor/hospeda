/**
 * Tests for GET /api/v1/public/host-trade-categories (HOS-919 T-027).
 *
 * The route is a thin wrapper over `HostTradeCategoryService.getPublicCatalog`
 * (active/non-deleted filtering and ordering are asserted at the service and
 * model layers). Here we pin what the ROUTE owns: it is reachable by a guest,
 * it forwards the actor, it returns the catalog untouched and the payload
 * satisfies `PublicHostTradeCatalogSchema`.
 *
 * @module test/routes/host-trade-category/public-list
 */

import { PublicHostTradeCatalogSchema, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../src/types';

const { mockGetPublicCatalog } = vi.hoisted(() => ({ mockGetPublicCatalog: vi.fn() }));

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        HostTradeCategoryService: vi.fn().mockImplementation(function () {
            return { getPublicCatalog: mockGetPublicCatalog };
        })
    };
});

vi.mock('../../../src/utils/logger.js', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const { publicListHostTradeCategoriesRoute } = await import(
    '../../../src/routes/host-trade-category/public/list.js'
);

const GUEST_ID = '00000000-0000-4000-8000-000000000000';

const CATALOG = {
    groups: [
        {
            slug: 'construccion',
            nameI18n: { es: 'Construcción', en: 'Construction', pt: 'Construção' },
            displayWeight: 90,
            categories: [
                {
                    id: '11111111-1111-4111-8111-111111111111',
                    slug: 'plomeria',
                    nameI18n: { es: 'Plomería', en: 'Plumbing', pt: 'Encanamento' },
                    displayWeight: 80,
                    keywordsI18n: { es: ['agua', 'cañería'] }
                },
                {
                    id: '22222222-2222-4222-8222-222222222222',
                    slug: 'pintura',
                    nameI18n: { es: 'Pintura', en: 'Painting', pt: 'Pintura' },
                    displayWeight: 70,
                    keywordsI18n: {}
                }
            ]
        }
    ]
};

function buildApp(): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    app.onError((error, c) => {
        if (error instanceof ServiceError) {
            return c.json({ success: false, error: { code: error.code } }, 500);
        }
        if (error instanceof HTTPException) return error.getResponse();
        return c.json({ success: false, error: { code: 'INTERNAL_ERROR' } }, 500);
    });
    app.use((c, next) => {
        c.set('actor', { id: GUEST_ID, roles: [RoleEnum.GUEST], permissions: [] });
        return next();
    });
    app.route('/', publicListHostTradeCategoriesRoute);
    return app;
}

describe('GET /public/host-trade-categories', () => {
    beforeEach(() => {
        mockGetPublicCatalog.mockReset();
        mockGetPublicCatalog.mockResolvedValue({ data: CATALOG, error: undefined });
    });

    it('answers 200 to a guest with the catalog from the service, order preserved', async () => {
        // Arrange
        const app = buildApp();

        // Act
        const res = await app.request('/', { method: 'GET' });
        const body = await res.json();

        // Assert
        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
        expect(body.data.groups[0].categories.map((c: { slug: string }) => c.slug)).toEqual([
            'plomeria',
            'pintura'
        ]);
        expect(mockGetPublicCatalog).toHaveBeenCalledTimes(1);
        expect(mockGetPublicCatalog.mock.calls[0]?.[0]).toMatchObject({ id: GUEST_ID });
    });

    it('returns a payload that validates against PublicHostTradeCatalogSchema', async () => {
        const res = await buildApp().request('/', { method: 'GET' });
        const body = await res.json();
        expect(PublicHostTradeCatalogSchema.safeParse(body.data).success).toBe(true);
    });

    it('returns an empty catalog as 200 with no groups', async () => {
        mockGetPublicCatalog.mockResolvedValue({ data: { groups: [] }, error: undefined });
        const res = await buildApp().request('/', { method: 'GET' });
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.data.groups).toEqual([]);
    });

    it('does not leak admin fields even if the service returned them', async () => {
        mockGetPublicCatalog.mockResolvedValue({
            data: {
                groups: [
                    {
                        ...CATALOG.groups[0],
                        lifecycleState: 'INACTIVE',
                        createdById: 'secret',
                        categories: [
                            { ...CATALOG.groups[0]?.categories[0], deletedAt: '2026-01-01' }
                        ]
                    }
                ]
            },
            error: undefined
        });
        const res = await buildApp().request('/', { method: 'GET' });
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(JSON.stringify(body)).not.toContain('createdById');
        expect(JSON.stringify(body)).not.toContain('deletedAt');
        expect(JSON.stringify(body)).not.toContain('lifecycleState');
    });

    it('surfaces a service failure as an error, never as an empty 200', async () => {
        mockGetPublicCatalog.mockResolvedValue({
            data: undefined,
            error: { code: ServiceErrorCode.INTERNAL_ERROR, message: 'boom' }
        });
        const res = await buildApp().request('/', { method: 'GET' });
        expect(res.status).toBeGreaterThanOrEqual(400);
    });
});
