/**
 * @file PropertyCard.test.ts
 * @description Integration tests for PropertyCard.astro — verifies admin-only
 * edit links were removed (SPEC-205 Phase 4), that web-native edit link
 * was added (SPEC-208 PR2), and that the thumbnail is requested through the
 * Cloudinary transform pipeline rather than the original upload (HOS-637).
 *
 * `.astro` files cannot be rendered by vitest in this repo (no Astro vite
 * plugin in the test pipeline), so the HOS-637 assertions read the SOURCE —
 * same documented pattern as `PartnerMentionsSection.test.ts`. To keep the
 * source check from being vacuous (`toContain('getMediaUrl')` alone would
 * survive a mutation that calls `getMediaUrl` on the WRONG variable), it is
 * paired with a real call to `getMediaUrl` using the exact preset/options
 * this component applies, proving those options actually shrink a
 * representative Cloudinary URL instead of merely being present in the file.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getMediaUrl } from '@repo/media';
import { describe, expect, it } from 'vitest';

const propertyCardSource = readFileSync(
    resolve(__dirname, '../../../src/components/host/PropertyCard.astro'),
    'utf8'
);

describe('PropertyCard.astro — SPEC-205 Phase 4 + SPEC-208 PR2', () => {
    it('should NOT contain an admin-only edit link', () => {
        // The old edit link pointed to admin: /accommodations/{id}/edit
        // SPEC-208 PR2 replaced it with a web editor link using buildUrl
        // publishUrl still uses adminBase, but editUrl must use buildUrl
        expect(propertyCardSource).not.toMatch(/editUrl.*adminBase/);
    });

    it('should contain a web editor link using buildUrl', () => {
        // SPEC-208 PR2: edit link routes to the web editor page
        expect(propertyCardSource).toContain('editUrl');
        expect(propertyCardSource).toContain('mi-cuenta/propiedades/');
        expect(propertyCardSource).toContain('/editar');
    });

    it('should render an "Editar" action button', () => {
        // The edit button text should appear in the template actions section
        expect(propertyCardSource).toContain('host.properties.card.actions.edit');
    });

    it('should still contain the publish action for DRAFT properties', () => {
        // HOS-110: the dead `?action=publish` admin link was replaced by a
        // guided web-native PublishButton island with trial confirmation copy.
        expect(propertyCardSource).toContain('PublishButton');
        expect(propertyCardSource).toContain('host.properties.card.actions.publish');
    });

    it('should still contain the view-on-site link for ACTIVE properties', () => {
        expect(propertyCardSource).toContain('viewOnSiteUrl');
        expect(propertyCardSource).toContain('host.properties.card.actions.viewOnSite');
    });

    it('should still contain the unpublish link for ACTIVE properties', () => {
        // SPEC-208 PR2: unpublish uses a React island (UnpublishButton) rather than a plain anchor.
        // The component conditionally renders UnpublishButton only for ACTIVE properties and
        // passes the unpublish i18n label + the accommodationId prop.
        expect(propertyCardSource).toContain('UnpublishButton');
        expect(propertyCardSource).toContain('host.properties.card.actions.unpublish');
    });
});

describe('PropertyCard.astro — HOS-637 thumbnail transform', () => {
    it('imports getMediaUrl and applies it to the raw thumbnail before rendering it', () => {
        expect(propertyCardSource).toContain("import { getMediaUrl } from '@repo/media'");
        // The raw gallery/featuredImage/placeholder fallback chain must feed
        // getMediaUrl, not the <img> directly — this is what a regression
        // (dropping the getMediaUrl call, or re-inlining the raw chain into
        // thumbnailUrl) would break.
        expect(propertyCardSource).toContain(
            "const thumbnailUrl = getMediaUrl(rawThumbnailUrl, { preset: 'card', height: 220 });"
        );
        expect(propertyCardSource).toContain('src={thumbnailUrl}');
        // Guard against the exact regression this issue reported: the <img>
        // binding directly to the untransformed chain.
        expect(propertyCardSource).not.toContain('src={rawThumbnailUrl}');
    });

    it('the chosen preset+options actually shrink a representative original photo URL', () => {
        // Mirrors the real 4000x2252 photo from the F-38 smoke finding: a bare
        // Cloudinary upload URL with no transform segment.
        const originalUrl =
            'https://res.cloudinary.com/hospeda/image/upload/v1699999999/hospeda/prod/accommodation-x/original.jpg';

        const transformedUrl = getMediaUrl(originalUrl, { preset: 'card', height: 220 });

        expect(transformedUrl).not.toBe(originalUrl);
        expect(transformedUrl).toContain('/upload/w_400,h_220,c_fill');
        expect(transformedUrl).toContain('q_auto');
        expect(transformedUrl).toContain('f_auto');
        expect(transformedUrl).toContain('dpr_auto');
    });
});

/**
 * HOS-982 — the printable QR sheet on the accommodation card.
 *
 * `.astro` files cannot be rendered by vitest in this repo, so these read the
 * SOURCE, the same documented pattern the HOS-637 block above uses. A source
 * check goes vacuous the moment it only asks whether a NAME appears, so each
 * assertion below isolates the ONE expression it is about and asserts its
 * operands — the island's own behaviour (request, states, a11y) is covered for
 * real in `test/components/shared/ListingQrSheet.test.tsx`.
 */
describe('PropertyCard.astro — HOS-982 printable QR sheet', () => {
    /** The `<ListingQrSheet …/>` element only, so a match cannot come from elsewhere. */
    const qrElement = /<ListingQrSheet\b[\s\S]*?\/>/.exec(propertyCardSource)?.[0] ?? '';

    it('renders the shared QR-sheet island for the accommodation vertical', () => {
        expect(propertyCardSource).toContain(
            "import { ListingQrSheet } from '@/components/shared/qr/ListingQrSheet.client'"
        );
        expect(qrElement).not.toBe('');
        expect(qrElement).toContain('vertical="accommodation"');
        expect(qrElement).toContain('listingId={property.id}');
        expect(qrElement).toContain('slug={property.slug}');
    });

    it('hydrates it lazily — one card in a grid, and the panel idles until clicked', () => {
        expect(qrElement).toContain('client:visible');
        expect(qrElement).not.toContain('client:load');
    });

    it('feeds it BOTH clauses of "published", never just the lifecycle state', () => {
        // A DRAFT row can carry PUBLIC visibility and still have no page, so
        // `visibility === PUBLIC` alone would offer a download that can only
        // answer 404 — which is the same 404 the route answers for "not yours".
        const canPrint =
            /const canPrintQrSheet =([\s\S]*?);/.exec(propertyCardSource)?.[1]?.trim() ?? '';
        expect(canPrint).toContain('isActive');
        expect(canPrint).toContain('property.visibility === VisibilityEnum.PUBLIC');
        expect(canPrint).toContain('&&');
        expect(qrElement).toContain('isPublished={canPrintQrSheet}');
    });
});
