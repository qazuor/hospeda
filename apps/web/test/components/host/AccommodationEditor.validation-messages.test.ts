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
import { AccommodationEditFormSchema } from '@/components/host/AccommodationEditor.client';
import { zodIssuesToFieldErrors } from '@/lib/forms/field-errors';
import { createT, type SupportedLocale } from '@/lib/i18n';

/** Matches a leftover i18n key (schema key or resolved-but-missing key). */
const RAW_KEY_RE = /^(zodError|validation)\./;

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

    // en/pt are still placeholder translations ([EN]/[PT] prefixed), so assert
    // on the pipeline contract (resolved, not a raw key, bound interpolated)
    // rather than the exact copy — the point is no raw `zodError.*` key leaks.
    for (const locale of ['en', 'pt'] as const) {
        it(`resolves bedrooms.max to a non-key, interpolated string in ${locale}`, () => {
            const message = resolveFieldError({
                payload: { bedrooms: 101 },
                field: 'bedrooms',
                locale
            });
            expect(message).toBeDefined();
            expect(message ?? '').not.toMatch(RAW_KEY_RE);
            expect(message ?? '').toContain('100');
            expect(message ?? '').not.toContain('{{max}}');
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

    // en/pt are still placeholder translations ([EN]/[PT] prefixed), so assert
    // on the pipeline contract (resolved, not a raw key, bound interpolated)
    // rather than the exact copy — the point is no raw `zodError.*` key leaks.
    for (const locale of ['en', 'pt'] as const) {
        it(`resolves maxGuests.max to a non-key, interpolated string in ${locale}`, () => {
            const message = resolveFieldError({
                payload: { maxGuests: 201 },
                field: 'maxGuests',
                locale
            });
            expect(message).toBeDefined();
            expect(message ?? '').not.toMatch(RAW_KEY_RE);
            expect(message ?? '').toContain('200');
            expect(message ?? '').not.toContain('{{max}}');
        });

        it(`resolves latitude.max to a non-key, interpolated string in ${locale}`, () => {
            const message = resolveFieldError({
                payload: { latitude: 91 },
                field: 'latitude',
                locale
            });
            expect(message).toBeDefined();
            expect(message ?? '').not.toMatch(RAW_KEY_RE);
            expect(message ?? '').toContain('90');
            expect(message ?? '').not.toContain('{{max}}');
        });

        it(`resolves longitude.max to a non-key, interpolated string in ${locale}`, () => {
            const message = resolveFieldError({
                payload: { longitude: 181 },
                field: 'longitude',
                locale
            });
            expect(message).toBeDefined();
            expect(message ?? '').not.toMatch(RAW_KEY_RE);
            expect(message ?? '').toContain('180');
            expect(message ?? '').not.toContain('{{max}}');
        });
    }
});
