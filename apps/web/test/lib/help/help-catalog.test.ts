/**
 * HOS-2410 web-ui §1–§4 (AC-1, AC-10, AC-11) — what the help pages read of
 * the real help index.
 */

import { HELP_INDEX } from '@repo/help';
import { describe, expect, it } from 'vitest';
import {
    DEFAULT_HELP_AUDIENCE,
    findLocalizedHelpArticle,
    helpArticlesForAudience,
    listLocalizedHelpArticles,
    parseHelpAudience,
    toHelpSearchEntries
} from '../../../src/lib/help/help-catalog';

describe('findLocalizedHelpArticle', () => {
    it('returns the es article on an es page, not marked as a fallback', () => {
        // Act
        const found = findLocalizedHelpArticle({ id: 'photos', locale: 'es' });

        // Assert
        expect(found?.article.id).toBe('photos');
        expect(found?.contentLocale).toBe('es');
        expect(found?.isFallback).toBe(false);
    });

    it('falls back to es on an en page with no en file (AC-11)', () => {
        // Arrange: v1 ships es content only
        expect(HELP_INDEX.locales.en).toBeUndefined();

        // Act
        const found = findLocalizedHelpArticle({ id: 'photos', locale: 'en' });

        // Assert
        expect(found?.contentLocale).toBe('es');
        expect(found?.isFallback).toBe(true);
    });

    it('answers undefined for an unknown id (AC-10)', () => {
        expect(findLocalizedHelpArticle({ id: 'no-such-article', locale: 'es' })).toBeUndefined();
    });
});

describe('helpArticlesForAudience', () => {
    it('lists only the articles of the audience, sorted by title with es collation (AC-1)', () => {
        // Arrange
        const articles = listLocalizedHelpArticles({ locale: 'es' });

        // Act
        const venue = helpArticlesForAudience({ articles, audience: 'venue', locale: 'es' });

        // Assert
        expect(venue.length).toBeGreaterThan(0);
        expect(venue.every(({ article }) => article.audiences.includes('venue'))).toBe(true);
        const titles = venue.map(({ article }) => article.title);
        expect(titles).toEqual([...titles].sort(new Intl.Collator('es').compare));
        expect(venue).toHaveLength(
            HELP_INDEX.locales.es.filter((article) => article.audiences.includes('venue')).length
        );
    });

    it('lists nothing for an audience with no article yet (partner before Phase 5)', () => {
        // Arrange
        const articles = listLocalizedHelpArticles({ locale: 'es' });
        const expected = HELP_INDEX.locales.es.filter((a) => a.audiences.includes('partner'));

        // Act
        const partner = helpArticlesForAudience({ articles, audience: 'partner', locale: 'es' });

        // Assert
        expect(partner).toHaveLength(expected.length);
    });
});

describe('toHelpSearchEntries', () => {
    it('projects only id, title, summary, keywords and audiences (web-ui §3)', () => {
        // Act
        const [entry] = toHelpSearchEntries({
            articles: listLocalizedHelpArticles({ locale: 'es' })
        });

        // Assert
        expect(Object.keys(entry ?? {}).sort()).toEqual(
            ['audiences', 'id', 'keywords', 'summary', 'title'].sort()
        );
    });
});

describe('parseHelpAudience', () => {
    it('accepts the five audiences and rejects anything else', () => {
        expect(parseHelpAudience({ value: 'partner' })).toBe('partner');
        expect(parseHelpAudience({ value: 'tourist' })).toBeUndefined();
        expect(parseHelpAudience({ value: null })).toBeUndefined();
        expect(DEFAULT_HELP_AUDIENCE).toBe('host');
    });
});
