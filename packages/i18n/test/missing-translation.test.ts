/**
 * Unit tests for the canonical `isMissingTranslation` predicate.
 *
 * The predicate has to agree with BOTH live `t()` conventions:
 * - the `[MISSING: <key>]` marker (development builds, and the
 *   `useTranslations` hook in every build), and
 * - the raw key echoed back (apps/web `resolve()` in a production build).
 */

import { describe, expect, it } from 'vitest';
import { isMissingTranslation, MISSING_TRANSLATION_MARKER } from '../src/missing-translation';

describe('MISSING_TRANSLATION_MARKER', () => {
    it('is the exact prefix the translation functions emit', () => {
        // Written out by hand on purpose: spreading the module constant would
        // make this assertion vacuous.
        expect(MISSING_TRANSLATION_MARKER).toBe('[MISSING:');
    });
});

describe('isMissingTranslation', () => {
    describe('reports missing', () => {
        it('for the development marker', () => {
            expect(
                isMissingTranslation({
                    key: 'billing.limit.max_active_alerts.message_one',
                    value: '[MISSING: billing.limit.max_active_alerts.message_one]'
                })
            ).toBe(true);
        });

        it('for the marker without a trailing space', () => {
            expect(isMissingTranslation({ key: 'a.b', value: '[MISSING:a.b]' })).toBe(true);
        });

        it('for the raw key echoed back by a production build', () => {
            expect(
                isMissingTranslation({
                    key: 'billing.limit.max_active_alerts.message_one',
                    value: 'billing.limit.max_active_alerts.message_one'
                })
            ).toBe(true);
        });

        it('for undefined', () => {
            expect(isMissingTranslation({ key: 'a.b', value: undefined })).toBe(true);
        });

        it('for null', () => {
            expect(isMissingTranslation({ key: 'a.b', value: null })).toBe(true);
        });

        it('for the empty string', () => {
            expect(isMissingTranslation({ key: 'a.b', value: '' })).toBe(true);
        });
    });

    describe('reports present', () => {
        it('for a real Spanish translation', () => {
            expect(
                isMissingTranslation({
                    key: 'review.count_other',
                    value: '5 resenas'
                })
            ).toBe(false);
        });

        it('for a real English translation', () => {
            expect(isMissingTranslation({ key: 'review.count_other', value: '5 reviews' })).toBe(
                false
            );
        });

        it('for a real Portuguese translation', () => {
            expect(isMissingTranslation({ key: 'review.count_other', value: '5 avaliacoes' })).toBe(
                false
            );
        });

        it('for a value that merely CONTAINS the marker text', () => {
            // Only a prefix match counts — copy quoting the marker is a real value.
            expect(
                isMissingTranslation({ key: 'a.b', value: 'Se muestra [MISSING: x] en pantalla' })
            ).toBe(false);
        });

        it('for a value that merely CONTAINS the key', () => {
            expect(
                isMissingTranslation({ key: 'review.count', value: 'clave review.count activa' })
            ).toBe(false);
        });

        it('for a value equal to a DIFFERENT key than the one requested', () => {
            expect(
                isMissingTranslation({ key: 'review.count_one', value: 'review.count_other' })
            ).toBe(false);
        });

        it('for a whitespace-only value', () => {
            expect(isMissingTranslation({ key: 'a.b', value: ' ' })).toBe(false);
        });
    });
});
