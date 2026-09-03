/**
 * @file experiencias-detail.test.ts
 * @description Source-read tests for the experience detail page (SPEC-240 T-030).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/experiencias/[slug].astro'),
    'utf8'
);

describe('experiencias/[slug].astro', () => {
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
        it('fetches the listing via experiencesApi.getBySlug', () => {
            expect(src).toContain('experiencesApi.getBySlug');
        });

        it('uses Promise.allSettled for parallel reviews + faqs fetch', () => {
            expect(src).toContain('Promise.allSettled');
            expect(src).toContain('experiencesApi.getReviews');
            expect(src).toContain('experiencesApi.getFaqs');
        });
    });

    describe('transform', () => {
        it('transforms raw API response via toExperienceDetailPageProps', () => {
            expect(src).toContain('toExperienceDetailPageProps');
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

        it('returns 404 for non-PUBLIC visibility values', () => {
            expect(src).toContain("visibility !== 'PUBLIC'");
        });
    });

    describe('detail blocks', () => {
        it('renders ExperienceHero with hero, type, pricing, rating', () => {
            expect(src).toContain('ExperienceHero');
        });

        it('renders ExperienceInfo with description, hours, social', () => {
            expect(src).toContain('ExperienceInfo');
        });

        it('renders ExperienceContactBlock with the provider channels', () => {
            expect(src).toContain('ExperienceContactBlock');
        });

        it('no longer renders the dormant WhatsApp CTA (HOS-363)', () => {
            // It read `contactInfo.whatsapp`, which the public payload never
            // carries, so it never rendered. What remains is
            // `ExperienceContactBlock`, and HOS-924 made one of the channels it
            // shows a publish requirement.
            expect(src).not.toContain('ExperienceContactCTA');
        });

        it('renders ExperienceReviews as an interactive island', () => {
            expect(src).toContain('ExperienceReviews');
            expect(src).toContain('client:visible');
        });

        it('renders ExperienceFaqs as a static SSR accordion', () => {
            expect(src).toContain('ExperienceFaqs');
        });

        it('renders ImageGallery for the photo gallery', () => {
            expect(src).toContain('ImageGallery');
        });

        // HOS-1048. A SOURCE read, so it proves only that the page IMPORTS the
        // component and hands it the right prop — it cannot tell a rendered
        // block from a declared one (Vitest does not render `.astro` here).
        // Whether anything appears is decided by the VALUE of that prop, and
        // that is covered where it executes: the null-collapsing in
        // `test/lib/api/transform-experience-meeting-point.test.ts`, and whether
        // the field survives the projection at all in the full public-tier parse
        // under `packages/schemas`.
        it('wires ExperienceMeetingPoint to the transformed meeting point', () => {
            expect(src).toContain('ExperienceMeetingPoint');
            expect(src).toContain('meetingPoint={experience.meetingPoint}');
        });

        // HOS-898 / HOS-1046 / HOS-1047 / HOS-1056. SOURCE reads, with the same
        // limit as the meeting-point one above: they prove the page IMPORTS each
        // component and hands it the right prop, never that a block appears.
        // What appears is decided by the VALUE of the prop, covered in
        // `test/lib/api/transform-experience-practical-info.test.ts`, and by
        // whether the field survives the tier projection at all, covered by the
        // full public parse under `packages/schemas`.
        it('wires the two HOS-1046 checklists to the transformed lists', () => {
            expect(src).toContain('ExperiencePreparation');
            expect(src).toContain('whatToBring={experience.whatToBring}');
            expect(src).toContain('requirements={experience.requirements}');
        });

        it('wires the cancellation policy (HOS-1047)', () => {
            expect(src).toContain('ExperienceCancellationPolicy');
            expect(src).toContain('cancellationPolicy={experience.cancellationPolicy}');
        });

        it('wires the private-groups block with the contact-block guard (HOS-1056)', () => {
            // `hasContactBlock` is the load-bearing prop: the CTA anchors into
            // `ExperienceContactBlock`, which self-hides when the listing
            // publishes no usable channel. Passing the flag is what lets the CTA
            // degrade to plain text instead of linking to an element that is not
            // on the page — the HOS-363 failure mode, silent by construction.
            expect(src).toContain('ExperiencePrivateGroups');
            expect(src).toContain('acceptsPrivateGroups={experience.acceptsPrivateGroups}');
            expect(src).toContain('hasContactBlock={hasContactBlock}');
            expect(src).toContain('hasPublicContactChannel');
        });

        it('never gates the practical fields on an entitlement', () => {
            // Owner decision (2026-09-01): all four ship from the basic tier.
            // The HOS-974 audit found three entitlements granted and demanded by
            // no route; a key per ficha field manufactures exactly that. This
            // page carries no entitlement machinery at all, and must not start.
            expect(src).not.toContain('EntitlementKey');
            expect(src).not.toContain('loadEntitlements');
        });

        it('draws no map on this page — the map is the paid half (HOS-1049)', () => {
            // The meeting point ships from the basic tier; the map that draws
            // its coordinates does not. A map here would hand every visitor the
            // feature HOS-1049 exists to gate, and this page has no entitlement
            // check to stop it.
            expect(src).not.toContain('LocationMap');
            expect(src).not.toContain('meetingPointLat');
        });
    });

    describe('gallery images', () => {
        it('extracts gallery from media.gallery on the raw API response', () => {
            expect(src).toContain('media');
            expect(src).toContain('gallery');
        });
    });

    describe('reviews island props', () => {
        it('passes experienceId to ExperienceReviews', () => {
            expect(src).toContain('experienceId={experience.id}');
        });

        it('passes initialReviews to ExperienceReviews', () => {
            expect(src).toContain('initialReviews={reviews}');
        });

        it('passes nothing about the visitor to ExperienceReviews (HOS-369 WB0-5)', () => {
            // The island resolves the session client-side (WB0-4). Computing it
            // here would make this page per-visitor, and therefore uncacheable.
            expect(src).not.toContain('isAuthenticated={isAuthenticated}');
            expect(src).not.toContain('Astro.locals.user');
        });
    });

    describe('FAQs', () => {
        it('prefers inline entity FAQs over standalone endpoint', () => {
            expect(src).toContain('experience.faqs.length > 0');
        });
    });

    describe('layout', () => {
        it('uses DetailLayout', () => {
            expect(src).toContain('DetailLayout');
        });

        it('uses Breadcrumbs with experiencias link', () => {
            expect(src).toContain('Breadcrumbs');
            expect(src).toContain('experiencias/');
        });
    });

    describe('SEO', () => {
        it('builds canonical path with experiencias segment', () => {
            expect(src).toContain('buildUrl');
            expect(src).toContain('experiencias/');
        });

        it('falls back to experience.summary for SEO description', () => {
            expect(src).toContain('experience.summary');
        });
    });
});
