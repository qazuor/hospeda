/**
 * HTTP-layer strict request-body rejection tests (HOS-106).
 *
 * Supersedes `test/integration/admin/patch-strict-validation.test.ts`
 * (SPEC-063-gaps T-018), which asserted 400 for unknown keys on three admin
 * routes via PATCH but never actually reached body validation: two of the three
 * routes are registered as PUT (a PATCH to them never matches), and the requests
 * were rejected earlier by the admin permission guard (the test's mock actor
 * lacked `ACCESS_API_ADMIN`). So it gave zero real coverage of the
 * `.strict()`-at-the-HTTP-layer behavior it claimed to protect.
 *
 * This drives the actually-fixed path end-to-end with a synthetic route:
 * `createCRUDRoute` → `createOpenAPISchema` (which now PRESERVES `.strict()` /
 * `.passthrough()` instead of silently downgrading to `strip`) →
 * `@hono/zod-openapi` body validator → the router's `defaultHook` (400 on
 * validation error). No DB, so it runs in the default unit gate rather than the
 * DB-backed e2e config.
 */

import { OpenAPIHono, z } from '@hono/zod-openapi';
import { describe, expect, it } from 'vitest';
import { createCRUDRoute } from '../../src/utils/route-factory';

const ResponseSchema = z.object({ ok: z.boolean() });

/**
 * Build a one-route app whose POST body is validated with the given mode.
 * The handler is trivial (no actor / DB) so the test isolates the validator.
 */
function makeApp(bodySchema: z.ZodTypeAny) {
    const route = createCRUDRoute({
        method: 'post',
        path: '/thing',
        summary: 'Strict body test route',
        description: 'Synthetic route for HOS-106 strict-body validation.',
        tags: ['Test'],
        requestBody: bodySchema,
        responseSchema: ResponseSchema,
        options: {},
        handler: async () => ({ ok: true })
    });

    const app = new OpenAPIHono();
    app.route('/', route);
    return app;
}

async function post(app: ReturnType<typeof makeApp>, body: unknown): Promise<number> {
    const res = await app.request('/thing', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
    });
    return res.status;
}

describe('HTTP-layer strict request-body rejection (HOS-106)', () => {
    it('a .strict() body rejects an unknown key with 400', async () => {
        const app = makeApp(z.object({ name: z.string() }).strict());

        expect(await post(app, { name: 'x', unexpected: 'boom' })).toBe(400);
    });

    it('a .strict() body still accepts a valid payload (control — proves the 400 is the unknown key)', async () => {
        const app = makeApp(z.object({ name: z.string() }).strict());

        // POST success maps to 201 in the factory; the point is it is NOT a 400.
        expect(await post(app, { name: 'x' })).not.toBe(400);
    });

    it('a default (strip) body accepts an unknown key — pre-existing behavior preserved', async () => {
        const app = makeApp(z.object({ name: z.string() }));

        expect(await post(app, { name: 'x', unexpected: 'boom' })).not.toBe(400);
    });

    it('a .passthrough() body accepts an unknown key — third-party payloads stay permissive', async () => {
        const app = makeApp(z.object({ name: z.string() }).passthrough());

        expect(await post(app, { name: 'x', unexpected: 'boom' })).not.toBe(400);
    });
});
