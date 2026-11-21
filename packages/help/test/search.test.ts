/**
 * HOS-2410 (spec §5.1, AC-6, AC-7, `docs/data-model.md` §7) — the shared search
 * over the real index. The scoring rules are covered by the API suite that
 * moved with it (`apps/api/test/mcp/tools/help/help-search.test.ts`); this file
 * covers what changed with the move: audiences are a list, and ties follow the
 * index order.
 *
 * @module test/search
 */

import { describe, expect, it } from 'vitest';
import { HELP_ARTICLES } from '../src/help-index';
import {
    findOwnerHelpTopic,
    type HelpSearchable,
    searchOwnerHelp,
    topicServesAudience
} from '../src/search';

const ids = (
    question: string,
    audience?: 'host' | 'venue' | 'experience' | 'provider' | 'partner'
) => searchOwnerHelp({ topics: HELP_ARTICLES, question, audience }).map((article) => article.id);

describe('searchOwnerHelp over the real index', () => {
    it('ranks photos first for "cómo subo fotos" (AC-6)', () => {
        expect(ids('cómo subo fotos')[0]).toBe('photos');
    });

    it('ignores accents and capitals (AC-7)', () => {
        expect(ids('FOTOGRAFÍAS de la GALERÍA')).toEqual(ids('fotografias de la galeria'));
        expect(ids('FOTOGRAFÍAS de la GALERÍA')).toContain('photos');
    });

    it('gives a provider only the articles whose audiences include provider', () => {
        // Act
        const found = searchOwnerHelp({
            topics: HELP_ARTICLES,
            question: 'subir fotos asistente qr',
            audience: 'provider'
        });

        // Assert
        expect(found.length).toBeGreaterThan(0);
        expect(found.every((article) => article.audiences.includes('provider'))).toBe(true);
        expect(found.map((article) => article.id)).not.toContain('photos');
    });

    it('answers a partner with the articles that list partner', () => {
        expect(ids('conectar un asistente de ia', 'partner')).toEqual(['ai-assistants']);
    });

    it('breaks score ties by the order of the catalog it is given', () => {
        // Arrange
        const article = (id: string): HelpSearchable => ({
            id,
            title: 'Otro',
            keywords: ['plan'],
            audiences: ['host']
        });

        // Act / Assert
        expect(
            searchOwnerHelp({ topics: [article('b'), article('a')], question: 'plan' }).map(
                (a) => a.id
            )
        ).toEqual(['b', 'a']);
    });
});

describe('topicServesAudience', () => {
    it('serves every audience when none is given, and only the listed ones otherwise', () => {
        // Arrange
        const topic: HelpSearchable = {
            id: 'x',
            title: 'X',
            keywords: ['x'],
            audiences: ['venue', 'host']
        };

        // Assert
        expect(topicServesAudience({ topic })).toBe(true);
        expect(topicServesAudience({ topic, audience: 'host' })).toBe(true);
        expect(topicServesAudience({ topic, audience: 'provider' })).toBe(false);
    });
});

describe('findOwnerHelpTopic', () => {
    it('finds by exact id only', () => {
        expect(findOwnerHelpTopic({ topics: HELP_ARTICLES, id: 'calendar' })?.title).toBe(
            'Bloquear fechas y conectar un calendario externo'
        );
        expect(findOwnerHelpTopic({ topics: HELP_ARTICLES, id: 'cal.*' })).toBeUndefined();
    });
});

describe('searchOwnerHelp limit (HOS-2410 web-ui §3)', () => {
    const many: readonly HelpSearchable[] = Array.from({ length: 12 }, (_, index) => ({
        id: `topic-${index}`,
        title: `Tema ${index}`,
        keywords: ['fotos'],
        audiences: ['host']
    }));

    it('returns at most three topics by default, what get_help answers with', () => {
        expect(searchOwnerHelp({ topics: many, question: 'fotos' })).toHaveLength(3);
    });

    it('returns up to the given limit when one is passed', () => {
        expect(searchOwnerHelp({ topics: many, question: 'fotos', limit: 10 })).toHaveLength(10);
    });
});
