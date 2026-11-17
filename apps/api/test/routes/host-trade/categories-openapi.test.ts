/**
 * OpenAPI contract of the `categories` list filter (HOS-919).
 *
 * `HostTradeCategoriesFilterSchema` takes `string | string[]` and transforms to
 * `string[]`. This pins what the generated document says about it on the two
 * list routes (protected directory, admin list) and that the catalog routes
 * are documented.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

interface OpenApiParameter {
    readonly name: string;
    readonly in: string;
    readonly required?: boolean;
    readonly description?: string;
    readonly schema?: Record<string, unknown>;
}
interface OpenApiDoc {
    readonly paths: Record<string, Record<string, { parameters?: OpenApiParameter[] }>>;
}

describe('OpenAPI: host-trade `categories` filter and catalog routes (HOS-919)', () => {
    let doc: OpenApiDoc;

    beforeAll(async () => {
        validateApiEnv();
        const res = await initApp().request('/docs/openapi.json', {
            headers: { 'user-agent': 'vitest' }
        });
        expect(res.status).toBe(200);
        doc = (await res.json()) as OpenApiDoc;
    });

    it.each([
        '/api/v1/protected/host-trades',
        '/api/v1/admin/host-trades'
    ])('%s documents `categories` as an optional query parameter', (path) => {
        const param = doc.paths[path]?.get?.parameters?.find((p) => p.name === 'categories');
        expect(param).toBeDefined();
        expect(param?.in).toBe('query');
        expect(param?.required).not.toBe(true);
        expect(param?.description).toContain('comma-separated');
        expect(JSON.stringify(param?.schema)).toContain('string');
    });

    it('documents the public catalog and both admin catalog trees', () => {
        expect(doc.paths['/api/v1/public/host-trade-categories']?.get).toBeDefined();
        for (const base of [
            '/api/v1/admin/host-trade-category-groups',
            '/api/v1/admin/host-trade-categories'
        ]) {
            expect(doc.paths[base]?.get).toBeDefined();
            expect(doc.paths[base]?.post).toBeDefined();
            expect(doc.paths[`${base}/{id}`]?.get).toBeDefined();
            expect(doc.paths[`${base}/{id}`]?.patch).toBeDefined();
            expect(doc.paths[`${base}/{id}`]?.delete).toBeDefined();
            expect(doc.paths[`${base}/{id}/restore`]?.post).toBeDefined();
        }
    });
});
