/**
 * @file CreatePropertyMiniForm.error-messages.test.tsx
 * @description Regression suite for HOS-190 BETA-190 (OF4) — CreatePropertyMiniForm
 * already resolves its field errors through the shared `useZodForm` +
 * `zodIssuesToFieldErrors` pipeline, so the bug was in the i18n VALUES: the
 * `type` and `destinationId` errors read as spanglish ("El accommodation type no
 * es válido") / technical ("ID debe ser un UUID válido").
 *
 * This asserts on the exact message string `<FieldError>` renders for those two
 * fields, produced by the SAME real pipeline the form uses (real `es`
 * translations, seeded by test/setup.ts).
 */

import { AccommodationCreateDraftHttpSchema } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { zodIssuesToFieldErrors } from '../../../src/lib/forms/field-errors';
import { createTranslations } from '../../../src/lib/i18n';

describe('CreatePropertyMiniForm — human validation messages (HOS-190 BETA-190 / OF4)', () => {
    const { t } = createTranslations('es');

    it('resolves the type + destinationId errors to human Spanish, not spanglish/technical text', () => {
        const result = AccommodationCreateDraftHttpSchema.safeParse({
            name: 'Casa de prueba',
            summary: 'Un resumen suficientemente largo para pasar la validación.',
            type: 'NOT_A_REAL_TYPE',
            destinationId: 'not-a-uuid'
        });

        expect(result.success).toBe(false);
        if (result.success) return;

        const errors = zodIssuesToFieldErrors(result.error.issues, t);

        expect(errors.type).toBe('Elegí un tipo de alojamiento válido');
        expect(errors.destinationId).toBe('Seleccioná una opción válida de la lista');

        for (const value of Object.values(errors)) {
            expect(value).not.toMatch(/^zodError\./);
            expect(value).not.toMatch(/^validation\./);
        }
        // The old spanglish / technical strings must be gone.
        expect(errors.type).not.toContain('accommodation type');
        expect(errors.destinationId).not.toContain('UUID');
    });
});
