/**
 * @file publicaciones-mi-cuenta-nuevo.astro.test.ts
 * @description Source-level regression tests for
 * `mi-cuenta/publicaciones/nuevo.astro` (HOS-374 §5.2.2 post create page):
 * server-rendered, session-gated, gated on `hasPostsNavAccess`, and mounts
 * `PostCreateForm` with `client:load`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pageSource = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/publicaciones/nuevo.astro'),
    'utf8'
);

describe('mi-cuenta/publicaciones/nuevo.astro', () => {
    it('is server-rendered (not prerendered)', () => {
        expect(pageSource).toContain('export const prerender = false');
    });

    it('redirects unauthenticated visitors to the login page', () => {
        expect(pageSource).toContain('buildLoginRedirect(');
    });

    it('gates on hasPostsNavAccess (POST_CREATE) and redirects to mi-cuenta otherwise', () => {
        expect(pageSource).toContain("from '@/lib/nav-gating'");
        expect(pageSource).toContain('hasPostsNavAccess(');
        expect(pageSource).toContain("path: 'mi-cuenta'");
    });

    it('mounts PostCreateForm hydrated with client:load', () => {
        expect(pageSource).toContain("from '@/components/post/editor/PostCreateForm.client'");
        expect(pageSource).toMatch(/<PostCreateForm[\s\S]*client:load/);
    });

    it('never calls fetch() directly', () => {
        expect(pageSource).not.toContain('fetch(');
    });
});
