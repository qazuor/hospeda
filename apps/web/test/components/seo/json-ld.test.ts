import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const seoDir = resolve(__dirname, '../../../src/components/seo');

function readComponent(name: string): string {
    return readFileSync(resolve(seoDir, name), 'utf8');
}

describe('SEO JSON-LD Components', () => {
    describe('JsonLd.astro', () => {
        const content = readComponent('JsonLd.astro');

        it('should accept a data prop of type Record<string, unknown>', () => {
            expect(content).toContain('readonly data: Record<string, unknown>');
        });

        it('should serialize data to JSON', () => {
            expect(content).toContain('JSON.stringify(data');
        });

        it('should render a script tag with type application/ld+json', () => {
            expect(content).toContain('type="application/ld+json"');
        });

        it('should use set:html for safe rendering', () => {
            expect(content).toContain('set:html={jsonLdContent}');
        });
    });

    describe('LodgingBusinessJsonLd.astro', () => {
        const content = readComponent('LodgingBusinessJsonLd.astro');

        it('should import JsonLd component', () => {
            expect(content).toContain("import JsonLd from './JsonLd.astro'");
        });

        it('should use LodgingBusiness schema type', () => {
            expect(content).toContain("'@type': 'LodgingBusiness'");
        });

        it('should have readonly props', () => {
            expect(content).toContain('readonly name: string');
            expect(content).toContain('readonly description: string');
            expect(content).toContain('readonly url: string');
        });

        it('should build PostalAddress for address', () => {
            expect(content).toContain("'@type': 'PostalAddress'");
        });

        it('should support optional starRating with Rating type', () => {
            expect(content).toContain("'@type': 'Rating'");
            expect(content).toContain('ratingValue: starRating');
        });

        it('should support optional amenities as LocationFeatureSpecification', () => {
            expect(content).toContain("'@type': 'LocationFeatureSpecification'");
        });

        it('should not import unused Props type from JsonLd', () => {
            expect(content).not.toContain('import type { Props as JsonLdProps }');
        });
    });

    describe('EventJsonLd.astro', () => {
        const content = readComponent('EventJsonLd.astro');

        it('should use Event schema type', () => {
            expect(content).toContain("'@type': 'Event'");
        });

        it('should have readonly props', () => {
            expect(content).toContain('readonly name: string');
            expect(content).toContain('readonly startDate: string');
        });

        it('should build Place location with PostalAddress', () => {
            expect(content).toContain("'@type': 'Place'");
        });

        it('should support optional organizer', () => {
            expect(content).toContain("'@type': 'Organization'");
        });
    });

    describe('ArticleJsonLd.astro', () => {
        const content = readComponent('ArticleJsonLd.astro');

        it('should use Article schema type', () => {
            expect(content).toContain("'@type': 'Article'");
        });

        it('should have readonly props', () => {
            expect(content).toContain('readonly headline: string');
            expect(content).toContain('readonly datePublished: string');
        });

        it('should include publisher as Hospeda', () => {
            expect(content).toContain("name: 'Hospeda'");
        });

        it('should build Person author', () => {
            expect(content).toContain("'@type': 'Person'");
        });
    });

    describe('PlaceJsonLd.astro', () => {
        const content = readComponent('PlaceJsonLd.astro');

        it('should use TouristDestination schema type', () => {
            expect(content).toContain("'@type': 'TouristDestination'");
        });

        it('should have readonly props', () => {
            expect(content).toContain('readonly name: string');
            expect(content).toContain('readonly description: string');
        });

        it('should support optional address with PostalAddress', () => {
            expect(content).toContain("'@type': 'PostalAddress'");
            expect(content).toContain('addressLocality');
        });
    });
});
