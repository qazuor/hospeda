/**
 * HOS-2410 web-ui §4 and §8 (AC-9, AC-11) — the article page view, rendered
 * over the REAL index: no token may survive into the HTML of any article.
 */

import { HELP_INDEX, HELP_SECTION_ANCHORS } from '@repo/help';
import { describe, expect, it } from 'vitest';
import {
    buildHelpArticleView,
    dedupeHelpPageLinks,
    mergeHelpPageLabels
} from '../../../src/lib/help/help-article-view';
import { findLocalizedHelpArticle } from '../../../src/lib/help/help-catalog';

const SITE = 'http://localhost:4321';

/** Mirrors `account.help.article.editorSectionLabel.*` in es. */
const VERTICAL_NOUNS = {
    accommodation: 'alojamiento',
    venue: 'comercio',
    experience: 'experiencia'
} as const;

const viewOf = (
    id: string,
    locale: 'es' | 'en' = 'es',
    readerAudience?: 'host' | 'venue' | 'experience' | 'provider' | 'partner'
) => {
    const found = findLocalizedHelpArticle({ id, locale });
    if (found === undefined) throw new Error(`no article ${id}`);
    return buildHelpArticleView({
        article: found.article,
        locale,
        contentLocale: found.contentLocale,
        neutralLimitText: 'el tope de tu plan',
        editorSectionLabel: ({ label, vertical }) => `${label} de tu ${VERTICAL_NOUNS[vertical]}`,
        siteOrigin: SITE,
        readerAudience
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
        expect(view.pages.length).toBeGreaterThan(0);
        expect(view.pages.length).toBeLessThanOrEqual(article?.destinations.length ?? -1);
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

describe('«Páginas» box (HOS-2552)', () => {
    it('names the vertical of each photos link and never repeats a destination', () => {
        // Act
        const view = viewOf('photos');

        // Assert
        expect(view.pages).toEqual([
            { href: '/es/mi-cuenta/propiedades/', label: 'Fotos de tu alojamiento' },
            { href: '/es/mi-cuenta/comercio/', label: 'Fotos de tu comercio o experiencia' }
        ]);
    });

    it.each(
        HELP_INDEX.locales.es.map((article) => article.id)
    )('%s repeats no href and no label in its «Páginas» box', (id) => {
        // Act
        const { pages } = viewOf(id);

        // Assert
        expect(new Set(pages.map((page) => page.href)).size).toBe(pages.length);
        expect(new Set(pages.map((page) => page.label)).size).toBe(pages.length);
    });

    it('a degraded editor section never renames the list page it shares (publish-requirements)', () => {
        // «Ubicación» of an accommodation opens «Mis propiedades» on the web.
        const labels = viewOf('publish-requirements').pages.map((page) => page.label);
        expect(labels).toContain('Mis alojamientos');
        expect(labels).toContain('Mi comercio');
        expect(labels.some((label) => label.startsWith('Ubicación'))).toBe(false);
    });

    it('lets the label of a link that really goes there win over a degraded editor section', () => {
        expect(
            dedupeHelpPageLinks({
                links: [
                    { href: '/es/mi-cuenta/propiedades/', label: 'Mis propiedades', exact: true },
                    {
                        href: '/es/mi-cuenta/propiedades/',
                        label: 'Ubicación de tu alojamiento',
                        exact: false
                    }
                ],
                locale: 'es'
            })
        ).toEqual([{ href: '/es/mi-cuenta/propiedades/', label: 'Mis propiedades' }]);
    });

    it('merges labels by their shared words, or joins them as alternatives', () => {
        expect(
            mergeHelpPageLabels({
                labels: ['Fotos de tu comercio', 'Fotos de tu experiencia'],
                locale: 'es'
            })
        ).toBe('Fotos de tu comercio o experiencia');
        expect(mergeHelpPageLabels({ labels: ['Mi comercio', 'Mi comercio'], locale: 'es' })).toBe(
            'Mi comercio'
        );
        expect(mergeHelpPageLabels({ labels: ['Carta', 'Menú'], locale: 'en' })).toBe(
            'Carta or Menú'
        );
    });
});

describe('{{limit}} sentences (HOS-2552)', () => {
    /** Every limit span, with the text right before and after it. */
    const limitSpans = HELP_INDEX.locales.es.flatMap((article) =>
        viewOf(article.id)
            .sections.flatMap((section) => [
                ...section.html.matchAll(/(.{0,40})<span data-help-limit[^>]*>[^<]*<\/span>(.?)/g)
            ])
            .map((match) => [article.id, match[1] ?? '', match[2] ?? ''] as const)
    );

    it('the catalog has at least one limit sentence to check', () => {
        expect(limitSpans.length).toBeGreaterThan(0);
    });

    it.each(
        limitSpans
    )('%s puts each limit as the value after a colon, so the neutral text, a number and «sin tope» all read right', (_id, before, after) => {
        // The island replaces the whole span text: «…: el tope de tu plan.»,
        // «…: 15.» and «…: sin tope.» must all be sentences.
        expect(before).toMatch(/: $/);
        expect(after).toMatch(/^[.;,]?$/);
    });
});

describe("in-body article links keep the reader's tab (HOS-2552)", () => {
    const bodyHrefs = (html: string): string[] =>
        [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1] ?? '');

    it('adds ?para= to a link whose target is written for that audience', () => {
        // Act
        const html = viewOf('photos', 'es', 'host')
            .sections.map((section) => section.html)
            .join('\n');

        // Assert
        expect(bodyHrefs(html)).toContain('/es/mi-cuenta/ayuda/publish-requirements/?para=host');
        expect(bodyHrefs(html)).toContain(
            '/es/mi-cuenta/ayuda/create-listing/?para=host#como-se-hace'
        );
    });

    it('adds nothing without a validated audience', () => {
        const html = viewOf('photos')
            .sections.map((section) => section.html)
            .join('\n');
        expect(html).not.toContain('para=');
    });
});
