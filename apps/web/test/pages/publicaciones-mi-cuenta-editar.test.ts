/**
 * @file publicaciones-mi-cuenta-editar.test.ts
 * @description Source-level regression tests for
 * `mi-cuenta/publicaciones/[id]/editar.astro` (HOS-374 Phase 2 2C-2): goes
 * through the PROTECTED getById, derives capabilities from the permission set
 * rather than roles, and mirrors the server's moderation edit lock.
 *
 * @module test/pages/publicaciones-mi-cuenta-editar
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pageSource = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/publicaciones/[id]/editar.astro'),
    'utf8'
);

const helperSource = readFileSync(
    resolve(__dirname, '../../src/lib/editor/resolve-authored-editor-item.ts'),
    'utf8'
);

/**
 * The rendered TEMPLATE only — everything after the frontmatter's closing `---`.
 *
 * Asserting on the whole file cannot tell "declared in the frontmatter" from
 * "actually rendered": a prop deleted from the template still matches a source
 * scan as long as the variable is still computed above. Cutting here is what
 * makes the render assertions below able to fail.
 */
const template = pageSource.slice(pageSource.lastIndexOf('---') + 3);

describe('mi-cuenta/publicaciones/[id]/editar.astro — data path', () => {
    it('is server-rendered (not prerendered)', () => {
        expect(pageSource).toContain('export const prerender = false');
    });

    it('goes through lib/api/, never calling fetch() directly', () => {
        expect(pageSource).toContain("from '@/lib/api/endpoints-protected'");
        expect(pageSource).not.toContain('fetch(');
    });

    it('loads the post through the PROTECTED getById, forwarding the session cookie', () => {
        // The public getById would also answer for an author, but it carries
        // `cacheTTL: 300` — an actor-shaped response there would be cached and
        // then served to the next anonymous visitor.
        // The page hands the protected read to resolveAuthoredEditorItem, which
        // forwards the session cookie to it (HOS-2556).
        expect(pageSource).toContain('fetchById: postEditApi.getById');
        expect(helperSource).toContain("astro.request.headers.get('cookie')");
        expect(helperSource).toContain('fetchById({ id, cookieHeader })');
        expect(pageSource).not.toContain('/public/posts/');
        expect(helperSource).not.toContain('/public/posts/');
        expect(helperSource).not.toContain('fetch(');
    });

    it('renders the in-layout 404 (no redirect to the list) when the post cannot be loaded', () => {
        expect(pageSource).toContain('resolveAuthoredEditorItem(');
        expect(pageSource).toContain('if (loaded.notFound)');
        expect(pageSource).toContain('return loaded.notFound');
        expect(helperSource).toContain('if (!result.ok)');
        expect(helperSource).toContain('astro.rewrite(buildAccountNotFoundTarget');
        expect(pageSource).not.toContain('Astro.redirect(listUrl)');
        expect(helperSource).not.toContain('redirect(');
    });

    it('redirects unauthenticated visitors to the login page', () => {
        expect(pageSource).toContain('buildLoginRedirect(');
    });

    it('gates on hasPostsNavAccess like the listing it links from', () => {
        expect(pageSource).toContain("from '@/lib/nav-gating'");
        expect(pageSource).toContain('hasPostsNavAccess(');
    });
});

describe('mi-cuenta/publicaciones/[id]/editar.astro — capabilities', () => {
    it('derives publish/delete from the permission set, never from roles', () => {
        // OQ-1: the "trusted editor" is two per-user grants layered on the
        // plain EDITOR role, so no role check can answer this.
        expect(pageSource).toContain("permissions.includes('post.publish.own')");
        expect(pageSource).toContain("permissions.includes('post.delete.own')");
        expect(pageSource).not.toContain("roles.includes('EDITOR')");
    });

    it('honours the broad permissions as well as the _OWN ones', () => {
        expect(pageSource).toContain("permissions.includes('post.publish.toggle')");
        expect(pageSource).toContain("permissions.includes('post.delete')");
        expect(pageSource).toContain("permissions.includes('post.update')");
    });

    it('mirrors the server edit lock: APPROVED, no publish grant, no broad update', () => {
        expect(pageSource).toContain(
            "post.moderationState === 'APPROVED' && !canPublish && !canUpdateAny"
        );
    });
});

describe('mi-cuenta/publicaciones/[id]/editar.astro — what it renders', () => {
    it('mounts the editor island with the capability flags', () => {
        expect(template).toContain('<PostEditor');
        expect(template).toContain('canPublish={canPublish}');
        expect(template).toContain('canDelete={canDelete}');
        expect(template).toContain('isEditLocked={isEditLocked}');
    });

    it('passes the transformed post, not the raw API payload', () => {
        expect(pageSource).toContain('transformPostEditDetail(');
        expect(template).toContain('initialData={post}');
    });

    it('shows the slug read-only, with no control to edit it', () => {
        expect(template).toContain('{post.slug}');
        expect(template).not.toContain('name="slug"');
    });

    it('always offers a way back to the listing, including under the edit lock', () => {
        // The editor drops its save bar when locked, so this link is the only
        // exit left on that path.
        // The shared account breadcrumb lives outside the editor island.
        expect(template).toContain('breadcrumbs={buildAccountBreadcrumbs(');
        expect(template).not.toMatch(/\bback=\{/);
    });

    it('HOS-2505: shows a permission LockedState instead of redirecting to mi-cuenta (D9)', () => {
        expect(pageSource).toContain('<LockedState');
        expect(pageSource).toContain("kind: 'permission'");
        expect(pageSource).not.toMatch(
            /Astro\.redirect\(buildUrl\(\{ locale, path: 'mi-cuenta' \}\)\)/
        );
        expect(pageSource).toMatch(/if \(canManagePosts\) \{[\s\S]*resolveAuthoredEditorItem\(/);
    });
});
