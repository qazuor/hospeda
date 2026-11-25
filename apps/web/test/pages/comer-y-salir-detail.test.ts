/**
 * @file comer-y-salir-detail.test.ts
 * @description Source-read tests for the venue detail page (SPEC-239 T-054).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/comer-y-salir/[slug].astro'),
    'utf8'
);

const cartaSrc = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/comer-y-salir/[slug]/carta.astro'),
    'utf8'
);

describe('comer-y-salir/[slug].astro', () => {
    describe('locale', () => {
        it('reads locale from Astro.locals.locale, not Astro.params.lang', () => {
            expect(src).toContain('Astro.locals.locale');
            expect(src).not.toContain('Astro.params.lang');
        });
    });

    describe('rendering strategy', () => {
        it('sets prerender = false (SSR on-demand)', () => {
            expect(src).toContain('prerender = false');
        });
    });

    describe('API calls', () => {
        it('fetches the listing via venueApi.getBySlug', () => {
            expect(src).toContain('venueApi.getBySlug');
        });

        it('uses Promise.allSettled for parallel reviews + faqs fetch', () => {
            expect(src).toContain('Promise.allSettled');
            expect(src).toContain('venueApi.getReviews');
            expect(src).toContain('venueApi.getFaqs');
        });

        it('uses the renamed venue entity type for view tracking and bookmarks', () => {
            expect(src).toContain("entityType: 'VENUE'");
            expect(src).toContain('entityType="VENUE"');
        });
    });

    describe('transform', () => {
        it('transforms raw API response via toVenueDetailPageProps', () => {
            expect(src).toContain('toVenueDetailPageProps');
        });
    });

    describe('404 handling', () => {
        it('returns 404 when slug is missing', () => {
            expect(src).toContain('if (!slug)');
            expect(src).toContain('return new Response(null, { status: 404 })');
        });

        it('returns 404 when API call fails (result.ok is false)', () => {
            expect(src).toContain('if (!result.ok)');
        });

        it('propagates 410 (GONE) for soft-deleted entities, 404 otherwise (HOS-117 T-022)', () => {
            expect(src).toContain(
                'return new Response(null, { status: result.error.status === 410 ? 410 : 404 });'
            );
        });

        it('reads no old publication column: a non-PUBLISHED listing 404s through the public read (HOS-1641)', () => {
            // The public read answers only PUBLISHED (AC:V5:5); every other state
            // is the same 404 as an unknown slug, already returned by `!result.ok`.
            expect(src).not.toMatch(/raw\.(visibility|lifecycleState|moderationState)/);
            expect(src).toContain('if (!result.ok)');
        });
    });

    describe('detail blocks', () => {
        it('renders the shared ListingHeader (HOS-2579)', () => {
            expect(src).toContain('<ListingHeader {...headerProps} />');
            expect(src).not.toContain('VenueDetailHeader');
        });

        it('renders VenueDescription', () => {
            expect(src).toContain('VenueDescription');
        });

        it('renders OpeningHoursSection when openingHours is present', () => {
            expect(src).toContain('OpeningHoursSection');
            expect(src).toContain('venue.openingHours');
        });

        it('renders the shared ListingContactBlock for menu + social (HOS-2579)', () => {
            expect(src).toContain('buildVenueContactBlock({');
            expect(src).toContain(
                'Component: ListingContactBlock, props: { ...venueContactBlock }'
            );
        });

        it('reuses FaqAccordion from accommodation components', () => {
            expect(src).toContain('FaqAccordion');
        });

        it('renders ImageGallery for the photo gallery', () => {
            expect(src).toContain('ImageGallery');
        });

        it('TEST:4.5:5 mounts VenueNightInfo with the transformed nightInfo', () => {
            // Since HOS-1787 6.1 the section is a block in the catalog-order
            // registry, so the component is mounted dynamically; the assertion
            // follows the registry entry instead of the old literal tag.
            expect(src).toContain(
                "import VenueNightInfo from '@/components/venue/VenueNightInfo.astro';"
            );
            expect(src).toMatch(/Component:\s*VenueNightInfo/);
            expect(src).toMatch(/nightInfo:\s*venue\.nightInfo/);
        });
    });

    describe('richDescription', () => {
        it('passes richDescription to VenueDescription', () => {
            // Since 6.1 the prop lives in the catalog-order registry entry.
            expect(src).toMatch(/richDescription:\s*venue\.richDescription/);
        });
    });

    describe('description rendering', () => {
        it('uses renderPlain for the plain-text description', () => {
            expect(src).toContain('renderPlain');
        });
    });

    describe('layout', () => {
        it('uses DetailLayout', () => {
            expect(src).toContain('DetailLayout');
        });

        it('uses Breadcrumbs with the comer-y-salir link', () => {
            expect(src).toMatch(/<Breadcrumbs\s+slot="breadcrumbs"/);
            expect(src).toContain("breadcrumbLabel({ t, key: 'eatAndDrink' })");
            expect(src).not.toContain('BreadcrumbJsonLd');
            expect(src).not.toContain('venue-detail-breadcrumbs');
            expect(src).toContain('comer-y-salir/');
        });
    });

    describe('FAQs', () => {
        it('prefers inline entity FAQs over standalone endpoint', () => {
            expect(src).toContain('venue.faqs.length > 0');
        });
    });

    describe('view tracking (HOS-734)', () => {
        it('mounts EntityViewTracker with entityType VENUE, client:idle', () => {
            expect(src).toContain(
                "import { EntityViewTracker } from '@/components/analytics/EntityViewTracker.client';"
            );
            expect(src).toContain('<EntityViewTracker');
            expect(src).toContain('client:idle');
            expect(src).toContain('entityType="VENUE"');
            expect(src).toContain('entityId={venue.id}');
        });
    });
});

describe('HOS-1787 leaf 6.1 — catalog-ordered body and JSON-LD type', () => {
    it('orders the body by slot through venueDetailSectionsInSlot (HOS-2579 §6.2.3)', () => {
        expect(src).toContain('venueDetailSectionsInSlot({ slot })');
    });

    it('mounts VenueJsonLd with the venue type', () => {
        expect(src).toContain("import VenueJsonLd from '@/components/seo/VenueJsonLd.astro';");
        expect(src).toContain('<VenueJsonLd');
        expect(src).toContain('type={venue.type}');
    });

    it('keeps hasMenu derived from the public payload', () => {
        expect(src).toContain('buildRestaurantHasMenu({');
        expect(src).toContain('hasMenu={jsonLdHasMenu}');
    });

    it('does not write the retired place word in the page or the carta page', () => {
        expect(src).not.toMatch(/[Gg]astronom/);
        expect(cartaSrc).not.toMatch(/[Gg]astronom/);
    });

    it('does not read business lines', () => {
        expect(src).not.toContain('.businessLines');
    });
});

describe('HOS-2579 — venue slots and section tabs (AC-2b, AC-6)', () => {
    it('mounts ListingSectionTabs for the venue with no price and the page contact decision', () => {
        const mount = src.match(/<ListingSectionTabs[\s\S]*?\/>/)?.[0] ?? '';

        expect(mount).toContain('client:idle');
        expect(mount).toContain('vertical="venue"');
        expect(mount).toContain('price={null}');
        expect(mount).toContain('panelId={contactPanelId}');
        expect(mount).toContain("'accommodations.detail.listingContact.bar.viewMenu'");
        expect(mount).toContain("'accommodations.detail.listingContact.bar.contact'");
        expect(mount).toContain("primaryLink={contactMode.kind === 'menu'");
        expect(mount).toContain("hasContactAction={contactMode.kind !== 'none'}");
    });

    it('creates a tab only for a slot that renders', () => {
        expect(src).toContain('photos: galleryImages.length > 0');
        expect(src).toContain('details: hasDescriptionSection');
        expect(src).toContain('amenities: hasOffersSection');
        expect(src).toContain('hours: hasOpeningHours');
        expect(src).toContain('location: venueLocation !== null');
        expect(src).toContain(
            'const hasContactSection = venueContactBlock !== null || Boolean(venueWhatsApp);'
        );
        // No events tab: the agenda lives in «Lo que ofrece» (D-3).
        expect(src).not.toMatch(/venueEvents: (true|has)/);
    });

    it('paints «Lo que ofrece» (menu + agenda) in slot 4 and promotions alone in slot 6', () => {
        expect(src).toContain("const offersBlocks = blocksInSlot('offers');");
        expect(src).toContain("const promotionsBlocks = blocksInSlot('promotions');");
        expect(src).toMatch(
            /<ListingDetailSlot name="offers" anchorId=\{LISTING_SECTION_IDS\.amenities\}>\s*\{offersBlocks\.map/
        );
        expect(src).toMatch(/<ListingDetailSlot name="promotions">\s*\{promotionsBlocks\.map/);
    });

    it('passes the locale to VenueDescription for its «Leer más» toggle (AC-24)', () => {
        expect(src).toMatch(/richDescription: venue\.richDescription,\s*locale/);
    });
});

describe('HOS-2579 — a venue with no description and no offers mounts neither slot', () => {
    it('gates the description and «Lo que ofrece» wrappers on the same predicates as their tabs', () => {
        expect(src).toMatch(
            /\{hasDescriptionSection && \(\s*<ListingDetailSlot name="description"/
        );
        expect(src).toMatch(/\{hasOffersSection && \(\s*<ListingDetailSlot name="offers"/);
        // Never on the block lists, which are non-empty even when every block self-hides.
        expect(src).not.toContain('descriptionBlocks.length > 0 &&');
        expect(src).not.toContain('offersBlocks.length > 0 &&');
    });

    it('gates every other slot that can be empty', () => {
        expect(src).toMatch(/\{hasSummarySection && \(\s*<ListingDetailSlot name="summary">/);
        expect(src).toMatch(/\{hasContactSection && \(\s*<ListingDetailSlot name="contact">/);
        expect(src).toMatch(/\{hasPoliciesSection && \(\s*<ListingDetailSlot name="policies">/);
        expect(src).toContain('contact: hasContactSection');
    });
});
