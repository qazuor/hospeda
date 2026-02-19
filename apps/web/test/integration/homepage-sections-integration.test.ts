/**
 * Integration tests for the complete homepage section assembly (SPEC-013).
 * Validates section rendering order, cross-component ARIA patterns,
 * SectionWrapper variant consistency, and accessibility requirements.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const homepagePath = resolve(__dirname, '../../src/pages/[lang]/index.astro');
const homepage = readFileSync(homepagePath, 'utf8');

const statisticsPath = resolve(__dirname, '../../src/components/content/StatisticsSection.astro');
const statistics = readFileSync(statisticsPath, 'utf8');

const categoryIconsPath = resolve(
    __dirname,
    '../../src/components/content/CategoryIconsSection.astro'
);
const categoryIcons = readFileSync(categoryIconsPath, 'utf8');

const testimonialsPath = resolve(
    __dirname,
    '../../src/components/content/TestimonialsSection.astro'
);
const testimonials = readFileSync(testimonialsPath, 'utf8');

const carouselPath = resolve(
    __dirname,
    '../../src/components/content/TestimonialCarousel.client.tsx'
);
const carousel = readFileSync(carouselPath, 'utf8');

const newsletterPath = resolve(__dirname, '../../src/components/content/NewsletterSection.astro');
const newsletter = readFileSync(newsletterPath, 'utf8');

const ownerCtaPath = resolve(__dirname, '../../src/components/content/OwnerCTASection.astro');
const ownerCta = readFileSync(ownerCtaPath, 'utf8');

const sectionWrapperPath = resolve(__dirname, '../../src/components/ui/SectionWrapper.astro');
const sectionWrapper = readFileSync(sectionWrapperPath, 'utf8');

describe('Homepage Sections Integration (SPEC-013)', () => {
    describe('Complete section order (positions 1-10)', () => {
        it('should render all 10 sections in correct order', () => {
            const sectionOrder = [
                '<HeroSection',
                '<FeaturedAccommodations',
                '<FeaturedDestinations',
                '<StatisticsSection',
                '<FeaturedEvents',
                '<CategoryIconsSection',
                '<FeaturedPosts',
                '<TestimonialsSection',
                '<NewsletterSection',
                '<OwnerCTASection'
            ];

            const positions = sectionOrder.map((tag) => homepage.indexOf(tag));

            // All sections must exist
            for (let i = 0; i < positions.length; i++) {
                expect(positions[i], `Section ${sectionOrder[i]} not found`).toBeGreaterThan(-1);
            }

            // Each section must come after the previous one
            for (let i = 1; i < positions.length; i++) {
                expect(
                    positions[i],
                    `${sectionOrder[i]} should come after ${sectionOrder[i - 1]}`
                ).toBeGreaterThan(positions[i - 1]!);
            }
        });

        it('should not have duplicate section renders', () => {
            const sections = [
                'StatisticsSection',
                'CategoryIconsSection',
                'TestimonialsSection',
                'NewsletterSection',
                'OwnerCTASection'
            ];

            for (const section of sections) {
                const regex = new RegExp(`<${section}`, 'g');
                const matches = homepage.match(regex) ?? [];
                expect(matches.length, `${section} should appear exactly once`).toBe(1);
            }
        });
    });

    describe('SectionWrapper variant consistency', () => {
        it('StatisticsSection should use image variant for overlay background', () => {
            expect(statistics).toContain('variant="image"');
        });

        it('CategoryIconsSection should use warm variant for beige background', () => {
            expect(categoryIcons).toContain('variant="warm"');
        });

        it('TestimonialsSection should use warm variant for beige background', () => {
            expect(testimonials).toContain('variant="warm"');
        });

        it('NewsletterSection should use image variant for overlay background', () => {
            expect(newsletter).toContain('variant="image"');
        });

        it('OwnerCTASection should use image variant for overlay background', () => {
            expect(ownerCta).toContain('variant="image"');
        });

        it('SectionWrapper should support all used variants', () => {
            expect(sectionWrapper).toContain('white');
            expect(sectionWrapper).toContain('gray');
            expect(sectionWrapper).toContain('warm');
            expect(sectionWrapper).toContain('image');
        });
    });

    describe('Background alternation pattern', () => {
        it('should alternate between white, warm, and image backgrounds', () => {
            // Hero (image) -> Accommodations (white) -> Destinations (warm) ->
            // Statistics (image) -> Events (white) -> CategoryIcons (warm) ->
            // Posts (gray) -> Testimonials (warm) -> Newsletter (image) -> OwnerCTA (image)
            // No two consecutive sections should feel visually identical
            expect(statistics).toContain('variant="image"');
            expect(categoryIcons).toContain('variant="warm"');
            expect(testimonials).toContain('variant="warm"');
            expect(newsletter).toContain('variant="image"');
            expect(ownerCta).toContain('variant="image"');
        });

        it('Destinations FeaturedSection should have warm background class on homepage', () => {
            const destSection = homepage.match(
                /<FeaturedSection[^>]*title=\{t\.featuredDestinations\}[^>]*/
            );
            expect(destSection).not.toBeNull();
            expect(destSection![0]).toContain('bg-bg-warm');
        });

        it('Posts FeaturedSection should have gray background class on homepage', () => {
            const postsSection = homepage.match(
                /<FeaturedSection[^>]*title=\{t\.latestBlog\}[^>]*/
            );
            expect(postsSection).not.toBeNull();
            expect(postsSection![0]).toContain('bg-surface-alt');
        });
    });

    describe('Cross-component locale propagation', () => {
        it('homepage should pass locale to all sections that need it', () => {
            const sectionLocalePatterns = [
                /<StatisticsSection[^>]*locale/,
                /<CategoryIconsSection[^>]*locale/,
                /<TestimonialsSection[^>]*locale/,
                /<NewsletterSection[^>]*locale/,
                /<OwnerCTASection[^>]*locale/
            ];

            for (const pattern of sectionLocalePatterns) {
                expect(homepage).toMatch(pattern);
            }
        });

        it('sections with locale-dependent content should accept locale prop', () => {
            expect(statistics).toContain('locale');
            expect(categoryIcons).toContain('locale');
            expect(testimonials).toContain('locale');
            expect(newsletter).toContain('locale');
            expect(ownerCta).toContain('locale');
        });
    });

    describe('Testimonials data flow', () => {
        it('homepage should define TESTIMONIALS array with test data', () => {
            expect(homepage).toContain('TESTIMONIALS');
        });

        it('homepage should pass testimonials to TestimonialsSection', () => {
            expect(homepage).toContain('testimonials={TESTIMONIALS}');
        });

        it('TestimonialsSection should pass testimonials to carousel', () => {
            expect(testimonials).toContain('testimonials={testimonials}');
        });

        it('TestimonialCarousel should guard against empty array', () => {
            expect(carousel).toContain('return null');
            expect(carousel).toContain('testimonials.length === 0');
        });

        it('TestimonialsSection should guard rendering with length check', () => {
            expect(testimonials).toContain('testimonials.length > 0');
        });
    });

    describe('React island hydration directives', () => {
        it('TestimonialCarousel should use client:visible', () => {
            expect(testimonials).toContain('client:visible');
        });

        it('CounterAnimation should use client:visible in StatisticsSection', () => {
            expect(statistics).toContain('client:visible');
        });

        it('NewsletterCTA should use client:visible in NewsletterSection', () => {
            expect(newsletter).toContain('client:visible');
        });

        it('no new section should use client:load (reserved for above-fold)', () => {
            expect(statistics).not.toContain('client:load');
            expect(categoryIcons).not.toContain('client:load');
            expect(testimonials).not.toContain('client:load');
            expect(newsletter).not.toContain('client:load');
            expect(ownerCta).not.toContain('client:load');
        });
    });

    describe('Accessibility across sections', () => {
        it('TestimonialCarousel should have region role with aria-label', () => {
            expect(carousel).toContain('role="region"');
            expect(carousel).toContain('aria-label');
        });

        it('TestimonialCarousel should suppress aria-live for auto-advancing', () => {
            expect(carousel).toContain('aria-live="off"');
        });

        it('CategoryIconsSection links should have aria-labels', () => {
            expect(categoryIcons).toContain('aria-label');
        });

        it('CategoryIconsSection icons should be decorative (aria-hidden)', () => {
            expect(categoryIcons).toContain('aria-hidden');
        });

        it('CounterAnimation should announce completion to screen readers', () => {
            const counterPath = resolve(
                __dirname,
                '../../src/components/content/CounterAnimation.client.tsx'
            );
            const counter = readFileSync(counterPath, 'utf8');
            expect(counter).toContain('aria-live="polite"');
            expect(counter).toContain('sr-only');
        });

        it('OwnerCTA button should link to propietarios page', () => {
            expect(ownerCta).toContain('/propietarios/');
        });
    });

    describe('Image overlay fallbacks', () => {
        it('StatisticsSection should have dark background fallback', () => {
            expect(statistics).toContain('bg-gray-800');
        });

        it('NewsletterSection should have dark background fallback', () => {
            expect(newsletter).toContain('bg-gray-800');
        });

        it('OwnerCTASection should have dark background fallback', () => {
            expect(ownerCta).toContain('bg-gray-800');
        });
    });

    describe('No default exports in React islands', () => {
        it('TestimonialCarousel should use named export', () => {
            expect(carousel).toContain('export const TestimonialCarousel');
            expect(carousel).not.toContain('export default');
        });

        it('CounterAnimation should use named export', () => {
            const counterPath = resolve(
                __dirname,
                '../../src/components/content/CounterAnimation.client.tsx'
            );
            const counter = readFileSync(counterPath, 'utf8');
            expect(counter).toContain('export const CounterAnimation');
            expect(counter).not.toContain('export default');
        });
    });
});
