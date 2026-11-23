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

    it('TEST:1767:24 — shows a no-access state instead of redirecting to mi-cuenta', () => {
        expect(pageSource).toContain("from '@/lib/nav-gating'");
        expect(pageSource).toContain('hasEventsNavAccess(');
        // HOS-2505: the no-access state is the kit LockedState (built by
        // OwnContentListView with the editor application link).
        expect(pageSource).toContain("? 'locked'");
        expect(pageSource).not.toMatch(
            /Astro\.redirect\(\s*buildUrl\(\s*\{\s*locale,\s*path:\s*'mi-cuenta'\s*\}\s*\)\s*\)/
        );
        expect(pageSource.indexOf('buildLoginRedirect(')).toBeLessThan(
            pageSource.indexOf('hasEventsNavAccess(')
        );
        expect(pageSource).toMatch(/canManageEvents\s*\?\s*await\s+eventEditApi\.listOwn\(/);
        expect(pageSource.indexOf('hasEventsNavAccess(')).toBeLessThan(
            pageSource.indexOf('eventEditApi.listOwn(')
        );
    });

    it('redirects unauthenticated visitors to the login page', () => {
        expect(pageSource).toContain('buildLoginRedirect(');
    });

    it('renders the kit list template with all three orthogonal state axes (HOS-2505)', () => {
        expect(pageSource).toContain('<OwnContentListView');
        expect(pageSource).not.toContain('EditableContentCard');
        expect(pageSource).toContain('moderationState: event.moderationState');
        expect(pageSource).toContain('visibility: event.visibility');
        expect(pageSource).toContain('lifecycleState: event.lifecycleState');
    });

    it('wires the page help link and the retry island into the template', () => {
        expect(pageSource).toMatch(/<PageHelpLink slot="help"/);
        expect(pageSource).toMatch(/<ContentListReloadError slot="errorRegion"/);
    });

    it('transforms the raw response through transformEventEditCardList', () => {
        expect(pageSource).toContain('transformEventEditCardList(');
    });

    it('paginates through ?page= instead of a silent cap (HOS-2440)', () => {
        expect(pageSource).toContain('ACCOUNT_LIST_PAGE_SIZE');
        expect(pageSource).toContain('parsePageParam(');
        expect(pageSource).toContain('pageCount={pageState.totalPages}');
    });
});
