/**
 * @file eventos-mi-cuenta-nuevo.astro.test.ts
 * @description Source-level regression tests for
 * `mi-cuenta/eventos/nuevo.astro` (HOS-374 §5.2.2 event create page):
 * server-rendered, session-gated, gated on `hasEventsNavAccess`, fetches the
 * event-organizer catalog server-side (never via a direct `fetch()`), and
 * mounts `EventCreateForm` with `client:load`. Structural mirror of
 * `publicaciones-mi-cuenta-nuevo.astro.test.ts`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pageSource = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/eventos/nuevo.astro'),
    'utf8'
);

/**
 * The rendered TEMPLATE only — everything after the frontmatter's closing
 * `---`. Asserting on the whole file cannot tell "declared in the
 * frontmatter" from "actually rendered".
 */
const template = pageSource.slice(pageSource.lastIndexOf('---') + 3);

describe('mi-cuenta/eventos/nuevo.astro', () => {
    it('is server-rendered (not prerendered)', () => {
        expect(pageSource).toContain('export const prerender = false');
    });

    it('redirects unauthenticated visitors to the login page', () => {
        expect(pageSource).toContain('buildLoginRedirect(');
    });

    it('TEST:1767:20 — shows a no-access state instead of redirecting to mi-cuenta', () => {
        expect(pageSource).toContain("from '@/lib/nav-gating'");
        expect(pageSource).toContain('hasEventsNavAccess(');
        expect(pageSource).toContain('AccountEmptyState');
        expect(pageSource).toContain('colaborar/editores');
        expect(pageSource).toContain('account.myContent.events.create.noAccess.title');
        expect(pageSource).not.toMatch(
            /Astro\.redirect\(\s*buildUrl\(\s*\{\s*locale,\s*path:\s*'mi-cuenta'\s*\}\s*\)\s*\)/
        );
    });

    it('TEST:1767:21 — only mounts the form and loads organizers with access', () => {
        expect(pageSource).toMatch(/canCreateEvents\s*\?\s*await\s+eventOrganizersApi\.list\(/);
        expect(pageSource.indexOf('hasEventsNavAccess(')).toBeLessThan(
            pageSource.indexOf('eventOrganizersApi.list(')
        );

        const accessGate = template.indexOf('canCreateEvents ?');
        expect(accessGate).toBeGreaterThanOrEqual(0);
        expect(template.indexOf('<EventCreateForm')).toBeGreaterThan(accessGate);
    });

    it('TEST:1767:22 — keeps the login redirect before the role gate', () => {
        expect(pageSource.indexOf('buildLoginRedirect(')).toBeLessThan(
            pageSource.indexOf('hasEventsNavAccess(')
        );
    });

    it('fetches the organizer catalog through lib/api/, never calling fetch() directly', () => {
        expect(pageSource).toContain("from '@/lib/api/endpoints'");
        expect(pageSource).toContain('eventOrganizersApi.list(');
        expect(pageSource).not.toContain('fetch(');
    });

    it('mounts EventCreateForm hydrated with client:load, in the rendered template', () => {
        expect(pageSource).toContain("from '@/components/event/editor/EventCreateForm.client'");
        expect(template).toMatch(/<EventCreateForm[\s\S]*client:load/);
    });

    it('passes the organizer catalog and its load-failed flag to EventCreateForm', () => {
        expect(template).toContain('organizers={organizers}');
        expect(template).toContain('organizersLoadFailed={organizersLoadFailed}');
    });
});
