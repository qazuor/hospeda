/**
 * HOS-2410 web-ui §4 and §8 (AC-9, AC-11) — the article page view, rendered
 * over the REAL index: no token may survive into the HTML of any article.
 */

import { HELP_INDEX, HELP_SECTION_ANCHORS } from '@repo/help';
import { describe, expect, it } from 'vitest';
import { buildHelpArticleView } from '../../../src/lib/help/help-article-view';
import { findLocalizedHelpArticle } from '../../../src/lib/help/help-catalog';

const SITE = 'http://localhost:4321';

const viewOf = (id: string, locale: 'es' | 'en' = 'es') => {
    const found = findLocalizedHelpArticle({ id, locale });
    if (found === undefined) throw new Error(`no article ${id}`);
    return buildHelpArticleView({
        article: found.article,
        locale,
        contentLocale: found.contentLocale,
        neutralLimitText: 'el tope de tu plan',
        siteOrigin: SITE
    });
};

describe('buildHelpArticleView over the real index', () => {
    it.each(
        HELP_INDEX.locales.es.map((article) => article.id)
    )('leaves no {{token}} in the HTML of %s (web-ui §8)', (id) => {
        // Act
        const view = viewOf(id);
        const html = view.sections.map((section) => section.html).join('\n');

        // Assert
        expect(html).not.toContain('{{');
        expect(html).not.toContain('}}');
        expect(html).not.toMatch(/\{#[a-z0-9-]+\}/);
    });

    it('renders the five sections in the fixed order with their anchors (AC-9)', () => {
        // Act
        const view = viewOf('photos');

        // Assert
        expect(view.sections.map((section) => section.anchor)).toEqual(
            Object.values(HELP_SECTION_ANCHORS)
        );
        expect(view.sections.map((section) => section.heading)).toEqual([
            'Qué podés hacer',
            'Cómo se hace',
            'Qué esperar',
            'Qué NO esperar',
            'Problemas comunes'
        ]);
    });

    it('renders the steps as an ordered list', () => {
        const howTo = viewOf('photos').sections.find((section) => section.key === 'howTo');
        expect(howTo?.html).toMatch(/^<ol>/);
    });

    it('generates «Relacionados» from related[] and indexes six anchors (AC-9)', () => {
        // Arrange
        const article = HELP_INDEX.locales.es.find((a) => a.id === 'photos');

        // Act
        const view = viewOf('photos');

        // Assert
        expect(view.related.map((entry) => entry.id)).toEqual(article?.related);
        expect(view.relatedHeading).toBe('Relacionados');
        expect(view.toc).toHaveLength(6);
        expect(view.toc.at(-1)?.anchor).toBe('relacionados');
    });

    it('gives each ### heading its anchor id and hides an explicit {#id}', () => {
        // Arrange: addons has «### Dice «Compras pausadas» {#compras-pausadas}»
        const view = viewOf('addons');

        // Act
        const html = view.sections.map((section) => section.html).join('\n');

        // Assert
        expect(html).toContain('<h3 id="compras-pausadas">');
    });

    it('lists the destinations in the «Páginas» box with relative links (AC-9)', () => {
        // Arrange
        const article = HELP_INDEX.locales.es.find((a) => a.destinations.length > 0);

        // Act
        const view = viewOf(article?.id ?? '');

        // Assert
        expect(view.pages).toHaveLength(article?.destinations.length ?? -1);
        expect(view.pages.every((page) => page.href.startsWith('/es/'))).toBe(true);
    });

    it('links the FAQ category when the article has a faqKey', () => {
        const article = HELP_INDEX.locales.es.find((a) => a.faqKey !== undefined);
        const category = article?.faqKey?.split('.')[0];
        expect(viewOf(article?.id ?? '').faqHref).toBe(`/es/preguntas-frecuentes/#cat-${category}`);
    });

    it('keeps es headings when an en page falls back to es content (AC-11)', () => {
        const view = viewOf('photos', 'en');
        expect(view.sections[0]?.heading).toBe('Qué podés hacer');
        expect(view.related[0]?.href.startsWith('/en/mi-cuenta/ayuda/')).toBe(true);
    });

    it('asks for the limit island with the verticals its limit tokens name', () => {
        // Arrange: photos holds {{limit:max_photos_per_accommodation:accommodation}}
        const view = viewOf('photos');
        const html = view.sections.map((section) => section.html).join('\n');

        // Assert
        expect(view.limitVerticals).toEqual(['accommodation']);
        expect(html).toContain(
            '<span data-help-limit="max_photos_per_accommodation" data-vertical="accommodation">el tope de tu plan</span>'
        );
    });

    it('needs no limit island when the article has no limit token', () => {
        expect(viewOf('calendar').limitVerticals).toEqual([]);
    });
});
