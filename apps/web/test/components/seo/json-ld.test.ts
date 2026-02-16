import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const jsonLdPath = resolve(__dirname, '../../../src/components/seo/JsonLd.astro');
const jsonLdContent = readFileSync(jsonLdPath, 'utf8');

const lodgingPath = resolve(__dirname, '../../../src/components/seo/LodgingBusinessJsonLd.astro');
const lodgingContent = readFileSync(lodgingPath, 'utf8');

const eventPath = resolve(__dirname, '../../../src/components/seo/EventJsonLd.astro');
const eventContent = readFileSync(eventPath, 'utf8');

const articlePath = resolve(__dirname, '../../../src/components/seo/ArticleJsonLd.astro');
const articleContent = readFileSync(articlePath, 'utf8');

describe('JsonLd.astro', () => {
    describe('Props', () => {
        it('should require data prop', () => {
            expect(jsonLdContent).toContain('data: Record<string, unknown>');
        });

        it('should export Props interface', () => {
            expect(jsonLdContent).toContain('export interface Props');
        });
    });

    describe('Rendering', () => {
        it('should render script tag with application/ld+json type', () => {
            expect(jsonLdContent).toContain('<script type="application/ld+json"');
        });

        it('should use set:html to inject JSON content', () => {
            expect(jsonLdContent).toContain('set:html={jsonLdContent}');
        });

        it('should stringify data to JSON', () => {
            expect(jsonLdContent).toContain('JSON.stringify(data');
        });
    });

    describe('JSDoc documentation', () => {
        it('should have component-level JSDoc', () => {
            expect(jsonLdContent).toContain('/**');
            expect(jsonLdContent).toContain('Generic JSON-LD wrapper component');
        });

        it('should have example in JSDoc', () => {
            expect(jsonLdContent).toContain('@example');
        });

        it('should document Props interface', () => {
            expect(jsonLdContent).toContain('Props interface for JsonLd component');
        });
    });
});

describe('LodgingBusinessJsonLd.astro', () => {
    describe('Props', () => {
        it('should require name prop', () => {
            expect(lodgingContent).toContain('name: string');
        });

        it('should require description prop', () => {
            expect(lodgingContent).toContain('description: string');
        });

        it('should require url prop', () => {
            expect(lodgingContent).toContain('url: string');
        });

        it('should require address prop', () => {
            expect(lodgingContent).toContain('address: Address');
        });

        it('should accept optional image prop', () => {
            expect(lodgingContent).toContain('image?: string');
        });

        it('should accept optional priceRange prop', () => {
            expect(lodgingContent).toContain('priceRange?: string');
        });

        it('should accept optional starRating prop', () => {
            expect(lodgingContent).toContain('starRating?: number');
        });

        it('should accept optional amenities prop', () => {
            expect(lodgingContent).toContain('amenities?: string[]');
        });

        it('should export Address interface', () => {
            expect(lodgingContent).toContain('export interface Address');
        });

        it('should export Props interface', () => {
            expect(lodgingContent).toContain('export interface Props');
        });
    });

    describe('Address interface', () => {
        it('should require streetAddress', () => {
            expect(lodgingContent).toContain('streetAddress: string');
        });

        it('should require addressLocality', () => {
            expect(lodgingContent).toContain('addressLocality: string');
        });

        it('should require addressRegion', () => {
            expect(lodgingContent).toContain('addressRegion: string');
        });

        it('should require addressCountry', () => {
            expect(lodgingContent).toContain('addressCountry: string');
        });

        it('should accept optional postalCode', () => {
            expect(lodgingContent).toContain('postalCode?: string');
        });
    });

    describe('Structured data', () => {
        it('should set @context to schema.org', () => {
            expect(lodgingContent).toContain("'@context': 'https://schema.org'");
        });

        it('should set @type to LodgingBusiness', () => {
            expect(lodgingContent).toContain("'@type': 'LodgingBusiness'");
        });

        it('should include name in structured data', () => {
            expect(lodgingContent).toContain('name,');
        });

        it('should include description in structured data', () => {
            expect(lodgingContent).toContain('description,');
        });

        it('should include url in structured data', () => {
            expect(lodgingContent).toContain('url,');
        });

        it('should include PostalAddress type for address', () => {
            expect(lodgingContent).toContain("'@type': 'PostalAddress'");
        });

        it('should conditionally include image when provided', () => {
            expect(lodgingContent).toContain('if (image)');
            expect(lodgingContent).toContain('structuredData.image = image');
        });

        it('should conditionally include priceRange when provided', () => {
            expect(lodgingContent).toContain('if (priceRange)');
            expect(lodgingContent).toContain('structuredData.priceRange = priceRange');
        });

        it('should conditionally include starRating when provided', () => {
            expect(lodgingContent).toContain('if (starRating !== undefined)');
            expect(lodgingContent).toContain('structuredData.starRating');
        });

        it('should include Rating type for starRating', () => {
            expect(lodgingContent).toContain("'@type': 'Rating'");
        });

        it('should conditionally include amenities when provided', () => {
            expect(lodgingContent).toContain('if (amenities && amenities.length > 0)');
            expect(lodgingContent).toContain('structuredData.amenityFeature');
        });

        it('should include LocationFeatureSpecification type for amenities', () => {
            expect(lodgingContent).toContain("'@type': 'LocationFeatureSpecification'");
        });

        it('should conditionally include postalCode in address', () => {
            expect(lodgingContent).toContain('address.postalCode');
            expect(lodgingContent).toContain('postalCode: address.postalCode');
        });
    });

    describe('Integration', () => {
        it('should import JsonLd component', () => {
            expect(lodgingContent).toContain("import JsonLd from './JsonLd.astro'");
        });

        it('should use JsonLd component', () => {
            expect(lodgingContent).toContain('<JsonLd data={structuredData} />');
        });
    });

    describe('JSDoc documentation', () => {
        it('should have component-level JSDoc', () => {
            expect(lodgingContent).toContain('/**');
            expect(lodgingContent).toContain('LodgingBusiness JSON-LD component');
        });

        it('should have example in JSDoc', () => {
            expect(lodgingContent).toContain('@example');
        });

        it('should document all interfaces', () => {
            expect(lodgingContent).toContain('Address interface');
            expect(lodgingContent).toContain('Props interface for LodgingBusinessJsonLd');
        });
    });
});

describe('EventJsonLd.astro', () => {
    describe('Props', () => {
        it('should require name prop', () => {
            expect(eventContent).toContain('name: string');
        });

        it('should require description prop', () => {
            expect(eventContent).toContain('description: string');
        });

        it('should require startDate prop', () => {
            expect(eventContent).toContain('startDate: string');
        });

        it('should require url prop', () => {
            expect(eventContent).toContain('url: string');
        });

        it('should require location prop', () => {
            expect(eventContent).toContain('location: EventLocation');
        });

        it('should accept optional endDate prop', () => {
            expect(eventContent).toContain('endDate?: string');
        });

        it('should accept optional image prop', () => {
            expect(eventContent).toContain('image?: string');
        });

        it('should accept optional organizer prop', () => {
            expect(eventContent).toContain('organizer?: string');
        });

        it('should export EventLocation interface', () => {
            expect(eventContent).toContain('export interface EventLocation');
        });

        it('should export Props interface', () => {
            expect(eventContent).toContain('export interface Props');
        });
    });

    describe('EventLocation interface', () => {
        it('should require name', () => {
            expect(eventContent).toContain('name: string');
        });

        it('should require address', () => {
            expect(eventContent).toContain('address: string');
        });
    });

    describe('Structured data', () => {
        it('should set @context to schema.org', () => {
            expect(eventContent).toContain("'@context': 'https://schema.org'");
        });

        it('should set @type to Event', () => {
            expect(eventContent).toContain("'@type': 'Event'");
        });

        it('should include name in structured data', () => {
            expect(eventContent).toContain('name,');
        });

        it('should include description in structured data', () => {
            expect(eventContent).toContain('description,');
        });

        it('should include startDate in structured data', () => {
            expect(eventContent).toContain('startDate,');
        });

        it('should include url in structured data', () => {
            expect(eventContent).toContain('url,');
        });

        it('should include Place type for location', () => {
            expect(eventContent).toContain("'@type': 'Place'");
        });

        it('should include PostalAddress type in location', () => {
            expect(eventContent).toContain("'@type': 'PostalAddress'");
        });

        it('should conditionally include endDate when provided', () => {
            expect(eventContent).toContain('if (endDate)');
            expect(eventContent).toContain('structuredData.endDate = endDate');
        });

        it('should conditionally include image when provided', () => {
            expect(eventContent).toContain('if (image)');
            expect(eventContent).toContain('structuredData.image = image');
        });

        it('should conditionally include organizer when provided', () => {
            expect(eventContent).toContain('if (organizer)');
            expect(eventContent).toContain('structuredData.organizer');
        });

        it('should include Organization type for organizer', () => {
            expect(eventContent).toContain("'@type': 'Organization'");
        });
    });

    describe('Integration', () => {
        it('should import JsonLd component', () => {
            expect(eventContent).toContain("import JsonLd from './JsonLd.astro'");
        });

        it('should use JsonLd component', () => {
            expect(eventContent).toContain('<JsonLd data={structuredData} />');
        });
    });

    describe('JSDoc documentation', () => {
        it('should have component-level JSDoc', () => {
            expect(eventContent).toContain('/**');
            expect(eventContent).toContain('Event JSON-LD component');
        });

        it('should have example in JSDoc', () => {
            expect(eventContent).toContain('@example');
        });

        it('should document all interfaces', () => {
            expect(eventContent).toContain('Event location interface');
            expect(eventContent).toContain('Props interface for EventJsonLd');
        });
    });
});

describe('ArticleJsonLd.astro', () => {
    describe('Props', () => {
        it('should require headline prop', () => {
            expect(articleContent).toContain('headline: string');
        });

        it('should require description prop', () => {
            expect(articleContent).toContain('description: string');
        });

        it('should require url prop', () => {
            expect(articleContent).toContain('url: string');
        });

        it('should require datePublished prop', () => {
            expect(articleContent).toContain('datePublished: string');
        });

        it('should require author prop', () => {
            expect(articleContent).toContain('author: ArticleAuthor');
        });

        it('should accept optional image prop', () => {
            expect(articleContent).toContain('image?: string');
        });

        it('should accept optional dateModified prop', () => {
            expect(articleContent).toContain('dateModified?: string');
        });

        it('should export ArticleAuthor interface', () => {
            expect(articleContent).toContain('export interface ArticleAuthor');
        });

        it('should export Props interface', () => {
            expect(articleContent).toContain('export interface Props');
        });
    });

    describe('ArticleAuthor interface', () => {
        it('should require name', () => {
            expect(articleContent).toContain('name: string');
        });

        it('should accept optional url', () => {
            expect(articleContent).toContain('url?: string');
        });
    });

    describe('Structured data', () => {
        it('should set @context to schema.org', () => {
            expect(articleContent).toContain("'@context': 'https://schema.org'");
        });

        it('should set @type to Article', () => {
            expect(articleContent).toContain("'@type': 'Article'");
        });

        it('should include headline in structured data', () => {
            expect(articleContent).toContain('headline,');
        });

        it('should include description in structured data', () => {
            expect(articleContent).toContain('description,');
        });

        it('should include url in structured data', () => {
            expect(articleContent).toContain('url,');
        });

        it('should include datePublished in structured data', () => {
            expect(articleContent).toContain('datePublished,');
        });

        it('should include Person type for author', () => {
            expect(articleContent).toContain("'@type': 'Person'");
        });

        it('should include publisher with Organization type', () => {
            expect(articleContent).toContain("'@type': 'Organization'");
            expect(articleContent).toContain('publisher');
        });

        it('should set publisher name to Hospeda', () => {
            expect(articleContent).toContain("name: 'Hospeda'");
        });

        it('should conditionally include image when provided', () => {
            expect(articleContent).toContain('if (image)');
            expect(articleContent).toContain('structuredData.image = image');
        });

        it('should conditionally include dateModified when provided', () => {
            expect(articleContent).toContain('if (dateModified)');
            expect(articleContent).toContain('structuredData.dateModified = dateModified');
        });

        it('should conditionally include author url when provided', () => {
            expect(articleContent).toContain('author.url');
            expect(articleContent).toContain('url: author.url');
        });
    });

    describe('Integration', () => {
        it('should import JsonLd component', () => {
            expect(articleContent).toContain("import JsonLd from './JsonLd.astro'");
        });

        it('should use JsonLd component', () => {
            expect(articleContent).toContain('<JsonLd data={structuredData} />');
        });
    });

    describe('JSDoc documentation', () => {
        it('should have component-level JSDoc', () => {
            expect(articleContent).toContain('/**');
            expect(articleContent).toContain('Article JSON-LD component');
        });

        it('should have example in JSDoc', () => {
            expect(articleContent).toContain('@example');
        });

        it('should document all interfaces', () => {
            expect(articleContent).toContain('Article author interface');
            expect(articleContent).toContain('Props interface for ArticleJsonLd');
        });
    });
});
