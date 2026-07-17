/**
 * @file use-zod-form.test.ts
 * @description Unit tests for the `useZodForm` shared form-validation hook
 * (HOS-190 slice 2).
 */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { TranslationFn } from '@/lib/api-errors';
import { useZodForm } from '@/lib/forms/use-zod-form';

const ContactLikeSchema = z.object({
    firstName: z.string().min(1, 'zodError.contact.firstName.min'),
    email: z.string().email('zodError.contact.email.invalid'),
    contactInfo: z.object({
        mobilePhone: z.string().min(6, 'zodError.contactInfo.mobilePhone.min')
    })
});

const validPayload = {
    firstName: 'Ana',
    email: 'ana@example.com',
    contactInfo: { mobilePhone: '1122334455' }
};

describe('useZodForm', () => {
    describe('validate', () => {
        it('starts with empty fieldErrors and null formError', () => {
            const { result } = renderHook(() => useZodForm({ schema: ContactLikeSchema }));

            expect(result.current.fieldErrors).toEqual({});
            expect(result.current.formError).toBeNull();
        });

        it('returns a successful safeParse result and clears fieldErrors on valid payload', () => {
            const { result } = renderHook(() => useZodForm({ schema: ContactLikeSchema }));

            let parseResult: ReturnType<typeof result.current.validate> | undefined;
            act(() => {
                parseResult = result.current.validate(validPayload);
            });

            expect(parseResult?.success).toBe(true);
            if (parseResult?.success) {
                expect(parseResult.data).toEqual(validPayload);
            }
            expect(result.current.fieldErrors).toEqual({});
        });

        it('populates fieldErrors (raw i18n keys) on an invalid payload when no `t` is given', () => {
            const { result } = renderHook(() => useZodForm({ schema: ContactLikeSchema }));

            act(() => {
                result.current.validate({ ...validPayload, firstName: '' });
            });

            expect(result.current.fieldErrors.firstName).toBe('zodError.contact.firstName.min');
        });

        it('maps nested-path issues using the dotted path (contactInfo.mobilePhone)', () => {
            const { result } = renderHook(() => useZodForm({ schema: ContactLikeSchema }));

            act(() => {
                result.current.validate({
                    ...validPayload,
                    contactInfo: { mobilePhone: '1' }
                });
            });

            expect(result.current.fieldErrors['contactInfo.mobilePhone']).toBe(
                'zodError.contactInfo.mobilePhone.min'
            );
        });

        it('resolves fieldErrors through `t` when provided', () => {
            const t: TranslationFn = (key, fallback, params) =>
                key === 'validation.contact.firstName.min'
                    ? `Mínimo ${params?.min} caracteres`
                    : (fallback ?? `[MISSING: ${key}]`);

            const { result } = renderHook(() => useZodForm({ schema: ContactLikeSchema, t }));

            act(() => {
                result.current.validate({ ...validPayload, firstName: '' });
            });

            expect(result.current.fieldErrors.firstName).toBe('Mínimo 1 caracteres');
        });

        it('re-validating a fixed payload clears previous fieldErrors', () => {
            const { result } = renderHook(() => useZodForm({ schema: ContactLikeSchema }));

            act(() => {
                result.current.validate({ ...validPayload, firstName: '' });
            });
            expect(result.current.fieldErrors.firstName).toBeDefined();

            act(() => {
                result.current.validate(validPayload);
            });
            expect(result.current.fieldErrors).toEqual({});
        });
    });

    describe('clearError', () => {
        it('removes a single field error without touching the others', () => {
            const { result } = renderHook(() => useZodForm({ schema: ContactLikeSchema }));

            act(() => {
                result.current.validate({ ...validPayload, firstName: '', email: 'not-an-email' });
            });
            expect(Object.keys(result.current.fieldErrors)).toEqual(
                expect.arrayContaining(['firstName', 'email'])
            );

            act(() => {
                result.current.clearError('firstName');
            });

            expect(result.current.fieldErrors.firstName).toBeUndefined();
            expect(result.current.fieldErrors.email).toBe('zodError.contact.email.invalid');
        });

        it('is a no-op when the field has no error', () => {
            const { result } = renderHook(() => useZodForm({ schema: ContactLikeSchema }));

            act(() => {
                result.current.clearError('firstName');
            });

            expect(result.current.fieldErrors).toEqual({});
        });
    });

    describe('handleApiError', () => {
        it('maps per-field API details into fieldErrors and leaves formError null', () => {
            const { result } = renderHook(() => useZodForm({ schema: ContactLikeSchema }));

            act(() => {
                result.current.handleApiError({
                    code: 'VALIDATION_ERROR',
                    details: [{ field: 'email', messageKey: 'validationError.field.invalidEmail' }]
                });
            });

            expect(result.current.fieldErrors.email).toBe('validationError.field.invalidEmail');
            expect(result.current.formError).toBeNull();
        });

        it('falls back to a form-level banner when the API sent no per-field details', () => {
            const { result } = renderHook(() => useZodForm({ schema: ContactLikeSchema }));

            act(() => {
                result.current.handleApiError({
                    code: 'RATE_LIMITED',
                    message: 'Too many requests'
                });
            });

            expect(result.current.fieldErrors).toEqual({});
            expect(result.current.formError).toBe('Too many requests');
        });

        it('uses the caller-provided fallback when the API error has no usable message', () => {
            const { result } = renderHook(() => useZodForm({ schema: ContactLikeSchema }));

            act(() => {
                result.current.handleApiError(null, 'Something went wrong, try again');
            });

            expect(result.current.formError).toBe('Something went wrong, try again');
        });

        it('routes the banner through translateApiError when `t` is provided', () => {
            const t: TranslationFn = vi.fn((key, fallback) =>
                key === 'common.apiError.RATE_LIMITED' ? 'Demasiados intentos' : (fallback ?? key)
            );

            const { result } = renderHook(() => useZodForm({ schema: ContactLikeSchema, t }));

            act(() => {
                result.current.handleApiError({
                    code: 'RATE_LIMITED',
                    message: 'Too many requests'
                });
            });

            expect(result.current.formError).toBe('Demasiados intentos');
            expect(t).toHaveBeenCalled();
        });

        it('merges newly mapped field errors on top of existing ones', () => {
            const { result } = renderHook(() => useZodForm({ schema: ContactLikeSchema }));

            act(() => {
                result.current.validate({ ...validPayload, firstName: '' });
            });
            expect(result.current.fieldErrors.firstName).toBeDefined();

            act(() => {
                result.current.handleApiError({
                    details: [{ field: 'email', messageKey: 'validationError.field.invalidEmail' }]
                });
            });

            expect(result.current.fieldErrors.firstName).toBe('zodError.contact.firstName.min');
            expect(result.current.fieldErrors.email).toBe('validationError.field.invalidEmail');
        });
    });

    describe('setFormError / reset', () => {
        it('setFormError sets and clears the banner directly', () => {
            const { result } = renderHook(() => useZodForm({ schema: ContactLikeSchema }));

            act(() => {
                result.current.setFormError('Custom banner');
            });
            expect(result.current.formError).toBe('Custom banner');

            act(() => {
                result.current.setFormError(null);
            });
            expect(result.current.formError).toBeNull();
        });

        it('reset clears both fieldErrors and formError', () => {
            const { result } = renderHook(() => useZodForm({ schema: ContactLikeSchema }));

            act(() => {
                result.current.validate({ ...validPayload, firstName: '' });
                result.current.setFormError('Some banner');
            });
            expect(result.current.fieldErrors.firstName).toBeDefined();
            expect(result.current.formError).toBe('Some banner');

            act(() => {
                result.current.reset();
            });

            expect(result.current.fieldErrors).toEqual({});
            expect(result.current.formError).toBeNull();
        });
    });
});
