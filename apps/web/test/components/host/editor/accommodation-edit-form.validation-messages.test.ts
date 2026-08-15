/**
 * @file AccommodationEditor.validation-messages.test.ts
 * @description Regression suite for HOS-243 — the host property EDIT form's
 * `bedrooms`/`bathrooms` bounds used to carry Zod's raw English default message.
 * `resolveValidationMessage` then treated that English string as an i18n key,
 * missed, and returned it verbatim in EVERY locale (es/en/pt).
 *
 * HOS-251 extends the same regression coverage to the sibling numeric fields
 * that were left un-messaged when HOS-243 shipped: `maxGuests`, `latitude`,
 * `longitude`, and `basePrice`.
 *
 * Unlike `AccommodationEditor.test.tsx` (which mocks `@/lib/i18n` so `t` echoes
 * the key), this suite exercises the REAL resolution pipeline
 * `AccommodationEditFormSchema` → `zodIssuesToFieldErrors` →
 * `resolveValidationMessage` → `validation.json`, asserting the ACTUAL localized
 * string a host sees — not just that validation failed. Same approach as
 * `ContactForm.error-messages.test.tsx`.
 */

import { describe, expect, it } from 'vitest';
import { AccommodationEditFormSchema } from '@/components/host/editor/accommodation-edit-form.schema';
import { zodIssuesToFieldErrors } from '@/lib/forms/field-errors';
import { createT, type SupportedLocale } from '@/lib/i18n';

// The HOS-243 "not a raw `zodError.*`/`validation.*` key" regex is gone: every
// assertion below now compares the FULL expected string, which subsumes it.

type NumericField = 'bedrooms' | 'bathrooms' | 'maxGuests' | 'latitude' | 'longitude';

/**
 * Run a single-field payload through the edit-form schema and resolve the
 * resulting field error the same way the editor does at submit time.
 */
function resolveFieldError(params: {
    readonly payload: Record<string, unknown>;
    readonly field: NumericField;
    readonly locale: SupportedLocale;
}): string | undefined {
    const result = AccommodationEditFormSchema.safeParse(params.payload);
    expect(result.success).toBe(false);
    if (result.success) throw new Error('expected the payload to fail validation');
    return zodIssuesToFieldErrors(result.error.issues, createT(params.locale))[params.field];
}

describe('AccommodationEditor edit-form validation messages (HOS-243)', () => {
    it('renders the bedrooms.max error as human Spanish with the bound interpolated', () => {
        const message = resolveFieldError({
            payload: { bedrooms: 101 },
            field: 'bedrooms',
            locale: 'es'
        });
        expect(message).toBe('La cantidad de habitaciones no puede superar los 100');
    });

    it('renders the bathrooms.min error as human Spanish with the bound interpolated', () => {
        const message = resolveFieldError({
            payload: { bathrooms: 0 },
            field: 'bathrooms',
            locale: 'es'
        });
        expect(message).toBe('La cantidad de baños no puede ser menor a 1');
    });

    // H-57: this block used to assert only the pipeline contract ("not a raw key,
    // bound interpolated") because en/pt carried `[EN]`/`[PT]`-prefixed copy, and a
    // marker is neither a raw key nor an empty string — so the suite stayed green
    // over a defect users could see. It now asserts the EXACT string, which is the
    // unmarked Spanish fallback until en/pt are really translated.
    for (const locale of ['en', 'pt'] as const) {
        it(`renders the bedrooms.max error without a locale marker in ${locale}`, () => {
            const message = resolveFieldError({
                payload: { bedrooms: 101 },
                field: 'bedrooms',
                locale
            });
            expect(message).toBe('La cantidad de habitaciones no puede superar los 100');
        });
    }
});

describe('AccommodationEditor edit-form validation messages — sibling numeric fields (HOS-251)', () => {
    it('renders the maxGuests.max error as human Spanish with the bound interpolated', () => {
        const message = resolveFieldError({
            payload: { maxGuests: 201 },
            field: 'maxGuests',
            locale: 'es'
        });
        expect(message).toBe('La capacidad no puede superar los 200');
    });

    it('renders the maxGuests.min error as human Spanish with the bound interpolated', () => {
        const message = resolveFieldError({
            payload: { maxGuests: 0 },
            field: 'maxGuests',
            locale: 'es'
        });
        expect(message).toBe('La capacidad no puede ser menor a 1');
    });

    it('renders the latitude.max error as human Spanish with the bound interpolated', () => {
        const message = resolveFieldError({
            payload: { latitude: 91 },
            field: 'latitude',
            locale: 'es'
        });
        expect(message).toBe('La latitud no puede superar los 90');
    });

    it('renders the latitude.min error as human Spanish with the bound interpolated', () => {
        const message = resolveFieldError({
            payload: { latitude: -91 },
            field: 'latitude',
            locale: 'es'
        });
        expect(message).toBe('La latitud no puede ser menor a -90');
    });

    it('renders the longitude.max error as human Spanish with the bound interpolated', () => {
        const message = resolveFieldError({
            payload: { longitude: 181 },
            field: 'longitude',
            locale: 'es'
        });
        expect(message).toBe('La longitud no puede superar los 180');
    });

    it('renders the longitude.min error as human Spanish with the bound interpolated', () => {
        const message = resolveFieldError({
            payload: { longitude: -181 },
            field: 'longitude',
            locale: 'es'
        });
        expect(message).toBe('La longitud no puede ser menor a -180');
    });

    // Same H-57 tightening as the HOS-243 block above: exact copy, no marker.
    for (const locale of ['en', 'pt'] as const) {
        it(`renders the maxGuests.max error without a locale marker in ${locale}`, () => {
            const message = resolveFieldError({
                payload: { maxGuests: 201 },
                field: 'maxGuests',
                locale
            });
            expect(message).toBe('La capacidad no puede superar los 200');
        });

        it(`renders the latitude.max error without a locale marker in ${locale}`, () => {
            const message = resolveFieldError({
                payload: { latitude: 91 },
                field: 'latitude',
                locale
            });
            expect(message).toBe('La latitud no puede superar los 90');
        });

        it(`renders the longitude.max error without a locale marker in ${locale}`, () => {
            const message = resolveFieldError({
                payload: { longitude: 181 },
                field: 'longitude',
                locale
            });
            expect(message).toBe('La longitud no puede superar los 180');
        });
    }
});

/**
 * The exact string the August 2026 smoke captured in production: a host editing
 * an accommodation on `/en` saw `[EN] La capacidad no puede ser menor a 1` under
 * a UI that was otherwise correctly in English.
 */
describe('AccommodationEditor edit-form validation messages — locale markers (H-57)', () => {
    for (const locale of ['es', 'en', 'pt'] as const) {
        it(`renders the maxGuests.min error with no bracketed marker in ${locale}`, () => {
            const message = resolveFieldError({
                payload: { maxGuests: 0 },
                field: 'maxGuests',
                locale
            });
            expect(message).toBe('La capacidad no puede ser menor a 1');
        });
    }
});
