/**
 * @file listing-qr-page.test.ts
 * @description HOS-2688: the two per-listing QR pages. `.astro` files cannot be
 * rendered by vitest in this repo, so these read the SOURCE and isolate the
 * expression each one is about. The gate ordering itself is enforced for every
 * publisher page by `publisher-access.guard.test.ts`; the resolver's branches
 * are exercised in `test/lib/listing/resolve-listing-qr-page.test.ts`; the
 * panel's behaviour in `test/components/shared/ListingQrSheet.test.tsx`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pagesRoot = resolve(__dirname, '../../src/pages/[lang]/mi-cuenta');
const pages = {
    accommodation: readFileSync(resolve(pagesRoot, 'propiedades/[id]/codigo-qr.astro'), 'utf8'),
    comercio: readFileSync(resolve(pagesRoot, 'comercio/[vertical]/[id]/codigo-qr.astro'), 'utf8')
} as const;

describe.each([
    [
        'accommodation',
        'resolveAccommodationQrPage',
        "guardPublisherArea({ astro: Astro, area: 'accommodationEdit' })"
    ],
    ['comercio', 'resolveComercioQrPage', 'guardVenueOrExperienceArea({ astro: Astro })']
] as const)('%s QR page', (family, resolver, guard) => {
    const source = pages[family];
    const frontmatter = source.split(/^---\s*$/m)[1] ?? '';

    it('is server-rendered and gated before it resolves anything', () => {
        expect(frontmatter).toContain('export const prerender = false;');
        const gate = frontmatter.indexOf(`const denied = ${guard};`);
        const resolution = frontmatter.indexOf(`await ${resolver}({ astro: Astro })`);
        expect(gate).toBeGreaterThan(0);
        expect(resolution).toBeGreaterThan(gate);
        expect(frontmatter).toContain('if (resolution.response) return resolution.response;');
    });

    it('carries the account breadcrumbs: section → listing → «Código QR»', () => {
        expect(frontmatter).toContain('buildAccountBreadcrumbs({');
        expect(frontmatter).toContain("current: t('listing.owner.qrPage.breadcrumb')");
        expect(frontmatter).toMatch(
            /\{ label: listing\.name, path: `mi-cuenta\/.*\$\{listing\.id\}\/editar` \}/
        );
        expect(source).toContain('breadcrumbs={breadcrumbs}');
    });

    it('renders the QR panel for the resolved listing only', () => {
        const panel = /<ListingQrSheet\b[\s\S]*?\/>/.exec(source)?.[0] ?? '';
        expect(panel).toContain('vertical={listing.vertical}');
        expect(panel).toContain('listingId={listing.id}');
        expect(panel).toContain('slug={listing.slug}');
        expect(panel).toContain('isPublished={listing.isPublished}');
        expect(panel).not.toContain('codeOnly');
    });

    it('titles the page with the listing name', () => {
        expect(frontmatter).toContain(
            "t('listing.owner.qrPage.title', undefined, { name: listing.name })"
        );
    });
});
