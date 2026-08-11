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
        expect(pageSource).toContain('eventEditApi.getById(');
        expect(pageSource).toContain("Astro.request.headers.get('cookie')");
        expect(pageSource).toContain('cookieHeader');
        expect(pageSource).not.toContain('/public/events/');
    });

    it('redirects to the listing when the event cannot be loaded', () => {
        expect(pageSource).toContain('if (!result.ok)');
        expect(pageSource).toContain('Astro.redirect(listUrl)');
    });

    it('redirects unauthenticated visitors to the login page', () => {
        expect(pageSource).toContain('buildLoginRedirect(');
    });

    it('gates on hasEventsNavAccess like the listing it links from', () => {
        expect(pageSource).toContain("from '@/lib/nav-gating'");
        expect(pageSource).toContain('hasEventsNavAccess(');
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
        expect(template).toContain('href={listUrl}');
    });
});
