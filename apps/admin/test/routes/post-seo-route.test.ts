import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const seoRouteSrc = readFileSync(
    resolve(__dirname, '../../src/routes/_authed/posts/$id_.seo.tsx'),
    'utf8'
);

describe('posts/$id_.seo route', () => {
    it('uses the canonical seo.title and seo.description fields', () => {
        expect(seoRouteSrc).toContain('seo={post?.seo}');
        expect(seoRouteSrc).not.toContain('metaTitle');
        expect(seoRouteSrc).not.toContain('metaDescription');
    });

    it('saves through the shared SeoEditor component', () => {
        expect(seoRouteSrc).toContain('<SeoEditor');
        expect(seoRouteSrc).toContain('useUpdatePostMutation');
    });
});
