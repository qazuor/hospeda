/**
 * @file eventos-mi-cuenta-index.test.ts
 * @description Source-level regression tests for
 * `mi-cuenta/eventos/index.astro` (HOS-374 Phase 2 2C-1). Structural mirror
 * of `publicaciones-mi-cuenta-index.test.ts` — see that file for the shared
 * rationale.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pageSource = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/eventos/index.astro'),
    'utf8'
);

describe('mi-cuenta/eventos/index.astro', () => {
    it('is server-rendered (not prerendered)', () => {
        expect(pageSource).toContain('export const prerender = false');
    });

    it('goes through lib/api/, never calling fetch() directly', () => {
        expect(pageSource).toContain("from '@/lib/api/endpoints-protected'");
        expect(pageSource).not.toContain('fetch(');
    });

    it('forwards the session cookie header to eventEditApi.listOwn', () => {
        expect(pageSource).toContain("Astro.request.headers.get('cookie')");
        expect(pageSource).toContain('cookieHeader');
        expect(pageSource).toContain('eventEditApi.listOwn(');
    });

    it('never sends authorId as a query parameter', () => {
        expect(pageSource).not.toContain('authorId');
    });

    it('gates on hasEventsNavAccess and redirects to mi-cuenta otherwise', () => {
        expect(pageSource).toContain("from '@/lib/nav-gating'");
        expect(pageSource).toContain('hasEventsNavAccess(');
        expect(pageSource).toContain("path: 'mi-cuenta'");
    });

    it('redirects unauthenticated visitors to the login page', () => {
        expect(pageSource).toContain('buildLoginRedirect(');
    });

    it('renders the EditableContentCard with all three orthogonal state props', () => {
        expect(pageSource).toContain('<EditableContentCard');
        expect(pageSource).toContain('moderationState={event.moderationState}');
        expect(pageSource).toContain('visibility={event.visibility}');
        expect(pageSource).toContain('lifecycleState={event.lifecycleState}');
    });

    it('transforms the raw response through transformEventEditCardList', () => {
        expect(pageSource).toContain('transformEventEditCardList(');
    });

    it('renders a create CTA linking to the create page (HOS-374 §5.2.2)', () => {
        expect(pageSource).toContain("path: 'mi-cuenta/eventos/nuevo'");
        expect(pageSource).toContain('createUrl');
        expect(pageSource).toMatch(/href=\{createUrl\}/);
    });

    it('passes the create URL to EmptyState as its action', () => {
        expect(pageSource).toContain('actionUrl={createUrl}');
        expect(pageSource).toContain('actionLabel={emptyCtaLabel}');
    });
});
