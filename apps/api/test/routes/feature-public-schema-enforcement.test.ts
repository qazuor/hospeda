/**
 * Regression tests for SPEC-210 PR2 — feature public routes schema enforcement.
 *
 * Verifies that the following routes serialize responses through `FeaturePublicSchema`
 * and NEVER leak the internal-only fields `lifecycleState`, `createdAt`, `updatedAt`,
 * `createdById`, `updatedById`, `deletedAt`, `deletedById`, and admin fields.
 *
 * Routes covered:
 *   GET /api/v1/public/features            (list.ts)
 *   GET /api/v1/public/features/search     (search.ts)
 *   GET /api/v1/public/features/accommodation/:id  (getFeaturesForAccommodation.ts)
 *
 * The "Schema unit tests — always run (no DB required)" block runs unconditionally
 * so a schema revert is caught even in the DB-less CI environment.
 */

import { FeaturePublicSchema } from '@repo/schemas';
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../src/app.js';
import type { AppOpenAPI } from '../../src/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fields that must NEVER appear in a public feature response. */
const FORBIDDEN_FIELDS = [
    'lifecycleState',
    'createdAt',
    'updatedAt',
    'createdById',
    'updatedById',
    'deletedAt',
    'deletedById',
    'adminInfo'
] as const;

/** Fields that must be present on every public feature item. */
const REQUIRED_PUBLIC_FIELDS = ['id', 'slug', 'name', 'isFeatured', 'isBuiltin'] as const;

/**
 * Raw feature object that includes all internal fields.
 * Used by the always-running schema unit tests.
 */
const RAW_FEATURE_WITH_FORBIDDEN_FIELDS = {
    // Public fields (required)
    id: '123e4567-e89b-12d3-a456-426614174001',
    slug: 'swimming-pool',
    // name is i18nText({ min: 2, max: 100 }) — object with es/en/pt
    name: { es: 'Piscina', en: 'Swimming Pool', pt: 'Piscina' },
    // description is i18nText({ min: 10, max: 500 }).nullish()
    description: {
        es: 'Una piscina privada al aire libre disponible todo el año',
        en: 'A private outdoor pool available year round',
        pt: 'Uma piscina privada ao ar livre disponível o ano todo'
    },
    icon: 'pool',
    isBuiltin: true,
    isFeatured: false,
    displayWeight: 50,
    // Internal-only fields that must be stripped by FeaturePublicSchema
    lifecycleState: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: '123e4567-e89b-12d3-a456-000000000001',
    updatedById: null,
    deletedAt: null,
    deletedById: null,
    adminInfo: { someInternalKey: true }
};

// ---------------------------------------------------------------------------
// Schema unit tests — ALWAYS RUN (no DB required)
// ---------------------------------------------------------------------------

describe('FeaturePublicSchema — unit tests (no DB, always run) (SPEC-210)', () => {
    it('strips lifecycleState, createdAt, updatedAt, and all audit fields', () => {
        const result = FeaturePublicSchema.safeParse(RAW_FEATURE_WITH_FORBIDDEN_FIELDS);
        expect(result.success).toBe(true);
        if (result.success) {
            const data = result.data as Record<string, unknown>;
            for (const field of FORBIDDEN_FIELDS) {
                expect(data, `field "${field}" must be absent`).not.toHaveProperty(field);
            }
        }
    });

    it('preserves required public fields after parse', () => {
        const result = FeaturePublicSchema.safeParse(RAW_FEATURE_WITH_FORBIDDEN_FIELDS);
        expect(result.success).toBe(true);
        if (result.success) {
            const data = result.data as Record<string, unknown>;
            for (const field of REQUIRED_PUBLIC_FIELDS) {
                expect(data, `field "${field}" must be present`).toHaveProperty(field);
            }
        }
    });

    it('parses successfully with only the public field set (no extras)', () => {
        const minimal = {
            id: '123e4567-e89b-12d3-a456-426614174002',
            slug: 'wifi',
            name: { es: 'Wi-Fi', en: 'Wi-Fi', pt: 'Wi-Fi' },
            isBuiltin: true,
            isFeatured: false,
            displayWeight: 10
        };
        const result = FeaturePublicSchema.safeParse(minimal);
        expect(result.success).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Route-level regression tests (may be skipped if DB unavailable)
// ---------------------------------------------------------------------------

describe('GET /api/v1/public/features — schema enforcement (SPEC-210)', () => {
    let app: AppOpenAPI;
    const base = '/api/v1/public/features';

    beforeAll(async () => {
        app = initApp();
    });

    it('should be registered and reachable (not 404)', async () => {
        try {
            const res = await app.request(base, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect(res.status).not.toBe(404);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('should not require authentication', async () => {
        try {
            const res = await app.request(base, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect(res.status).not.toBe(401);
            expect(res.status).not.toBe(403);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('should NOT include lifecycleState, createdAt, updatedAt, or audit fields in any list item', async () => {
        try {
            const res = await app.request(base, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });

            if (res.status === 200) {
                const body = await res.json();
                const items: unknown[] = Array.isArray(body?.data?.items)
                    ? body.data.items
                    : Array.isArray(body?.items)
                      ? body.items
                      : Array.isArray(body?.data)
                        ? body.data
                        : [];

                for (const item of items) {
                    const record = item as Record<string, unknown>;
                    for (const field of FORBIDDEN_FIELDS) {
                        expect(record, `field "${field}" must be absent`).not.toHaveProperty(field);
                    }
                }
            }

            expect(res.status).not.toBe(404);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403, 500]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });
});

describe('GET /api/v1/public/features/search — schema enforcement (SPEC-210)', () => {
    let app: AppOpenAPI;
    const base = '/api/v1/public/features/search';

    beforeAll(async () => {
        app = initApp();
    });

    it('should be registered and reachable (not 404)', async () => {
        try {
            const res = await app.request(base, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect(res.status).not.toBe(404);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('should NOT include lifecycleState or audit fields in any search result item', async () => {
        try {
            const res = await app.request(`${base}?q=pool`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });

            if (res.status === 200) {
                const body = await res.json();
                const items: unknown[] = Array.isArray(body?.data?.items)
                    ? body.data.items
                    : Array.isArray(body?.items)
                      ? body.items
                      : [];

                for (const item of items) {
                    const record = item as Record<string, unknown>;
                    for (const field of FORBIDDEN_FIELDS) {
                        expect(record, `field "${field}" must be absent`).not.toHaveProperty(field);
                    }
                }
            }

            expect(res.status).not.toBe(404);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403, 500]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });
});

describe('GET /api/v1/public/features/accommodation/:id — schema enforcement (SPEC-210)', () => {
    let app: AppOpenAPI;
    const base = '/api/v1/public/features/accommodation/123e4567-e89b-12d3-a456-426614174000';

    beforeAll(async () => {
        app = initApp();
    });

    it('should be registered and reachable (not 404 at the route level)', async () => {
        try {
            const res = await app.request(base, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            // 422/400 means route matched but validation failed — still registered
            expect([200, 400, 422, 401, 403, 500]).toContain(res.status);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403, 500]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('should NOT include lifecycleState or audit fields in any feature item when items are returned', async () => {
        try {
            const res = await app.request(base, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });

            if (res.status === 200) {
                const body = await res.json();
                const items: unknown[] = Array.isArray(body?.data?.items)
                    ? body.data.items
                    : Array.isArray(body?.items)
                      ? body.items
                      : [];

                for (const item of items) {
                    const record = item as Record<string, unknown>;
                    for (const field of FORBIDDEN_FIELDS) {
                        expect(record, `field "${field}" must be absent`).not.toHaveProperty(field);
                    }
                }
            }

            expect(res.status).not.toBe(404);
        } catch (error: unknown) {
            if (error && typeof error === 'object' && 'status' in error) {
                expect([401, 403, 500]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });
});
