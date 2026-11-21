/**
 * HOS-2410 (spec §5.2, D-H6, `docs/data-model.md` §7) — the committed index as
 * the runtime loads it: it is current with the content, and it holds the 16
 * migrated topics with the audiences and folders of the migration table.
 *
 * @module test/help-index
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
    buildHelpIndex,
    HELP_INDEX_FILE,
    readHelpContentFiles
} from '../src/generator/build-index';
import { findHelpArticle, HELP_ARTICLES, HELP_INDEX } from '../src/help-index';

/** The migration table of `docs/data-model.md` §7: id → [audiences, folder, verticals]. */
const MIGRATION: Readonly<Record<string, readonly [readonly string[], string, readonly string[]]>> =
    {
        photos: [
            ['experience', 'host', 'venue'],
            'common',
            ['accommodation', 'experience', 'venue']
        ],
        'create-listing': [
            ['experience', 'host', 'venue'],
            'common',
            ['accommodation', 'experience', 'venue']
        ],
        'publish-requirements': [
            ['experience', 'host', 'venue'],
            'common',
            ['accommodation', 'experience', 'venue']
        ],
        'pause-resume': [
            ['experience', 'host', 'venue'],
            'common',
            ['accommodation', 'experience', 'venue']
        ],
        'delete-listing': [
            ['experience', 'host', 'venue'],
            'common',
            ['accommodation', 'experience', 'venue']
        ],
        amenities: [
            ['experience', 'host', 'venue'],
            'common',
            ['accommodation', 'experience', 'venue']
        ],
        'fix-request': [
            ['experience', 'host', 'venue'],
            'common',
            ['accommodation', 'experience', 'venue']
        ],
        reviews: [
            ['experience', 'host', 'venue'],
            'common',
            ['accommodation', 'experience', 'venue']
        ],
        'change-plan': [
            ['experience', 'host', 'venue'],
            'common',
            ['accommodation', 'experience', 'venue']
        ],
        addons: [
            ['experience', 'host', 'venue'],
            'common',
            ['accommodation', 'experience', 'venue']
        ],
        'ai-assistants': [['experience', 'host', 'partner', 'provider', 'venue'], 'common', []],
        inquiries: [['host'], 'host', ['accommodation']],
        calendar: [['host'], 'host', ['accommodation']],
        'provider-directory': [['host'], 'host', []],
        'benefit-usage': [['host'], 'host', []],
        'benefit-usage-provider': [['provider'], 'provider', []]
    };

/** A price or a percentage in any form the old catalog test caught. */
const PRICE_PATTERN = /\$\s*\d|\bAR\$|\d\s*(ARS|USD|pesos)\b|\d\s*%/i;

describe('HELP_INDEX', () => {
    it('equals a fresh generation from the content files', () => {
        // Act
        const fresh = buildHelpIndex({ files: readHelpContentFiles() });

        // Assert
        expect(fresh.issues).toEqual([]);
        expect(fresh.json).toBe(readFileSync(HELP_INDEX_FILE, 'utf8'));
    });

    it('holds exactly the 16 migrated topic ids, sorted by id', () => {
        expect(HELP_ARTICLES.map((article) => article.id)).toEqual(Object.keys(MIGRATION).sort());
        expect(HELP_INDEX.locales.en).toBeUndefined();
    });

    it.each(
        Object.entries(MIGRATION)
    )('migrates %s with the audiences, folder and verticals of the table', (id, [
        audiences,
        folder,
        verticals
    ]) => {
        // Act
        const article = findHelpArticle({ id });

        // Assert
        expect(article?.audiences).toEqual(audiences);
        expect(article?.folder).toBe(folder);
        expect(article?.verticals).toEqual(verticals);
        expect(article?.covers.length).toBeGreaterThan(0);
    });

    it('keeps the three faqKey values of the TS catalog (D-H7)', () => {
        expect(
            Object.fromEntries(
                HELP_ARTICLES.filter((article) => article.faqKey !== undefined).map((article) => [
                    article.id,
                    article.faqKey
                ])
            )
        ).toEqual({
            addons: 'owners.featured',
            'create-listing': 'owners.ready',
            'pause-resume': 'owners.pause'
        });
    });

    it.each(
        HELP_ARTICLES.map((article) => [article.id, article] as const)
    )('%s states no price and no percentage', (_id, article) => {
        // Arrange: plan values are DB rows; the help points to the plans page.
        const { howTo, ...prose } = article.sections;
        const texts = [
            article.title,
            article.summary,
            ...howTo.steps,
            howTo.after,
            ...Object.values(prose)
        ];

        // Assert
        for (const text of texts) {
            expect(text).not.toMatch(PRICE_PATTERN);
        }
    });

    it('the price pattern catches the forms it is meant to', () => {
        for (const sample of [
            '$ 1500',
            '$1500',
            'AR$ 900',
            '900 ARS',
            '10 USD',
            '300 pesos',
            '20 %',
            '15%'
        ]) {
            expect(sample).toMatch(PRICE_PATTERN);
        }
        expect('hasta 10 MB y 3 fotos').not.toMatch(PRICE_PATTERN);
    });

    it('finds nothing for an unknown id or a locale with no content', () => {
        expect(findHelpArticle({ id: 'nope' })).toBeUndefined();
        expect(findHelpArticle({ id: 'photos', locale: 'en' })).toBeUndefined();
    });
});
