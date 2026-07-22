/**
 * @file AccommodationEditor.validation-messages.test.ts
 * @description Regression suite for HOS-243 — the host property EDIT form's
 * `bedrooms`/`bathrooms` bounds used to carry Zod's raw English default message.
 * `resolveValidationMessage` then treated that English string as an i18n key,
 * missed, and returned it verbatim in EVERY locale (es/en/pt).
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

/**
 * Run a single-field payload through the edit-form schema and resolve the
 * resulting field error the same way the editor does at submit time.
 */
function resolveFieldError(params: {
    readonly payload: Record<string, unknown>;
    readonly field: 'bedrooms' | 'bathrooms';
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
