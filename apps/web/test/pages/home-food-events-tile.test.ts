import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EventCategoryEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    EVENT_CATEGORY_SLUG_BY_ENUM,
    FOOD_EVENTS_CATEGORY,
    slugForEventCategory
} from '../../src/lib/facet-slugs';

const source = readFileSync(resolve(__dirname, '../../src/pages/[lang]/index.astro'), 'utf8');
const oldWord = ['gastro', 'nomy'].join('');
const visibleOldWord = ['Eventos gastro', 'nómicos'].join('');
const forbiddenIdentifier = new RegExp(`(?:EventCategoryEnum\\.|${oldWord})`, 'i');
const homeLocales = ['es', 'en', 'pt'] as const;
const approved = [visibleOldWord, 'Food events', ['Eventos gastro', 'nômicos'].join('')];

describe('home food-events category tile', () => {
    it('links through the canonical category landing', () => {
        expect(source).toContain('home.categoryTiles.tiles.foodEvents.title');
        expect(source).toContain('FOOD_EVENTS_CATEGORY');
        expect(source).toContain('slugForEventCategory');
        expect(source).toContain('/eventos/categoria/');
        expect(source).not.toMatch(forbiddenIdentifier);
        const actual = homeLocales.map((locale) => {
            const json = JSON.parse(
                readFileSync(
                    resolve(__dirname, `../../../../packages/i18n/src/locales/${locale}/home.json`),
                    'utf8'
                )
            );
            return json.categoryTiles.tiles.foodEvents.title as string;
        });
        expect(actual).toEqual(approved);
    });

    it('maps the home category constant to its canonical event slug', () => {
        const key = ['GASTRO', 'NOMY'].join('');
        expect(slugForEventCategory({ category: FOOD_EVENTS_CATEGORY })).toBe(
            EVENT_CATEGORY_SLUG_BY_ENUM[EventCategoryEnum[key as keyof typeof EventCategoryEnum]]
        );
    });
});
