/**
 * OpenAPI document generation smoke test (HOS-106 guard).
 *
 * `createOpenAPISchema` now re-applies `.strict()` / `.passthrough()` to the
 * rebuilt request-body objects instead of downgrading them to `strip`. Because
 * that rebuilt copy is what `@hono/zod-openapi` renders into the OpenAPI
 * document, this test forces a FULL document build across every registered
 * route (via `GET /docs/openapi.json`, which calls `getOpenAPIDocument()`) to
 * prove the preserved strict/passthrough modes still render — i.e. that the
 * fix cannot silently break API startup / doc generation.
 *
 * No DB: `initApp()` only registers routes + configures OpenAPI; it does not
 * open a database connection, so this runs in the default unit gate.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../src/app';
import { validateApiEnv } from '../../src/utils/env';

describe('OpenAPI document generation with preserved strict/passthrough (HOS-106)', () => {
    let app: ReturnType<typeof initApp>;

    beforeAll(() => {
        validateApiEnv();
        app = initApp();
    });

    it('builds the full OpenAPI document without throwing on strict/passthrough bodies', async () => {
        // `user-agent` is a required header (validation middleware default);
        // without it the request is rejected before reaching the doc handler.
        const res = await app.request('/docs/openapi.json', {
            headers: { 'user-agent': 'vitest' }
        });

        expect(res.status).toBe(200);
        const doc = (await res.json()) as { openapi?: string; paths?: Record<string, unknown> };
        // A real document with routes proves generation traversed every schema
        // (including the ~25 now-strict request bodies) without erroring.
        expect(doc.openapi).toBeDefined();
        expect(doc.paths && Object.keys(doc.paths).length).toBeGreaterThan(0);
    });
});
