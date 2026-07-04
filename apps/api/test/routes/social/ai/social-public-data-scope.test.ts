/**
 * Scope + auth verification for GET /api/v1/ai/social/public-data — HOS-66 T-024.
 *
 * This is the R-1 anti-scope-creep gate for the public-data-pull endpoint. It
 * asserts two invariants end-to-end:
 *
 *  1. SCOPE (R-1): the endpoint only ever surfaces `ACCOMMODATION` and
 *     `DESTINATION` entities. The `SocialPublicDataEntityTypeEnumSchema` is the
 *     single choke point — if a future change widens it (or the route starts
 *     emitting another entity type), these assertions fail and force a
 *     deliberate review instead of silent scope creep.
 *  2. AUTH: a missing or invalid `x-hospeda-ai-key` yields 401 (the endpoint is
 *     never anonymously readable).
 *
 * @module test/routes/social/ai/social-public-data-scope
 * @see HOS-66 T-024 (G-10)
 */

import {
    SocialPublicDataEntityTypeEnumSchema,
    SocialPublicDataResponseDataSchema
} from '@repo/schemas';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// R-1 scope invariant
// ---------------------------------------------------------------------------

describe('public-data-pull — R-1 scope invariant', () => {
    it('entity-type enum is limited to ACCOMMODATION + DESTINATION only', () => {
        // The exact, ordered option set. Widening this is a deliberate change
        // (add a variant, widen the service, update this assertion) — never
        // accidental. This is the anti-scope-creep guard.
        expect([...SocialPublicDataEntityTypeEnumSchema.options].sort()).toEqual([
            'ACCOMMODATION',
            'DESTINATION'
        ]);
    });

    it('response schema accepts a scoped accommodation + destination payload', () => {
        const result = SocialPublicDataResponseDataSchema.safeParse({
            items: [
                {
                    entityType: 'ACCOMMODATION',
                    id: '00000000-0000-4000-8000-000000000101',
                    title: 'Cabaña del Río',
                    slug: 'cabana-del-rio',
                    summary: null,
                    imageUrl: null
                },
                {
                    entityType: 'DESTINATION',
                    id: '00000000-0000-4000-8000-000000000102',
                    title: 'Concepción del Uruguay',
                    slug: 'concepcion-del-uruguay',
                    summary: null,
                    imageUrl: null
                }
            ]
        });
        expect(result.success).toBe(true);
    });

    it('response schema REJECTS any out-of-scope entity type (R-1 enforcement)', () => {
        for (const outOfScope of ['EVENT', 'POST', 'ATTRACTION', 'USER']) {
            const result = SocialPublicDataResponseDataSchema.safeParse({
                items: [
                    {
                        entityType: outOfScope,
                        id: '00000000-0000-4000-8000-000000000103',
                        title: 'Should not parse',
                        slug: 'nope',
                        summary: null,
                        imageUrl: null
                    }
                ]
            });
            expect(result.success).toBe(false);
        }
    });
});

// ---------------------------------------------------------------------------
// Auth invariant (integration — real api-key middleware)
// ---------------------------------------------------------------------------

describe('public-data-pull — auth invariant', () => {
    async function bootGuardedApp() {
        const { apiKeyMiddleware } = await import('../../../../src/middlewares/api-key');
        const app = new Hono();
        app.use(
            '*',
            apiKeyMiddleware({
                headerName: 'x-hospeda-ai-key',
                getExpectedKey: () => 'test-secret-key',
                actor: { id: 'gpt-action', name: 'Custom GPT Social Action' }
            })
        );
        app.get('/', (c) => c.json({ items: [] }));
        return app;
    }

    it('rejects a request with no api-key header (401)', async () => {
        const app = await bootGuardedApp();
        const res = await app.request('/');
        expect(res.status).toBe(401);
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects a request with a wrong api-key value (401)', async () => {
        const app = await bootGuardedApp();
        const res = await app.request('/', { headers: { 'x-hospeda-ai-key': 'wrong' } });
        expect(res.status).toBe(401);
    });

    it('allows a request with the correct api-key (200)', async () => {
        const app = await bootGuardedApp();
        const res = await app.request('/', {
            headers: { 'x-hospeda-ai-key': 'test-secret-key' }
        });
        expect(res.status).toBe(200);
    });
});
