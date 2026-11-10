/**
 * Unit tests for the HOS-2060 `policies` write rules: the create default, the
 * shallow merge on update, and the re-validation of the merged object.
 */
import { ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    resolveCreatePolicies,
    resolveUpdatePolicies
} from '../../../src/services/listing/listing-policies-write';
import { ServiceError } from '../../../src/types';

describe('resolveCreatePolicies', () => {
    it.each([
        'accommodation',
        'venue',
        'experience'
    ] as const)('gives a new %s listing the cash default when the body sends nothing', (vertical) => {
        // Act
        const result = resolveCreatePolicies({ vertical, payload: {} });

        // Assert
        expect(result).toEqual({ policies: { paymentMethods: ['cash'] } });
    });

    it('keeps the default under the rules the body declares', () => {
        // Act
        const result = resolveCreatePolicies({
            vertical: 'accommodation',
            payload: { policies: { minNights: 2, pets: { admission: 'yes' } } }
        });

        // Assert
        expect(result.policies).toEqual({
            paymentMethods: ['cash'],
            minNights: 2,
            pets: { admission: 'yes' }
        });
    });

    it('lets the body replace the default payment methods', () => {
        // Act
        const result = resolveCreatePolicies({
            vertical: 'venue',
            payload: { policies: { paymentMethods: ['debit', 'credit'] } }
        });

        // Assert
        expect(result.policies).toEqual({ paymentMethods: ['debit', 'credit'] });
    });

    it('treats policies: null on create as the default', () => {
        // Act
        const result = resolveCreatePolicies({
            vertical: 'experience',
            payload: { policies: null }
        });

        // Assert
        expect(result.policies).toEqual({ paymentMethods: ['cash'] });
    });

    it('rejects an invalid create body with a VALIDATION_ERROR', () => {
        // Act
        const act = () =>
            resolveCreatePolicies({
                vertical: 'venue',
                payload: { policies: { minAge: 99 } }
            });

        // Assert
        expect(act).toThrow(ServiceError);
        try {
            act();
        } catch (error) {
            expect((error as ServiceError).code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        }
    });
});

describe('resolveUpdatePolicies', () => {
    const stored = { paymentMethods: ['cash'], minNights: 2, maxNights: 10 };

    it('writes nothing when the body does not mention policies', () => {
        // Act
        const result = resolveUpdatePolicies({
            vertical: 'accommodation',
            payload: { name: 'x' },
            current: stored
        });

        // Assert
        expect(result).toEqual({});
    });

    it('merges one key over the stored object and keeps the rest', () => {
        // Act
        const result = resolveUpdatePolicies({
            vertical: 'accommodation',
            payload: { policies: { pets: { admission: 'on_request' } } },
            current: stored
        });

        // Assert
        expect(result.policies).toEqual({ ...stored, pets: { admission: 'on_request' } });
    });

    it('removes a key the body sets to null', () => {
        // Act
        const result = resolveUpdatePolicies({
            vertical: 'accommodation',
            payload: { policies: { maxNights: null } },
            current: stored
        });

        // Assert
        expect(result.policies).toEqual({ paymentMethods: ['cash'], minNights: 2 });
    });

    it('clears the column when the body sends policies: null', () => {
        // Act
        const result = resolveUpdatePolicies({
            vertical: 'venue',
            payload: { policies: null },
            current: { paymentMethods: ['cash'], minAge: 18 }
        });

        // Assert
        expect(result).toEqual({ policies: null });
    });

    it('merges over an empty column', () => {
        // Act
        const result = resolveUpdatePolicies({
            vertical: 'experience',
            payload: { policies: { privateGroups: true } },
            current: null
        });

        // Assert
        expect(result.policies).toEqual({ privateGroups: true });
    });

    it('re-validates the merged whole: a new minNights above the stored maxNights is a 400', () => {
        // Act
        const act = () =>
            resolveUpdatePolicies({
                vertical: 'accommodation',
                payload: { policies: { minNights: 20 } },
                current: stored
            });

        // Assert
        expect(act).toThrow(ServiceError);
        try {
            act();
        } catch (error) {
            expect((error as ServiceError).code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        }
    });
});
