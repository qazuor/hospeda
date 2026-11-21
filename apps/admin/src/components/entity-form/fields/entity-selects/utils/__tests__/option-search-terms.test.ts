/**
 * @file option-search-terms.test.ts
 * @description Client-mode option filtering (HOS-2340 AC-2.4, 2.7, R4): options that
 * carry `searchTerms` use the shared matcher, every other option keeps `includes()`.
 */

import { describe, expect, it } from 'vitest';
import {
    SELECT_OPTION_SEARCH_TERMS_KEY,
    type SelectOption
} from '@/components/entity-form/types/field-config.types';
import { filterClientOptions, getSearchTerms } from '../option-search-terms';

const plain = (value: string, label: string): SelectOption => ({ value, label });

const withTerms = (value: string, label: string, keywords: string[] = []): SelectOption => ({
    value,
    label,
    metadata: {
        [SELECT_OPTION_SEARCH_TERMS_KEY]: {
            nameI18n: { es: label, en: '', pt: '' },
            keywordsI18n: { es: keywords, en: [], pt: [] }
        }
    }
});

describe('filterClientOptions', () => {
    it('keeps the includes() behaviour for options without search terms (AC-2.4)', () => {
        const options = [plain('a', 'Piscina climatizada'), plain('b', 'Wifi')];

        expect(filterClientOptions({ options, query: 'PISC' }).map((o) => o.value)).toEqual(['a']);
        // includes() is accent sensitive: «climatizada» does not contain «climátiz».
        expect(filterClientOptions({ options, query: 'climátiz' })).toEqual([]);
        // and it is a substring match, not a token prefix.
        expect(filterClientOptions({ options, query: 'scina' }).map((o) => o.value)).toEqual(['a']);
    });

    it('uses the shared matcher for options with search terms', () => {
        const options = [withTerms('a', 'Plomería', ['canillas']), withTerms('b', 'Gas')];

        expect(filterClientOptions({ options, query: 'canil' }).map((o) => o.value)).toEqual(['a']);
        expect(filterClientOptions({ options, query: 'plomeria' }).map((o) => o.value)).toEqual([
            'a'
        ]);
        // token prefix, not substring
        expect(filterClientOptions({ options, query: 'omeria' })).toEqual([]);
    });

    it('ranks a name match before a keyword-only match, keeping server order (AC-2.7)', () => {
        const options = [
            withTerms('kw', 'Climatización', ['aire acondicionado']),
            withTerms('name', 'Aire y ventilación')
        ];

        expect(filterClientOptions({ options, query: 'aire' }).map((o) => o.value)).toEqual([
            'name',
            'kw'
        ]);
    });

    it('falls back to includes() when the metadata is malformed (R4)', () => {
        const malformed: SelectOption = {
            value: 'x',
            label: 'Plomería',
            metadata: { [SELECT_OPTION_SEARCH_TERMS_KEY]: { nameI18n: 42 } }
        };

        expect(getSearchTerms(malformed)).toBeUndefined();
        expect(filterClientOptions({ options: [malformed], query: 'plom' })).toEqual([malformed]);
    });
});
