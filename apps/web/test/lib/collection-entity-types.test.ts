/**
 * @file collection-entity-types.test.ts
 * @description Regression tests for the collection detail page entity types (HOS-2423, HOS-2432).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    COLLECTION_ENTITY_PATH_SEGMENTS,
    COLLECTION_ENTITY_TYPES,
    COLLECTION_FILTER_LABELS,
    parseCollectionEntityType
} from '../../src/lib/collection-entity-types';

const readSrc = (path: string): string => readFileSync(resolve(__dirname, path), 'utf8');

/**
 * HOS-2480: the page reads and validates the URL; the `CollectionDetailView`
 * island draws the tabs, the cards and the pagination. Both are «the page».
 */
const pageSrc = [
    readSrc('../../src/pages/[lang]/mi-cuenta/favoritos/colecciones/[id].astro'),
    readSrc('../../src/components/account/favorites/CollectionDetailView.client.tsx')
].join('\n');
const cardSrc = readSrc('../../src/components/account/favorites/FavoriteBookmarkCard.tsx');
const collectionsSrc = readSrc(
    '../../src/components/account/favorites/FavoritesCollectionsSection.tsx'
);

const accountLocale = (locale: string): Record<string, unknown> =>
    JSON.parse(
        readFileSync(
            resolve(__dirname, `../../../../packages/i18n/src/locales/${locale}/account.json`),
            'utf8'
        )
    );

const lookup = (obj: Record<string, unknown>, dotted: string): unknown =>
    dotted.split('.').reduce<unknown>((acc, k) => (acc as Record<string, unknown>)?.[k], obj);

describe('collection entity types (HOS-2423)', () => {
    it.each([
        'VENUE',
        'EXPERIENCE',
        'ATTRACTION',
        'ACCOMMODATION',
        'DESTINATION',
        'EVENT',
        'POST'
    ])('accepts %s as a filterable type with a tab label and an entity path', (type) => {
        expect(parseCollectionEntityType({ value: type })).toBe(type);
        expect(COLLECTION_ENTITY_TYPES).toContain(type);
        expect(
            COLLECTION_FILTER_LABELS[type as keyof typeof COLLECTION_FILTER_LABELS]
        ).toBeDefined();
        expect(
            COLLECTION_ENTITY_PATH_SEGMENTS[type as keyof typeof COLLECTION_ENTITY_PATH_SEGMENTS]
        ).toBeTruthy();
    });

    it('rejects unknown and absent values', () => {
        expect(parseCollectionEntityType({ value: 'USER' })).toBeUndefined();
        expect(parseCollectionEntityType({ value: null })).toBeUndefined();
    });

    it('builds the page tabs from the shared type list, including ATTRACTION', () => {
        expect(pageSrc).toContain('COLLECTION_ENTITY_TYPES.map');
        expect(pageSrc).toContain('parseCollectionEntityType');
    });

    it('reuses the account.favorites.tabs.* keys instead of a duplicate filter set', () => {
        for (const type of COLLECTION_ENTITY_TYPES) {
            expect(COLLECTION_FILTER_LABELS[type].key).toMatch(/^account\.favorites\.tabs\./);
        }
    });

    it('uses the same fallback as the favorites tabs for the blog type', () => {
        expect(COLLECTION_FILTER_LABELS.POST.fallback).toBe('Blog');
    });

    it.each(['es', 'en', 'pt'])('has every filter label key in %s', (locale) => {
        const json = accountLocale(locale);
        for (const type of COLLECTION_ENTITY_TYPES) {
            const value = lookup(
                json,
                COLLECTION_FILTER_LABELS[type].key.replace(/^account\./, '')
            );
            expect(typeof value, `${locale}:${type}`).toBe('string');
        }
    });
});

describe('collection page i18n keys (HOS-2432)', () => {
    it('does not use the "Sin colección" key as the untitled fallback', () => {
        expect(pageSrc + cardSrc).not.toContain("collections.no_collection', 'Sin título'");
        expect(cardSrc).toContain("t('common.untitled'");
    });

    it('does not label the pagination nav with the type-filter key', () => {
        expect(pageSrc).not.toContain("filter.label', 'Paginación'");
        // HOS-2480: the kit Pagination owns its nav label and prev/next copy.
        expect(pageSrc).toContain('<Pagination');
        expect(pageSrc).toMatch(
            /import \{[^}]*\bPagination\b[^}]*\} from '@\/components\/account\/ui'/
        );
    });

    it('collection card count label is not the "Quitar de favoritos" remove label', () => {
        expect(collectionsSrc).not.toContain('account.favorites.removeLabel');
        expect(collectionsSrc).toContain("'account.favorites.bookmarks.count'");
        for (const locale of ['es', 'en', 'pt']) {
            expect(lookup(accountLocale(locale), 'favorites.bookmarks.count_one')).toBeTypeOf(
                'string'
            );
        }
    });
});
