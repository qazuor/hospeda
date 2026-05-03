/**
 * OpenAPI multipart contract tests for media routes
 * (SPEC-078-GAPS T-034 / GAP-078-072).
 *
 * Verifies the generated `/docs/openapi.json` document declares the
 * `multipart/form-data` request body for both upload routes (admin entity
 * upload and protected avatar upload). Without this, clients and the docs
 * UI would not see the actual upload contract — they would see no body
 * schema at all.
 *
 * @module test/routes/media/openapi-multipart
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import type { AppOpenAPI } from '../../../src/types';

interface OpenApiPathItem {
    requestBody?: {
        content?: Record<string, { schema?: unknown }>;
    };
}

interface OpenApiDoc {
    paths?: Record<string, Record<string, OpenApiPathItem>>;
}

describe('Media routes OpenAPI multipart documentation', () => {
    let doc: OpenApiDoc;

    // initApp() boots the full Hono OpenAPI stack with auth, rate limit,
    // metrics, validation, and route registration. On CI runners with cold
    // disk caches and no local DB, the boot can exceed the default 10s
    // hookTimeout. Bump per-hook to 30s.
    beforeAll(async () => {
        const app: AppOpenAPI = initApp();
        // The docs route flows through the standard middleware stack, which
        // includes the origin verification middleware. An allowed origin
        // header is required to avoid a 400 from origin verification, just
        // like a real browser request from the docs UI.
        const res = await app.request('/docs/openapi.json', {
            method: 'GET',
            headers: {
                accept: 'application/json',
                origin: 'http://localhost:3000',
                'user-agent': 'vitest'
            }
        });
        expect(res.status).toBe(200);
        doc = (await res.json()) as OpenApiDoc;
    }, 30_000);

    it('declares multipart/form-data on POST /api/v1/admin/media/upload', () => {
        const path = doc.paths?.['/api/v1/admin/media/upload'];
        expect(path, 'admin upload route should be present in OpenAPI doc').toBeDefined();

        const post = path?.post;
        expect(post, 'POST entry should exist on admin upload route').toBeDefined();

        const content = post?.requestBody?.content;
        expect(content, 'admin upload should declare a requestBody.content').toBeDefined();
        expect(
            content && 'multipart/form-data' in content,
            'admin upload should expose multipart/form-data content type'
        ).toBe(true);
    });

    it('declares multipart/form-data on POST /api/v1/protected/media/upload', () => {
        const path = doc.paths?.['/api/v1/protected/media/upload'];
        expect(path, 'protected upload route should be present in OpenAPI doc').toBeDefined();

        const post = path?.post;
        expect(post, 'POST entry should exist on protected upload route').toBeDefined();

        const content = post?.requestBody?.content;
        expect(content, 'protected upload should declare a requestBody.content').toBeDefined();
        expect(
            content && 'multipart/form-data' in content,
            'protected upload should expose multipart/form-data content type'
        ).toBe(true);
    });
});
