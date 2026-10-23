/**
 * @file alliance-lead-message.optional-error.test.ts
 * @description Unit tests for `omitOptionalMessageError` (HOS-1767 AC:1767:4
 * and the pure half of AC:1767:5): the schema's `message` error must only be
 * shown on the free-text field when that text is actually required.
 */

import { describe, expect, it } from 'vitest';
import { omitOptionalMessageError } from '../../../src/lib/forms/alliance-lead-message';

const OPTIONAL_KINDS = ['partner', 'sponsor', 'editor'] as const;

describe('omitOptionalMessageError', () => {
    it.each(OPTIONAL_KINDS)('drops the message error for %s', (kind) => {
        const result = omitOptionalMessageError({
            kind,
            errors: {
                message: 'zodError.allianceLead.message.min',
                contactName: 'Este campo es obligatorio.'
            }
        });

        expect(result).toEqual({ contactName: 'Este campo es obligatorio.' });
        expect(result).not.toHaveProperty('message');
    });

    it('keeps the message error for service_provider', () => {
        const errors = { message: 'Contanos brevemente sobre tu servicio.' };
        const result = omitOptionalMessageError({ kind: 'service_provider', errors });

        expect(result).toEqual(errors);
        expect(result).not.toBe(errors);
    });

    it('does not mutate the argument', () => {
        const errors = { message: 'min', businessName: 'required' };

        omitOptionalMessageError({ kind: 'partner', errors });

        expect(errors).toEqual({ message: 'min', businessName: 'required' });
    });

    it('keeps every other key untouched in the returned copy', () => {
        const errors = { message: 'min', email: 'invalid', phone: 'invalid' };
        const result = omitOptionalMessageError({ kind: 'editor', errors });

        expect(result).toEqual({ email: 'invalid', phone: 'invalid' });
        expect(result).not.toBe(errors);
    });

    it('does nothing when the message error is absent', () => {
        const errors = { businessName: 'required' };

        expect(omitOptionalMessageError({ kind: 'sponsor', errors })).toEqual({
            businessName: 'required'
        });
    });

    it('returns an empty map for a lone message error in an optional kind', () => {
        // AC:1767:5: this is the value the component pairs with
        // `messageErrorHidden` to route the block to `formError` instead of
        // the optional field (the UI path itself is unreachable with real
        // labels, so the pure rule is the contract under test).
        expect(omitOptionalMessageError({ kind: 'sponsor', errors: { message: 'x' } })).toEqual({});
    });
});
