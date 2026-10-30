/**
 * @file type-labels.test.ts
 * @description The venue owner form and the public listing page name a
 * listing type from ONE source (HOS-822).
 *
 * Written against the cause of the original drift (two hand-maintained label
 * tables), not its symptom: what is asserted is that the form resolves the
 * PUBLIC key and that every enum member resolves to a real translated value.
 */

import { VenueTypeEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { createTranslations, type SupportedLocale } from '../../../src/lib/i18n';
import { buildVenueTypeLabelKey, resolveVenueTypeLabel } from '../../../src/lib/venue/type-labels';

const LOCALES: readonly SupportedLocale[] = ['es', 'en', 'pt'];
const VENUE_TYPES = Object.values(VenueTypeEnum);

describe('buildVenueTypeLabelKey', () => {
    it('points at the public venue namespace', () => {
        expect(buildVenueTypeLabelKey({ type: 'RESTAURANT' })).toBe('venue.types.RESTAURANT');
    });

    it('never rebuilds the retired editor-private namespace', () => {
        for (const type of VENUE_TYPES) {
            expect(buildVenueTypeLabelKey({ type })).not.toContain('typeOption');
        }
    });
});

describe('resolveVenueTypeLabel: the form reads what the listing prints', () => {
    it.each(LOCALES)('resolves every enum member to a real translated label in %s', (locale) => {
        const { t } = createTranslations(locale);

        for (const type of VENUE_TYPES) {
            const label = resolveVenueTypeLabel({ t, type });

            // A missing key degrades to the raw enum value, so asserting the
            // label differs from it makes this a CONTENT check.
            expect(label, `${type} in ${locale} has no label`).not.toBe(type);
            expect(label.trim().length, `${type} in ${locale} is blank`).toBeGreaterThan(0);
            expect(label, `${type} in ${locale} looks like a raw key`).not.toContain('.');
        }
    });

    it('degrades to the raw enum value for a type with no translation', () => {
        const { t } = createTranslations('es');

        expect(resolveVenueTypeLabel({ t, type: 'NOT_A_REAL_TYPE' })).toBe('NOT_A_REAL_TYPE');
    });
});
