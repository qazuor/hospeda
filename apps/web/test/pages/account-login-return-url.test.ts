/**
 * @file account-login-return-url.test.ts
 * @description Source-reading regression tests (HOS-2433): every login redirect
 * under `/mi-cuenta/` must carry the return URL (path AND query string), and the
 * owner inbox pages must be gated by permission, not by role name.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '../../src/pages/[lang]/mi-cuenta');

const listAstro = (dir: string): readonly string[] =>
    readdirSync(dir).flatMap((entry) => {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) return listAstro(full);
        return full.endsWith('.astro') ? [full] : [];
    });

const pages = listAstro(ROOT).map((file) => ({
    rel: relative(ROOT, file),
    source: readFileSync(file, 'utf8')
}));

describe('mi-cuenta login redirects keep the return URL (HOS-2433)', () => {
    it('finds the account pages', () => {
        expect(pages.length).toBeGreaterThan(40);
    });

    it.each(
        pages.map((p) => [p.rel, p.source] as const)
    )('%s never redirects to a bare signin URL', (_rel, source) => {
        expect(source).not.toMatch(/path:\s*['"`]auth\/signin['"`]\s*\}\s*\)\s*\)/);
        expect(source).not.toMatch(/\/auth\/signin['"`)]/);
    });

    it.each(
        pages
            .filter((p) => /Astro\.redirect\(\s*buildLoginRedirect/.test(p.source))
            .map((p) => [p.rel, p.source] as const)
    )('%s passes path and query string as the return URL', (_rel, source) => {
        expect(source).toContain('currentUrl: Astro.url.pathname + Astro.url.search');
    });
});

describe('consultas-propietario pages gate by permission (HOS-2433)', () => {
    const owner = pages.filter((p) => p.rel.startsWith('consultas-propietario'));

    it('covers the inbox and the thread', () => {
        expect(owner).toHaveLength(2);
    });

    it.each(
        owner.map((p) => [p.rel, p.source] as const)
    )('%s sends users without the owner-inbox permission back to the account home (HOS-2622 D1)', (_rel, source) => {
        expect(source).toContain("guardPublisherArea({ astro: Astro, area: 'inbox' })");
        expect(source).toContain('if (denied) return denied;');
        expect(source).not.toMatch(/user\.role\s*===/);
    });

    it.each(
        owner.map((p) => [p.rel, p.source] as const)
    )('%s sends signed-out visitors to login with the return path first', (_rel, source) => {
        const redirectAt = source.indexOf(
            'Astro.redirect(buildLoginRedirect({ locale, currentUrl: Astro.url.pathname + Astro.url.search }))'
        );
        expect(redirectAt).toBeGreaterThan(-1);
        expect(redirectAt).toBeLessThan(source.indexOf('guardPublisherArea('));
    });
});

describe('editor resolvers keep the return URL (HOS-2433)', () => {
    it.each([
        'src/lib/editor/resolve-editor-page.ts',
        'src/lib/editor/resolve-listing-editor-page.ts'
    ])('%s builds the login redirect from path and query string', (rel) => {
        const source = readFileSync(resolve(__dirname, '../..', rel), 'utf8');
        expect(source).toContain('buildLoginRedirect');
        expect(source).toContain('astro.url.pathname + astro.url.search');
        expect(source).not.toMatch(/path:\s*['"`]auth\/signin['"`]/);
    });
});
