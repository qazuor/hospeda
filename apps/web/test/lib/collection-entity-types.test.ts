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
    isCollectionEntityType
} from '../../src/lib/collection-entity-types';

const pageSrc = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/favoritos/colecciones/[id].astro'),
    'utf8'
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
        expect(isCollectionEntityType({ value: type })).toBe(true);
        expect(COLLECTION_ENTITY_TYPES).toContain(type);
        expect(
            COLLECTION_FILTER_LABELS[type as keyof typeof COLLECTION_FILTER_LABELS]
        ).toBeDefined();
        expect(
            COLLECTION_ENTITY_PATH_SEGMENTS[type as keyof typeof COLLECTION_ENTITY_PATH_SEGMENTS]
        ).toBeTruthy();
    });

    it('rejects unknown and absent values', () => {
        expect(isCollectionEntityType({ value: 'USER' })).toBe(false);
        expect(isCollectionEntityType({ value: null })).toBe(false);
    });

    it('builds the page tabs from the shared type list, including ATTRACTION', () => {
        expect(pageSrc).toContain('COLLECTION_ENTITY_TYPES.map');
        expect(pageSrc).toContain('isCollectionEntityType');
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
        expect(pageSrc).not.toContain("collections.no_collection', 'Sin título'");
        expect(pageSrc).toContain("t('common.untitled'");
    });

    it('does not label the pagination nav with the type-filter key', () => {
        expect(pageSrc).not.toContain("filter.label', 'Paginación'");
        expect(pageSrc).toContain("t('common.pagination'");
    });

    it('uses the short prev/next labels for the visible pagination text', () => {
        expect(pageSrc).toContain("t('common.prev'");
        expect(pageSrc).toContain("t('common.next'");
    });

    it('collection card count label is not the "Quitar de favoritos" remove label', () => {
        const src = readFileSync(
            resolve(__dirname, '../../src/components/account/UserFavoritesList.client.tsx'),
            'utf8'
        );
        expect(src).not.toContain("bookmarksLabel={t('account.favorites.removeLabel'");
        expect(src).toContain("'account.favorites.collections.bookmarksLabel'");
        for (const locale of ['es', 'en', 'pt']) {
            expect(
                lookup(accountLocale(locale), 'favorites.collections.bookmarksLabel')
            ).toBeTypeOf('string');
        }
    });
});
