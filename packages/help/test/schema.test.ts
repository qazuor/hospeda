/**
 * HOS-2410 (spec §5.2, AC-14, `docs/data-model.md` §2 and §4) — the Zod
 * schemas: the committed index passes, and a malformed one throws, which is
 * what stops the API from booting with a broken help catalog.
 *
 * @module test/schema
 */

import { describe, expect, it } from 'vitest';
import rawHelpIndex from '../generated/help-index.json' with { type: 'json' };
import {
    HelpArticleFrontmatterSchema,
    HelpIndexSchema,
    parseHelpIndex
} from '../src/article.schema';
import { HelpDestinationSchema } from '../src/destination.schema';

/** A deep copy of the committed index, to break. */
const copy = (): Record<string, unknown> => JSON.parse(JSON.stringify(rawHelpIndex));

describe('HelpIndexSchema (AC-14)', () => {
    it('accepts the committed index', () => {
        expect(HelpIndexSchema.safeParse(rawHelpIndex).success).toBe(true);
    });

    it.each([
        [
            'a wrong version',
            (index: Record<string, unknown>) => Object.assign(index, { version: 2 })
        ],
        [
            'a content hash that is not sha256',
            (index: Record<string, unknown>) => Object.assign(index, { contentHash: 'x' })
        ],
        [
            'an unknown top-level key',
            (index: Record<string, unknown>) => Object.assign(index, { extra: true })
        ],
        [
            'an article with no steps',
            (index: Record<string, unknown>) => {
                const articles = (
                    index.locales as { es: Array<{ sections: { howTo: { steps: string[] } } }> }
                ).es;
                const first = articles[0];
                if (first) first.sections.howTo.steps = [];
                return index;
            }
        ],
        [
            'a duplicated article id',
            (index: Record<string, unknown>) => {
                const locales = index.locales as { es: unknown[] };
                locales.es = [locales.es[0], locales.es[0]];
                return index;
            }
        ],
        ['no es locale', (index: Record<string, unknown>) => Object.assign(index, { locales: {} })]
    ])('throws at parse time with %s', (_label, breakIndex) => {
        // Arrange
        const broken = breakIndex(copy());

        // Act / Assert
        expect(() => parseHelpIndex({ raw: broken })).toThrow();
    });
});

describe('HelpArticleFrontmatterSchema', () => {
    const valid = {
        id: 'photos',
        title: 'Fotos',
        summary: 'Resumen.',
        audiences: ['host'],
        verticals: ['accommodation'],
        keywords: ['foto'],
        destinations: [],
        public: false,
        related: ['a', 'b'],
        covers: ['tool:get_help'],
        entryFor: [],
        reviewedAt: '2026-11-17'
    };

    it('accepts a complete frontmatter', () => {
        expect(HelpArticleFrontmatterSchema.safeParse(valid).success).toBe(true);
    });

    it.each([
        ['an id that is not kebab-case', { id: 'Subir Fotos' }],
        ['more than 8 related', { related: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'] }],
        ['no covers', { covers: [] }],
        ['a summary over 240 characters', { summary: 'x'.repeat(241) }],
        ['a public flag that is not boolean', { public: 'yes' }],
        ['duplicated audiences', { audiences: ['host', 'host'] }],
        ['the partner audience misspelt', { audiences: ['partners'] }],
        ['a faqKey that is not category.item', { faqKey: 'owners' }]
    ])('rejects %s', (_label, change) => {
        expect(HelpArticleFrontmatterSchema.safeParse({ ...valid, ...change }).success).toBe(false);
    });
});

describe('HelpDestinationSchema', () => {
    it.each([
        { kind: 'plans', vertical: 'venue', label: 'Planes' },
        { kind: 'ownEditorSection', vertical: 'venue', section: 'menu' },
        { kind: 'ownEditorSection', vertical: 'accommodation', section: 'policies' },
        { kind: 'ownEditorSection', vertical: 'experience', section: 'aiQuestions' },
        { kind: 'page', page: 'accountHome' },
        { kind: 'helpArticle', id: 'photos' },
        { kind: 'partnerPanel' }
    ])('accepts %j', (destination) => {
        expect(HelpDestinationSchema.safeParse(destination).success).toBe(true);
    });

    it.each([
        { kind: 'listingEditor', vertical: 'venue', id: 'x' },
        { kind: 'declareBenefitUsage', slug: 'x' },
        { kind: 'page', page: 'promotionEdit' },
        { kind: 'ownEditorSection', vertical: 'accommodation', section: 'menu' },
        { kind: 'ownEditorSection', vertical: 'venue', section: 'policies' },
        { kind: 'plans', vertical: 'tourist' },
        { kind: 'faq', url: 'https://example.test' }
    ])('rejects %j', (destination) => {
        expect(HelpDestinationSchema.safeParse(destination).success).toBe(false);
    });
});
