import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../../src/components/content/FeaturedSection.astro');
const content = readFileSync(componentPath, 'utf8');

describe('FeaturedSection.astro', () => {
    describe('Props', () => {
        it('should accept title prop as string', () => {
            expect(content).toContain('title: string');
        });

        it('should accept optional viewAllHref prop', () => {
            expect(content).toContain('viewAllHref?: string');
        });

        it('should accept optional viewAllLabel prop', () => {
            expect(content).toContain('viewAllLabel?: string');
        });

        it('should accept optional class prop', () => {
            expect(content).toContain('class?: string');
        });

        it('should resolve viewAllLabel via i18n fallback', () => {
            expect(content).toContain('resolvedViewAllLabel');
            expect(content).toContain("namespace: 'common'");
            expect(content).toContain("key: 'viewAll'");
        });
    });

    describe('Structure', () => {
        it('should render a section element', () => {
            expect(content).toContain('<section');
        });

        it('should have vertical padding classes', () => {
            expect(content).toContain('py-12');
            expect(content).toContain('sm:py-16');
            expect(content).toContain('lg:py-24');
        });

        it('should import Container from ui', () => {
            expect(content).toContain("import Container from '../ui/Container.astro'");
        });

        it('should use Container component', () => {
            expect(content).toContain('<Container>');
        });

        it('should render SectionTitle for title', () => {
            expect(content).toContain('<SectionTitle>');
            expect(content).toContain('{title}');
        });

        it('should have section header with flex layout', () => {
            expect(content).toContain('flex');
            expect(content).toContain('items-end');
            expect(content).toContain('justify-between');
        });

        it('should include a slot for content', () => {
            expect(content).toContain('<slot />');
        });
    });

    describe('View All Link', () => {
        it('should conditionally render view all link', () => {
            expect(content).toContain('{viewAllHref &&');
            expect(content).toContain('<a');
        });

        it('should use viewAllHref for link href', () => {
            expect(content).toContain('href={viewAllHref}');
        });

        it('should display resolved viewAllLabel text', () => {
            expect(content).toContain('{resolvedViewAllLabel}');
        });

        it('should have arrow indicator', () => {
            expect(content).toContain('&rarr;');
        });

        it('should have primary color classes', () => {
            expect(content).toContain('text-primary');
        });

        it('should have hover styles', () => {
            expect(content).toContain('hover:text-primary-dark');
        });
    });

    describe('Documentation', () => {
        it('should have JSDoc comment', () => {
            expect(content).toContain('/**');
            expect(content).toContain('Section wrapper for featured content');
        });
    });
});
