/**
 * @file eventos-mi-cuenta-editar.test.ts
 * @description Source-level regression tests for
 * `mi-cuenta/eventos/[id]/editar.astro` (HOS-374 Phase 2 2C-3).
 *
 * @module test/pages/eventos-mi-cuenta-editar
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pageSource = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/eventos/[id]/editar.astro'),
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
 * scan while the variable is computed above.
 */
const template = pageSource.slice(pageSource.lastIndexOf('---') + 3);

describe('mi-cuenta/eventos/[id]/editar.astro — data path', () => {
    it('is server-rendered (not prerendered)', () => {
        expect(pageSource).toContain('export const prerender = false');
    });

    it('goes through lib/api/, never calling fetch() directly', () => {
        expect(pageSource).toContain("from '@/lib/api/endpoints-protected'");
        expect(pageSource).not.toContain('fetch(');
    });

    it('loads the event through the PROTECTED getById, forwarding the session cookie', () => {
        // The page hands the protected read to resolveAuthoredEditorItem, which
        // forwards the session cookie to it (HOS-2556).
        expect(pageSource).toContain('fetchById: eventEditApi.getById');
        expect(helperSource).toContain("astro.request.headers.get('cookie')");
        expect(helperSource).toContain('fetchById({ id, cookieHeader })');
        expect(pageSource).not.toContain('/public/events/');
        expect(helperSource).not.toContain('/public/events/');
        expect(helperSource).not.toContain('fetch(');
    });

    it('renders the in-layout 404 (no redirect to the list) when the event cannot be loaded', () => {
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

    it('gates on hasEventsNavAccess like the listing it links from', () => {
        expect(pageSource).toContain("from '@/lib/nav-gating'");
        expect(pageSource).toContain('hasEventsNavAccess(');
    });

    it('TEST:1767:25 — shows a no-access state instead of redirecting to mi-cuenta', () => {
        // HOS-2505: the kit LockedState with reason.kind='permission' (D9).
        expect(pageSource).toContain('<LockedState');
        expect(pageSource).toContain("kind: 'permission'");
        expect(pageSource).toContain('colaborar/editores');
        expect(pageSource).toContain('account.myContent.events.noAccess.title');
        expect(pageSource).not.toMatch(
            /Astro\.redirect\(\s*buildUrl\(\s*\{\s*locale,\s*path:\s*'mi-cuenta'\s*\}\s*\)\s*\)/
        );
        expect(pageSource.indexOf('buildLoginRedirect(')).toBeLessThan(
            pageSource.indexOf('hasEventsNavAccess(')
        );
        expect(pageSource).toMatch(/if \(canManageEvents\) \{[\s\S]*resolveAuthoredEditorItem\(/);
        expect(pageSource.indexOf('hasEventsNavAccess(')).toBeLessThan(
            pageSource.indexOf('resolveAuthoredEditorItem(')
        );
        expect(pageSource).not.toContain('Astro.redirect(listUrl)');
        expect(template).toContain('{event ?');
        expect(template.indexOf('<EventEditor')).toBeGreaterThan(template.indexOf('{event ?'));
    });
});

describe('mi-cuenta/eventos/[id]/editar.astro — capabilities', () => {
    it('derives publish/delete from the permission set, never from roles', () => {
        expect(pageSource).toContain("permissions.includes('event.publish.own')");
        expect(pageSource).toContain("permissions.includes('event.delete.own')");
        expect(pageSource).not.toContain("roles.includes('EDITOR')");
    });

    it('honours the broad permissions as well as the _OWN ones', () => {
        expect(pageSource).toContain("permissions.includes('event.publish.toggle')");
        expect(pageSource).toContain("permissions.includes('event.delete')");
        expect(pageSource).toContain("permissions.includes('event.update')");
    });

    it('mirrors the server edit lock: APPROVED, no publish grant, no broad update', () => {
        expect(pageSource).toContain(
            "event.moderationState === 'APPROVED' && !canPublish && !canUpdateAny"
        );
    });
});

describe('mi-cuenta/eventos/[id]/editar.astro — what it renders', () => {
    it('mounts the editor island with the capability flags', () => {
        expect(template).toContain('<EventEditor');
        expect(template).toContain('canPublish={canPublish}');
        expect(template).toContain('canDelete={canDelete}');
        expect(template).toContain('isEditLocked={isEditLocked}');
    });

    it('passes the transformed event, not the raw API payload', () => {
        expect(pageSource).toContain('transformEventEditDetail(');
        expect(template).toContain('initialData={event}');
    });

    it('shows organizer, venue and slug read-only, with no control to edit them', () => {
        // All three ARE mapped by the server update, but no public catalog
        // endpoint can populate a picker for organizer/venue, and the slug is
        // immutable post-create.
        expect(template).toContain('{event.organizerName}');
        expect(template).toContain('{event.locationName}');
        expect(template).toContain('{event.slug}');
        expect(template).not.toContain('name="organizerId"');
        expect(template).not.toContain('name="locationId"');
        expect(template).not.toContain('name="slug"');
    });

    it('always offers a way back to the listing, including under the edit lock', () => {
        // HOS-2505: the kit PageHeader's back link, outside the editor island.
        expect(template).toMatch(/back=\{\{[^}]*href: listUrl \}\}/);
    });
});
