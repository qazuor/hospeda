/**
 * @file publicaciones-mi-cuenta-index.test.ts
 * @description Source-level regression tests for
 * `mi-cuenta/publicaciones/index.astro` (HOS-374 Phase 2 2C-1): forwards the
 * session cookie through `lib/api/`, never sends `authorId`, gates on
 * `hasPostsNavAccess`, and never calls `fetch()` directly.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pageSource = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/publicaciones/index.astro'),
    'utf8'
);

describe('mi-cuenta/publicaciones/index.astro', () => {
    it('is server-rendered (not prerendered)', () => {
        expect(pageSource).toContain('export const prerender = false');
    });

    it('goes through lib/api/, never calling fetch() directly', () => {
        expect(pageSource).toContain("from '@/lib/api/endpoints-protected'");
        expect(pageSource).not.toContain('fetch(');
    });

    it('forwards the session cookie header to postEditApi.listOwn', () => {
        expect(pageSource).toContain("Astro.request.headers.get('cookie')");
        expect(pageSource).toContain('cookieHeader');
        expect(pageSource).toContain('postEditApi.listOwn(');
    });

    it('never sends authorId as a query parameter', () => {
        expect(pageSource).not.toContain('authorId');
    });

    it('gates on hasPostsNavAccess and redirects to mi-cuenta otherwise', () => {
        expect(pageSource).toContain("from '@/lib/nav-gating'");
        expect(pageSource).toContain('hasPostsNavAccess(');
        expect(pageSource).toContain("path: 'mi-cuenta'");
    });

    it('redirects unauthenticated visitors to the login page', () => {
        expect(pageSource).toContain('buildLoginRedirect(');
    });

    it('renders the EditableContentCard with all three orthogonal state props', () => {
        expect(pageSource).toContain('<EditableContentCard');
        expect(pageSource).toContain('moderationState={post.moderationState}');
        expect(pageSource).toContain('visibility={post.visibility}');
        expect(pageSource).toContain('lifecycleState={post.lifecycleState}');
    });

    it('transforms the raw response through transformPostEditCardList', () => {
        expect(pageSource).toContain('transformPostEditCardList(');
    });

    it('renders a create CTA linking to the create page (HOS-374 §5.2.2)', () => {
        expect(pageSource).toContain("path: 'mi-cuenta/publicaciones/nuevo'");
        expect(pageSource).toContain('createUrl');
        expect(pageSource).toMatch(/href=\{createUrl\}/);
    });

    it('passes the create URL to EmptyState as its action', () => {
        expect(pageSource).toContain('actionUrl={createUrl}');
        expect(pageSource).toContain('actionLabel={emptyCtaLabel}');
    });
});
