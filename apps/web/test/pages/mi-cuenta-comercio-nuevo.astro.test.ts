/**
 * @file mi-cuenta-comercio-nuevo.astro.test.ts
 * @description Source-level assertions for what became of the owner
 * self-service commerce create path (HOS-687, then HOS-1156 D-6).
 *
 * Astro pages cannot be rendered via Vitest, so these are string-level
 * assertions on the `.astro` source — the same pattern used elsewhere in this
 * repo. A source read cannot tell a DECLARED value from a RENDERED one, so it is
 * a poor instrument for "what does this page output" and a good one for what
 * both of those changes actually did: remove a guard, replace a target, retire a
 * body.
 *
 * ## What changed under this file's feet
 *
 * HOS-687 opened these two pages to any signed-in account, because demanding
 * `COMMERCE_EDIT_OWN` on the page that GRANTS it made the role unreachable.
 * HOS-1156 then moved the form itself to `/publicar/{vertical}/` and left both
 * URLs as 301s — so the login redirect these cases used to assert is gone too,
 * along with the login it required: the page they now point at is public (D-1).
 *
 * The HOS-687 property did not disappear, it MOVED. It is asserted where the
 * form lives now (`publicar-commerce-pages.test.ts`: no `buildLoginRedirect`,
 * no role gate) and on the API route that grants the role
 * (`commerce/protected/create.ts` declares no `requiredPermissions`). What stays
 * here is its companion half — that only the CREATE path was ever opened.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PAGES_ROOT = resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/comercio');

/**
 * Reads a page with its block comments removed.
 *
 * The two redirect pages document what they replaced, by name — `AccountLayout`,
 * the login redirect — because that is the most useful thing they can tell the
 * next reader. A naive `not.toContain` would read the explanation as the thing
 * itself.
 */
function readStripped(path: string): string {
    return readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
}

const createRedirectSource = readStripped(resolve(PAGES_ROOT, 'nuevo/[vertical].astro'));
const pickerRedirectSource = readStripped(resolve(PAGES_ROOT, 'nuevo/index.astro'));
const listingIndexSource = readFileSync(resolve(PAGES_ROOT, 'index.astro'), 'utf8');
/**
 * The commerce editor's shared front door.
 *
 * HOS-1080 split the single `[vertical]/[id]/editar.astro` into eleven routes,
 * and the commerce-role gate moved into the resolver every one of them calls —
 * which is the point of having one. That each route really goes through it is
 * asserted in `commerce-editor-routes.test.ts`; that the gate is still IN it is
 * asserted below.
 */
const editorResolverSource = readFileSync(
    resolve(__dirname, '../../src/lib/editor/resolve-commerce-editor-page.ts'),
    'utf8'
);

describe('mi-cuenta/comercio/nuevo — both URLs are now 301s (HOS-1156 D-6)', () => {
    it.each([
        ['the per-vertical create form', () => createRedirectSource],
        ['the vertical picker', () => pickerRedirectSource]
    ])('%s redirects and serves no body', (_label, read) => {
        const src = read();
        expect(src).toContain('return Astro.redirect(');
        expect(src).toMatch(/Astro\.redirect\([\s\S]*?,\s*301\s*\)/);
        expect(src).toContain('export const prerender = false;');
        // A 302 would be wrong: the form moved location, it did not become
        // temporarily unavailable.
        expect(src).not.toMatch(/Astro\.redirect\([\s\S]*?,\s*302\s*\)/);
    });

    it.each([
        ['the per-vertical create form', () => createRedirectSource],
        ['the vertical picker', () => pickerRedirectSource]
    ])('%s carries nothing of the page it replaced', (_label, read) => {
        const src = read();
        expect(src).not.toContain('AccountLayout');
        expect(src).not.toContain('CommerceCreateForm');
        expect(src).not.toContain('destinationsApi');
        // HOS-693 §6.2 removed the lead pre-fill; nothing may bring it back
        // through a redirect page either.
        expect(src).not.toContain('fetchMyCommerceLead');
        expect(src).not.toContain('prefill');
    });

    it('no longer asks an anonymous visitor to log in first (D-1)', () => {
        // The destination is public now. Redirecting to sign-in on the way there
        // would demand an account in order to learn that no account is needed —
        // and `PUBLIC_REDIRECT_PATHS` exists so the middleware does not do it
        // either.
        expect(createRedirectSource).not.toContain('buildLoginRedirect');
        expect(pickerRedirectSource).not.toContain('buildLoginRedirect');
    });

    it('sends each vertical to ITS OWN publish page, and 404s an unknown one', () => {
        expect(createRedirectSource).toContain('PUBLISH_PAGE_PATH_BY_VERTICAL[verticalParam]');
        // A typo'd segment must not become a 301 to a page it never named.
        expect(createRedirectSource).toMatch(/status:\s*404/);
    });
});

describe('only the CREATE path was ever opened (HOS-687 companion half)', () => {
    it('the listing index and the editor KEEP their commerce-role gate', () => {
        // The pages that READ and WRITE existing listings still require the
        // role. If a later change strips the gate from either, this fails.
        expect(listingIndexSource).toContain('hasCommerceNavAccess');
        expect(editorResolverSource).toContain('hasCommerceNavAccess');
    });
});
