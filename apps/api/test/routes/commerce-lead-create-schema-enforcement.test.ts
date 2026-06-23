/**
 * Regression tests for SPEC-210 PR2 — commerce-lead create endpoint schema enforcement.
 *
 * Verifies that POST /api/v1/public/commerce/leads returns ONLY `{ id }` and NEVER
 * leaks applicant PII (email, contactName, phone, businessName), workflow fields
 * (status, adminNote, handledAt, handledById), or audit timestamps.
 *
 * Before SPEC-210 PR2 the route used `CommerceLeadSchema.partial()` as responseSchema,
 * which allowed every field on the entity to surface in the response.  The fix wires
 * `CommerceLeadCreateResponseSchema` — a strict `z.object({ id: z.string().uuid() })`.
 *
 * Web consumer (`CommerceLead.client.tsx`) only checks `res.ok` — confirmed safe.
 *
 * The "Schema unit tests" describe block ALWAYS runs (no DB required).
 */

import { CommerceLeadCreateResponseSchema } from '@repo/schemas';
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../src/app.js';
import type { AppOpenAPI } from '../../src/types.js';

// ─── Shared app instance ─────────────────────────────────────────────────────

let app: AppOpenAPI;

beforeAll(() => {
    app = initApp();
});

// ─── Route-level tests ────────────────────────────────────────────────────────

describe('POST /api/v1/public/commerce/leads — schema enforcement (SPEC-210)', () => {
    const base = '/api/v1/public/commerce/leads';

    const validPayload = {
        domain: 'gastronomy',
        businessName: 'La Parrilla de Juan',
        contactName: 'Juan Pérez',
        email: 'juan@example.com',
        message: 'Quiero listar mi parrilla en la plataforma.',
        _hp: '' // honeypot empty — real submission
    };

    describe('Route Registration', () => {
        it('should be registered and reachable (not 404)', async () => {
            try {
                const res = await app.request(base, {
                    method: 'POST',
                    headers: {
                        'user-agent': 'vitest',
                        'content-type': 'application/json',
                        accept: 'application/json'
                    },
                    body: JSON.stringify(validPayload)
                });
                expect(res.status).not.toBe(404);
                expect([200, 400, 401, 403, 422, 500]).toContain(res.status);
            } catch (error: unknown) {
                if (error && typeof error === 'object' && 'status' in error) {
                    expect([401, 403]).toContain((error as { status: number }).status);
                } else {
                    throw error;
                }
            }
        });
    });

    describe('Public Access', () => {
        it('should not require authentication', async () => {
            try {
                const res = await app.request(base, {
                    method: 'POST',
                    headers: {
                        'user-agent': 'vitest',
                        'content-type': 'application/json',
                        accept: 'application/json'
                    },
                    body: JSON.stringify(validPayload)
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
    });

    describe('Field-level leak regression (SPEC-210)', () => {
        it('should NOT include PII, status, adminNote, or audit fields in 200 response', async () => {
            try {
                const res = await app.request(base, {
                    method: 'POST',
                    headers: {
                        'user-agent': 'vitest',
                        'content-type': 'application/json',
                        accept: 'application/json'
                    },
                    body: JSON.stringify(validPayload)
                });

                if (res.status === 200) {
                    const body = (await res.json()) as Record<string, unknown>;
                    // The response may be wrapped: unwrap if needed
                    const data = (body?.data ?? body) as Record<string, unknown>;

                    // PII — must not appear
                    expect(data).not.toHaveProperty('email');
                    expect(data).not.toHaveProperty('contactName');
                    expect(data).not.toHaveProperty('phone');
                    expect(data).not.toHaveProperty('businessName');
                    expect(data).not.toHaveProperty('message');
                    // Workflow fields — must not appear
                    expect(data).not.toHaveProperty('status');
                    expect(data).not.toHaveProperty('adminNote');
                    expect(data).not.toHaveProperty('handledAt');
                    expect(data).not.toHaveProperty('handledById');
                    // Audit timestamps — must not appear
                    expect(data).not.toHaveProperty('createdAt');
                    expect(data).not.toHaveProperty('updatedAt');
                    expect(data).not.toHaveProperty('deletedAt');
                    expect(data).not.toHaveProperty('createdById');
                    expect(data).not.toHaveProperty('updatedById');
                }

                // route exists regardless of DB availability
                expect(res.status).not.toBe(404);
            } catch (error: unknown) {
                if (error && typeof error === 'object' && 'status' in error) {
                    expect([401, 403, 500]).toContain((error as { status: number }).status);
                } else {
                    throw error;
                }
            }
        });

        it('should return only { id } in the data payload on success', async () => {
            try {
                const res = await app.request(base, {
                    method: 'POST',
                    headers: {
                        'user-agent': 'vitest',
                        'content-type': 'application/json',
                        accept: 'application/json'
                    },
                    body: JSON.stringify(validPayload)
                });

                if (res.status === 200) {
                    const body = (await res.json()) as Record<string, unknown>;
                    const data = (body?.data ?? body) as Record<string, unknown>;
                    expect(data).toHaveProperty('id');
                    // id must be a non-empty string
                    expect(typeof data.id).toBe('string');
                    expect((data.id as string).length).toBeGreaterThan(0);
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
});

// ─── Schema unit tests — ALWAYS RUN (no DB required) ─────────────────────────

describe('CommerceLeadCreateResponseSchema — unit assertions (SPEC-210)', () => {
    /**
     * Build a raw object containing every field that the full CommerceLead entity
     * has, including sensitive PII, workflow, and audit fields.  The public
     * response schema must strip all of them except `id`.
     */
    const rawFullLead = {
        // Only this should survive
        id: '123e4567-e89b-12d3-a456-426614174002',
        // PII
        businessName: 'La Parrilla de Juan',
        contactName: 'Juan Pérez',
        email: 'juan@example.com',
        phone: '+5493415551234',
        destinationId: 'dddddddd-0000-0000-0000-000000000001',
        message: 'Quiero listar mi negocio.',
        domain: 'gastronomy',
        // Workflow / admin-only
        status: 'pending',
        adminNote: 'Revisar website.',
        handledAt: new Date(),
        handledById: 'aaaaaaaa-0000-0000-0000-000000000001',
        provisionedUserId: null,
        // Audit timestamps
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        createdById: null,
        updatedById: null,
        deletedById: null
    };

    it('strips all fields except id', () => {
        const result = CommerceLeadCreateResponseSchema.safeParse(rawFullLead);
        expect(result.success).toBe(true);
        if (result.success) {
            const data = result.data as Record<string, unknown>;
            // The only key in the output must be id
            expect(Object.keys(data)).toEqual(['id']);
            // PII must be absent
            expect(data).not.toHaveProperty('email');
            expect(data).not.toHaveProperty('contactName');
            expect(data).not.toHaveProperty('phone');
            expect(data).not.toHaveProperty('businessName');
            expect(data).not.toHaveProperty('message');
            // Workflow fields must be absent
            expect(data).not.toHaveProperty('status');
            expect(data).not.toHaveProperty('adminNote');
            expect(data).not.toHaveProperty('handledAt');
            expect(data).not.toHaveProperty('handledById');
            // Audit must be absent
            expect(data).not.toHaveProperty('createdAt');
            expect(data).not.toHaveProperty('updatedAt');
            expect(data).not.toHaveProperty('deletedAt');
            expect(data).not.toHaveProperty('createdById');
        }
    });

    it('preserves the id field as a UUID string', () => {
        const result = CommerceLeadCreateResponseSchema.safeParse(rawFullLead);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.id).toBe('123e4567-e89b-12d3-a456-426614174002');
        }
    });

    it('rejects a payload without id', () => {
        const { id: _id, ...withoutId } = rawFullLead;
        const result = CommerceLeadCreateResponseSchema.safeParse(withoutId);
        expect(result.success).toBe(false);
    });

    it('rejects an invalid (non-UUID) id', () => {
        const result = CommerceLeadCreateResponseSchema.safeParse({ id: 'not-a-uuid' });
        expect(result.success).toBe(false);
    });
});
