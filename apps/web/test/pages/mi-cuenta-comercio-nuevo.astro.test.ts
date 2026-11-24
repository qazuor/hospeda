/**
 * @file mi-cuenta-comercio-nuevo.astro.test.ts
 * @description Source-level assertions for what became of the owner
 * self-service venue/experience create path (HOS-687, then HOS-1156 D-6).
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
 * the vertical EDIT_OWN permission on the page that grants it made publishing unreachable.
 * HOS-1156 then moved the form itself to `/publicar/{vertical}/` and left both
 * URLs as 301s — so the login redirect these cases used to assert is gone too,
 * along with the login it required: the page they now point at is public (D-1).
 *
 * The HOS-687 property did not disappear, it MOVED. It is asserted where the
 * form lives now (`publicar-listing-pages.test.ts`: no `buildLoginRedirect`,
 * no role gate) and on the API route that grants the role
 * (the protected create routes declare no `requiredPermissions`). What stays
 * here is its companion half — that only the CREATE path was ever opened.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    ACCOUNT_PUBLISH_HUB_PATH,
    PUBLISH_PAGE_PATH_BY_VERTICAL
} from '../../src/lib/publish/publish-page-paths';

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
 * The venue/experience editor's shared front door.
 *
 * HOS-1080 split the single `[vertical]/[id]/editar.astro` into eleven routes,
 * and the listing-role gate moved into the resolver every one of them calls —
 * which is the point of having one. That each route really goes through it is
 * asserted in `listing-editor-routes.test.ts`; that the gate is still IN it is
 * asserted below.
 */
const editorResolverSource = readFileSync(
    resolve(__dirname, '../../src/lib/editor/resolve-listing-editor-page.ts'),
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
        expect(src).not.toContain('ListingCreateForm');
        expect(src).not.toContain('destinationsApi');
        // HOS-693 §6.2 removed the lead pre-fill; nothing may bring it back
        // through a redirect page either.
        expect(src).not.toContain('fetchMyListingLead');
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

    it('regression HOS-2602: the vertical-less picker never lands on the accommodation form', () => {
        // "Comercio" is a venue or an experience. The old target,
        // `PUBLISH_PAGE_PATH_BY_VERTICAL.accommodation` (`/publicar/`), put a
        // venue owner on «Nombre del alojamiento».
        expect(pickerRedirectSource).not.toContain('PUBLISH_PAGE_PATH_BY_VERTICAL');
        expect(pickerRedirectSource).not.toContain('accommodation');
        // It goes where "+ Nuevo comercio" goes: the in-account hub that offers
        // each vertical's own form.
        expect(pickerRedirectSource).toMatch(/path:\s*ACCOUNT_PUBLISH_HUB_PATH/);
        expect(listingIndexSource).toContain('path: ACCOUNT_PUBLISH_HUB_PATH');
        expect(ACCOUNT_PUBLISH_HUB_PATH).toBe('mi-cuenta/publica');
    });

    it('sends each vertical to ITS OWN publish page, and 404s an unknown one', () => {
        // A venue owner lands on the venue form, never the accommodation one.
        expect(PUBLISH_PAGE_PATH_BY_VERTICAL.venue).toBe('publicar/comer-y-salir');
        expect(PUBLISH_PAGE_PATH_BY_VERTICAL.experience).toBe('publicar/experiencias');
        expect(createRedirectSource).toContain('PUBLISH_PAGE_PATH_BY_VERTICAL[verticalParam]');
        // A typo'd segment must not become a 301 to a page it never named.
        expect(createRedirectSource).toMatch(/status:\s*404/);
    });
});

describe('only the CREATE path was ever opened (HOS-687 companion half)', () => {
    it('the listing index and the editor KEEP their listing-role gate', () => {
        // The pages that READ and WRITE existing listings still require a
        // gate. If a later change strips it from either, this fails. HOS-2559
        // moved the index to the per-vertical permission gate
        // (`resolveOwnerListPage`, VENUE_EDIT_OWN / EXPERIENCE_EDIT_OWN).
        expect(listingIndexSource).toContain('resolveOwnerListPage');
        expect(listingIndexSource).toMatch(/decision\.kind === 'forbidden'/);
        expect(editorResolverSource).toContain('hasListingNavAccess');
    });
});
