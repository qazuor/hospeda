/**
 * @file catalog-attribute-badges.test.ts
 * @description HOS-2058 public presentation rules: badges only for declared
 * values, and feature grouping only when something is classified.
 */

import { describe, expect, it } from 'vitest';
import {
    groupFeaturesForDisplay,
    resolveAmenityAttributeBadges
} from '../../src/lib/catalog-attribute-badges';
import { createTranslations, type SupportedLocale } from '../../src/lib/i18n';

const { t } = createTranslations('es');

describe('resolveAmenityAttributeBadges', () => {
    it('renders no badge for an undeclared relation', () => {
        expect(resolveAmenityAttributeBadges({ scope: null, availability: null, t })).toEqual([]);
        expect(resolveAmenityAttributeBadges({ t })).toEqual([]);
    });

    it('renders scope then availability when both are declared', () => {
        expect(
            resolveAmenityAttributeBadges({ scope: 'shared', availability: 'seasonal', t })
        ).toEqual(['Compartido', 'De temporada']);
    });

    it('renders only the declared one', () => {
        expect(resolveAmenityAttributeBadges({ scope: 'private', availability: null, t })).toEqual([
            'Privado'
        ]);
        expect(
            resolveAmenityAttributeBadges({ scope: null, availability: 'year_round', t })
        ).toEqual(['Todo el año']);
    });

    it('ignores an unknown value instead of inventing a label', () => {
        expect(
            resolveAmenityAttributeBadges({ scope: 'public', availability: 'always', t })
        ).toEqual([]);
    });

    it.each([
        'es',
        'en',
        'pt'
    ] as readonly SupportedLocale[])('resolves real translations in %s', (locale) => {
        const { t: tl } = createTranslations(locale);
        const badges = resolveAmenityAttributeBadges({
            scope: 'private',
            availability: 'seasonal',
            t: tl
        });
        for (const badge of badges) {
            expect(badge).not.toContain('accommodations.');
        }
        expect(badges).toHaveLength(2);
    });
});

describe('groupFeaturesForDisplay', () => {
    it('returns null (render flat) when no feature has a category, as on venue/experience', () => {
        expect(
            groupFeaturesForDisplay({
                features: [{ name: 'a' }, { name: 'b', category: null }],
                t
            })
        ).toBeNull();
    });

    it('groups when at least one feature is classified, the rest under "Otras"', () => {
        const groups = groupFeaturesForDisplay({
            features: [
                { name: 'quiet', category: 'STYLE' },
                { name: 'dj_sets', category: null }
            ],
            t
        });

        expect(groups?.map((g) => g.label)).toEqual(['Estilo', 'Otras']);
    });
});
