/**
 * HOS-2410 web-ui §6 (AC-21, AC-22) — the «?» lookup.
 */

import { HELP_INDEX } from '@repo/help';
import { describe, expect, it } from 'vitest';
import {
    findHelpEntry,
    HELP_ENTRY_ARTICLE_IDS,
    helpLinkOpensNewTab,
    pageHelpAnchor,
    sectionHelpAnchor
} from '../../../src/lib/help/help-entry';

describe('pageHelpAnchor', () => {
    it('turns a /mi-cuenta route pattern into a page anchor', () => {
        expect(pageHelpAnchor({ routePattern: '/[lang]/mi-cuenta' })).toBe('page:mi-cuenta');
        expect(pageHelpAnchor({ routePattern: '/[lang]/mi-cuenta/propiedades/[id]/editar' })).toBe(
            'page:mi-cuenta/propiedades/[id]/editar'
        );
    });

    it('gives no anchor outside /mi-cuenta, so no «?» renders there (AC-21)', () => {
        expect(pageHelpAnchor({ routePattern: '/[lang]/publicar' })).toBeUndefined();
        expect(pageHelpAnchor({ routePattern: '/[lang]/mi-cuentas' })).toBeUndefined();
        expect(pageHelpAnchor({ routePattern: '/' })).toBeUndefined();
    });
});

describe('findHelpEntry', () => {
    it('finds the article whose entryFor claims a section (AC-21)', () => {
        // Arrange
        const anchor = sectionHelpAnchor({ vertical: 'accommodation', slug: 'fotos' });
        const owner = HELP_INDEX.locales.es.find((article) => article.entryFor.includes(anchor));

        // Act
        const entry = findHelpEntry({ anchor, locale: 'es' });

        // Assert
        expect(owner).toBeDefined();
        expect(entry).toEqual({ id: owner?.id, title: owner?.title });
    });

    it('finds nothing for an anchor no article claims, so nothing renders (AC-22)', () => {
        expect(findHelpEntry({ anchor: 'page:mi-cuenta/favoritos', locale: 'es' })).toBeUndefined();
        expect(findHelpEntry({ anchor: undefined, locale: 'es' })).toBeUndefined();
    });

    it('maps every entryFor of the index to its article', () => {
        const claimed = HELP_INDEX.locales.es.flatMap((article) => article.entryFor);
        expect(HELP_ENTRY_ARTICLE_IDS.size).toBe(claimed.length);
    });
});

describe('helpLinkOpensNewTab (HOS-2552)', () => {
    it('stays in the same tab on the help landing and on an article', () => {
        expect(helpLinkOpensNewTab({ anchor: 'page:mi-cuenta/ayuda' })).toBe(false);
        expect(helpLinkOpensNewTab({ anchor: 'page:mi-cuenta/ayuda/[id]' })).toBe(false);
    });

    it('opens a new tab from every other page and editor section (AC-21 of HOS-2410)', () => {
        expect(helpLinkOpensNewTab({ anchor: 'page:mi-cuenta/suscripcion' })).toBe(true);
        expect(helpLinkOpensNewTab({ anchor: 'page:mi-cuenta/ayudante' })).toBe(true);
        expect(helpLinkOpensNewTab({ anchor: 'section:accommodation.fotos' })).toBe(true);
    });
});
