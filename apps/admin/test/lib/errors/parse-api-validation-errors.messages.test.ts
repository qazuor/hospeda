/**
 * @file parse-api-validation-errors.messages.test.ts
 * @description Regression suite for H-27 (smoke agosto 2026): every validation
 * error the API reported was rendered in the admin as
 * `[MISSING: zodError.post.title.required]` instead of the real message.
 *
 * The cause was NOT a missing translation — the keys exist and are translated
 * in `es`/`en`/`pt`. `parseApiValidationErrors` called `t(detail.messageKey)`
 * directly on the `zodError.*` key the API returns, while the only function
 * that rewrites that prefix to the `validation.*` namespace where the strings
 * actually live (`resolveValidationMessage`) was never invoked on that path.
 *
 * Unlike the sibling suite (`parse-api-validation-errors.test.ts`), which uses
 * a stub `t`, this one drives the REAL pipeline
 * API envelope → `parseApiValidationErrors` → `resolveValidationMessage` →
 * `validation.json`, and asserts the ACTUAL localized string an editor sees.
 * A stub `t` is exactly what let this bug live: it never had to know which
 * namespace the key belongs to.
 */

import { useTranslations } from '@repo/i18n';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { parseApiValidationErrors } from '../../../src/lib/errors/parse-api-validation-errors';

/** Matches a leftover i18n key that reached the UI unresolved. */
const RAW_KEY_RE = /^(zodError|validationError|validation)\./;

/** Matches the sentinel `useTranslations` returns for a dictionary miss. */
const MISSING_RE = /^\[MISSING:/;

/**
 * Build the REAL translation function backed by the shipped dictionaries,
 * including its `[MISSING: key]` behaviour on a miss.
 */
function realT(locale: 'es' | 'en' | 'pt') {
    const { result } = renderHook(() => useTranslations(locale));
    return result.current.t as (key: string, params?: Record<string, unknown>) => string;
}

/** One `details[]` entry exactly as `transformZodError` emits it. */
interface ApiDetail {
    readonly field: string;
    readonly messageKey: string;
    readonly code: string;
    readonly zodMessage?: string;
    readonly userFriendlyMessage?: string;
    readonly params?: Record<string, unknown>;
    readonly suggestion?: string;
}

/** Build the standardized 400 envelope the API returns for a Zod failure. */
function buildApiValidationError(details: readonly ApiDetail[]) {
    const fields = new Set(details.map((d) => d.field));
    return {
        success: false,
        error: {
            code: 'VALIDATION_ERROR',
            messageKey: 'validationError.validation.failed',
            zodMessage: 'Validation failed',
            userFriendlyMessage: `Please fix the ${details.length} validation errors in ${fields.size} fields`,
            details,
            summary: { totalErrors: details.length, fieldCount: fields.size }
        }
    };
}

/**
 * The exact payload measured in production on `POST /api/v1/admin/posts`
 * with an empty form (H-27) — three fields, three `zodError.*` keys.
 */
const EMPTY_POST_DETAILS: readonly ApiDetail[] = [
    {
        field: 'title',
        messageKey: 'zodError.post.title.required',
        code: 'TOO_SMALL',
        zodMessage: 'zodError.post.title.required',
        userFriendlyMessage: 'Title is required'
    },
    {
        field: 'summary',
        messageKey: 'zodError.post.summary.required',
        code: 'TOO_SMALL',
        zodMessage: 'zodError.post.summary.required',
        userFriendlyMessage: 'Summary is required'
    },
    {
        field: 'category',
        messageKey: 'zodError.enums.postCategory.invalid',
        code: 'INVALID_VALUE',
        zodMessage: 'zodError.enums.postCategory.invalid',
        userFriendlyMessage: 'Category is invalid'
    }
];

describe('parseApiValidationErrors — real i18n resolution (H-27)', () => {
    it('renders the empty-post 400 as human Spanish, not [MISSING: zodError.*]', () => {
        // Arrange
        const apiBody = buildApiValidationError(EMPTY_POST_DETAILS);

        // Act
        const fieldErrors = parseApiValidationErrors({ error: apiBody, t: realT('es') });

        // Assert — the exact strings shipped in es/validation.json
        expect(fieldErrors).toEqual({
            title: 'El título es obligatorio',
            summary: 'El resumen es obligatorio',
            category: 'El post category no es válido'
        });
    });

    it('leaks neither the [MISSING: …] sentinel nor a raw key in any locale', () => {
        for (const locale of ['es', 'en', 'pt'] as const) {
            // Arrange
            const apiBody = buildApiValidationError(EMPTY_POST_DETAILS);

            // Act
            const fieldErrors = parseApiValidationErrors({ error: apiBody, t: realT(locale) });

            // Assert
            expect(Object.keys(fieldErrors)).toHaveLength(EMPTY_POST_DETAILS.length);
            for (const [field, message] of Object.entries(fieldErrors)) {
                expect(message, `${locale}/${field}`).not.toMatch(MISSING_RE);
                expect(message, `${locale}/${field}`).not.toMatch(RAW_KEY_RE);
            }
        }
    });

    it('interpolates the bound the API sent in `params` instead of showing {{min}}', () => {
        // Arrange — `post.content.min` is "El contenido debe tener al menos {{min}} caracteres"
        const apiBody = buildApiValidationError([
            {
                field: 'content',
                messageKey: 'zodError.post.content.min',
                code: 'TOO_SMALL',
                zodMessage: 'zodError.post.content.min',
                userFriendlyMessage: 'Content must be at least 100 characters',
                params: { min: 100, inclusive: true }
            }
        ]);

        // Act
        const fieldErrors = parseApiValidationErrors({ error: apiBody, t: realT('es') });

        // Assert
        expect(fieldErrors.content).toBe('El contenido debe tener al menos 100 caracteres');
    });

    it('resolves the generic `validationError.*` keys the transformer falls back to', () => {
        // Arrange — a field whose schema declares no custom key gets the
        // generic code-derived key (`ZOD_ERROR_MESSAGE_MAP`).
        const apiBody = buildApiValidationError([
            {
                field: 'authorId',
                messageKey: 'validationError.field.invalidType',
                code: 'INVALID_TYPE',
                zodMessage: 'Invalid input: expected string, received undefined',
                userFriendlyMessage: 'Author id is required'
            }
        ]);

        // Act
        const fieldErrors = parseApiValidationErrors({ error: apiBody, t: realT('es') });

        // Assert
        expect(fieldErrors.authorId).toBe('Tipo de dato inválido');
    });

    it('falls back to the API English message when the key has no translation', () => {
        // Arrange — a key that exists in no locale. Showing the API's
        // `userFriendlyMessage` beats showing the raw key to an editor.
        const apiBody = buildApiValidationError([
            {
                field: 'title',
                messageKey: 'zodError.post.title.thisKeyDoesNotExist',
                code: 'CUSTOM_VALIDATION_ERROR',
                zodMessage: 'nope',
                userFriendlyMessage: 'Title is not acceptable'
            }
        ]);

        // Act
        const fieldErrors = parseApiValidationErrors({ error: apiBody, t: realT('es') });

        // Assert
        expect(fieldErrors.title).toBe('Title is not acceptable');
    });

    it('still returns the key when neither a translation nor an API message exists', () => {
        // Arrange — degraded input: never show an empty string.
        const apiBody = buildApiValidationError([
            {
                field: 'title',
                messageKey: 'zodError.post.title.thisKeyDoesNotExist',
                code: 'CUSTOM_VALIDATION_ERROR'
            }
        ]);

        // Act
        const fieldErrors = parseApiValidationErrors({ error: apiBody, t: realT('es') });

        // Assert
        expect(fieldErrors.title).toBe('zodError.post.title.thisKeyDoesNotExist');
    });
});
