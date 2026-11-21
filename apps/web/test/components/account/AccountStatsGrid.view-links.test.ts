/**
 * @file AccountStatsGrid.view-links.test.ts
 * @description Regression for HOS-2453: the dashboard stat cards built their
 * link text as `{viewLabel} {label.toLowerCase()}`. That glues a verb to a
 * lowercased noun, which fixes the word order for every locale and lowercases
 * words that should keep their case. Each link is now one translatable phrase.
 *
 * @module test/components/account/AccountStatsGrid.view-links
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
    resolve(__dirname, '../../../src/components/account/AccountStatsGrid.astro'),
    'utf8'
);

const LOCALES_DIR = resolve(__dirname, '../../../../../packages/i18n/src/locales');
const LOCALES = ['es', 'en', 'pt'] as const;
const KEYS = [
    'viewProperties',
    'viewMessages',
    'viewListings',
    'viewFavorites',
    'viewReviews',
    'viewSubscription'
] as const;

type StatsSubtree = Record<string, string>;

const readStats = (locale: string): StatsSubtree => {
    const parsed = JSON.parse(
        readFileSync(resolve(LOCALES_DIR, locale, 'account.json'), 'utf8')
    ) as {
        pages: { dashboard: { stats: StatsSubtree } };
    };
    return parsed.pages.dashboard.stats;
};

describe('AccountStatsGrid view links (HOS-2453)', () => {
    it('never builds a phrase with .toLowerCase()', () => {
        expect(source).not.toContain('.toLowerCase()');
    });

    it.each(KEYS)('reads %s as a whole phrase key', (key) => {
        expect(source).toContain(`account.pages.dashboard.stats.${key}`);
    });

    it.each(LOCALES)('%s defines every view-link phrase', (locale) => {
        const stats = readStats(locale);
        for (const key of KEYS) {
            expect(typeof stats[key]).toBe('string');
            expect(stats[key]?.length).toBeGreaterThan(0);
        }
    });
});
