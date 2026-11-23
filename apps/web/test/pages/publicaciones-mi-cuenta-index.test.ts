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

    it('HOS-2505 — shows a LockedState instead of redirecting to mi-cuenta (D9)', () => {
        expect(pageSource).toContain("from '@/lib/nav-gating'");
        expect(pageSource).toContain('hasPostsNavAccess(');
        expect(pageSource).not.toMatch(
            /Astro\.redirect\(\s*buildUrl\(\s*\{\s*locale,\s*path:\s*'mi-cuenta'\s*\}\s*\)\s*\)/
        );
        expect(pageSource).toContain("? 'locked'");
        // Without permission the list is not even requested.
        expect(pageSource).toMatch(/canManagePosts\s*\?\s*await\s+postEditApi\.listOwn\(/);
        expect(pageSource.indexOf('buildLoginRedirect(')).toBeLessThan(
            pageSource.indexOf('hasPostsNavAccess(')
        );
    });

    it('redirects unauthenticated visitors to the login page', () => {
        expect(pageSource).toContain('buildLoginRedirect(');
    });

    it('renders the kit list template with all three orthogonal state axes (HOS-2505)', () => {
        expect(pageSource).toContain('<OwnContentListView');
        expect(pageSource).not.toContain('EditableContentCard');
        expect(pageSource).toContain('moderationState: post.moderationState');
        expect(pageSource).toContain('visibility: post.visibility');
        expect(pageSource).toContain('lifecycleState: post.lifecycleState');
    });

    it('wires the page help link and the retry island into the template', () => {
        expect(pageSource).toMatch(/<PageHelpLink slot="help"/);
        expect(pageSource).toMatch(/<ContentListReloadError slot="errorRegion"/);
    });

    it('transforms the raw response through transformPostEditCardList', () => {
        expect(pageSource).toContain('transformPostEditCardList(');
    });

    it('paginates through ?page= instead of a silent cap (HOS-2440)', () => {
        expect(pageSource).toContain('ACCOUNT_LIST_PAGE_SIZE');
        expect(pageSource).toContain('parsePageParam(');
        expect(pageSource).toContain('pageCount={pageState.totalPages}');
    });
});
