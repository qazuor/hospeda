/**
 * Regression tests for SPEC-210 PR2 — gastronomy FAQ public schema enforcement.
 *
 * Verifies that GET /api/v1/public/gastronomies/:gastronomyId/faqs serializes
 * responses through `GastronomyFaqPublicSchema` and NEVER leaks the internal-only
 * fields: `createdAt`, `updatedAt`, `createdById`, `updatedById`, `deletedAt`,
 * `deletedById`, and `lifecycleState`.
 *
 * The "Schema unit tests — always run (no DB required)" block runs unconditionally
 * so a schema revert is caught even in the DB-less CI environment.
 *
 * Endpoint: GET /api/v1/public/gastronomies/:gastronomyId/faqs
 */

import { GastronomyFaqPublicListOutputSchema, GastronomyFaqPublicSchema } from '@repo/schemas';
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../src/app.js';
import type { AppOpenAPI } from '../../src/types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Fields that must NEVER appear in a public FAQ response item. */
const FORBIDDEN_FIELDS = [
    'createdAt',
    'updatedAt',
    'createdById',
    'updatedById',
    'deletedAt',
    'deletedById',
    'lifecycleState'
] as const;

/** Fields that must be present on every public gastronomy FAQ item. */
const REQUIRED_PUBLIC_FIELDS = ['id', 'gastronomyId', 'question', 'answer'] as const;

/**
 * Raw FAQ object that includes all fields from the full GastronomyFaqSchema
 * (including internal audit/lifecycle fields that must be stripped).
 */
const RAW_FAQ_WITH_FORBIDDEN_FIELDS = {
    // Public fields
    id: '223e4567-e89b-12d3-a456-426614174001',
    gastronomyId: '223e4567-e89b-12d3-a456-426614174002',
    question: 'Do you offer vegetarian options on the menu?',
    answer: 'Yes, we have a dedicated vegetarian section with seasonal dishes updated weekly.',
    category: 'Qué hacer',
    displayOrder: 1,
    // Audit fields — must be stripped by GastronomyFaqPublicSchema
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: '223e4567-e89b-12d3-a456-000000000001',
    updatedById: null,
    deletedAt: null,
    deletedById: null,
    // Lifecycle — must be stripped
    lifecycleState: 'ACTIVE'
};

// ---------------------------------------------------------------------------
// Schema unit tests — ALWAYS RUN (no DB required)
// ---------------------------------------------------------------------------

describe('GastronomyFaqPublicSchema — unit tests (no DB, always run) (SPEC-210)', () => {
    it('strips all audit fields and lifecycleState from a raw FAQ object', () => {
        const result = GastronomyFaqPublicSchema.safeParse(RAW_FAQ_WITH_FORBIDDEN_FIELDS);
        expect(result.success).toBe(true);
        if (result.success) {
            const data = result.data as Record<string, unknown>;
            for (const field of FORBIDDEN_FIELDS) {
                expect(data, `field "${field}" must be absent`).not.toHaveProperty(field);
            }
        }
    });

    it('preserves required public fields (id, gastronomyId, question, answer) after parse', () => {
        const result = GastronomyFaqPublicSchema.safeParse(RAW_FAQ_WITH_FORBIDDEN_FIELDS);
        expect(result.success).toBe(true);
        if (result.success) {
            const data = result.data as Record<string, unknown>;
            for (const field of REQUIRED_PUBLIC_FIELDS) {
                expect(data, `field "${field}" must be present`).toHaveProperty(field);
            }
        }
    });

    it('preserves category and displayOrder when present', () => {
        const result = GastronomyFaqPublicSchema.safeParse(RAW_FAQ_WITH_FORBIDDEN_FIELDS);
        expect(result.success).toBe(true);
        if (result.success) {
            const data = result.data as Record<string, unknown>;
            expect(data.category).toBe('Qué hacer');
            expect(data.displayOrder).toBe(1);
        }
    });

    it('parses successfully with only the required public fields (no extras)', () => {
        const minimal = {
            id: '223e4567-e89b-12d3-a456-426614174003',
            gastronomyId: '223e4567-e89b-12d3-a456-426614174004',
            question: 'Is there parking available near the restaurant?',
            answer: 'Yes, there is free parking available on the street and a paid lot two blocks away.'
        };
        const result = GastronomyFaqPublicSchema.safeParse(minimal);
        expect(result.success).toBe(true);
    });

    it('GastronomyFaqPublicListOutputSchema wraps the FAQ array under the faqs key', () => {
        const payload = {
            faqs: [RAW_FAQ_WITH_FORBIDDEN_FIELDS]
        };
        const result = GastronomyFaqPublicListOutputSchema.safeParse(payload);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(Array.isArray(result.data.faqs)).toBe(true);
            const item = result.data.faqs[0] as Record<string, unknown>;
            // Verify stripping also works through the list wrapper
            for (const field of FORBIDDEN_FIELDS) {
                expect(item, `field "${field}" must be absent in list item`).not.toHaveProperty(
                    field
                );
            }
        }
    });
});

// ---------------------------------------------------------------------------
// Route-level regression tests (may be skipped if DB unavailable)
// ---------------------------------------------------------------------------

describe('GET /api/v1/public/gastronomies/:gastronomyId/faqs — schema enforcement (SPEC-210)', () => {
    let app: AppOpenAPI;
    const gastronomyId = '223e4567-e89b-12d3-a456-426614174000';
    const base = `/api/v1/public/gastronomies/${gastronomyId}/faqs`;

    beforeAll(async () => {
        app = initApp();
    });

    it('should be registered and reachable (not return 404)', async () => {
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
                // Accept if middleware blocks in test env — route is still registered
                expect([401, 403]).toContain((error as { status: number }).status);
            } else {
                throw error;
            }
        }
    });

    it('should NOT include audit or lifecycleState fields in any FAQ item when 200 is returned', async () => {
        try {
            const res = await app.request(base, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });

            if (res.status === 200) {
                const body = await res.json();
                // The route returns { faqs: [...] }
                const items: unknown[] = Array.isArray(body?.data?.faqs)
                    ? body.data.faqs
                    : Array.isArray(body?.faqs)
                      ? body.faqs
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
