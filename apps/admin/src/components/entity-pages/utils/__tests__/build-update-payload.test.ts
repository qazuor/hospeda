import { describe, expect, it } from 'vitest';
import {
    buildEntityUpdatePayload,
    completePoliciesPatch,
    readFieldValueForSave
} from '../build-update-payload';

describe('readFieldValueForSave', () => {
    it('prefers the nested copy and falls back to the flat key', () => {
        // Arrange
        const source = { a: { b: 'nested' }, 'a.b': 'flat', 'c.d': 'only-flat' };

        // Act / Assert
        expect(readFieldValueForSave(source, 'a.b')).toBe('nested');
        expect(readFieldValueForSave(source, 'c.d')).toBe('only-flat');
        expect(readFieldValueForSave(source, 'missing.key')).toBeUndefined();
    });
});

describe('completePoliciesPatch', () => {
    it('completes nested rules with their stored keys and leaves the rest alone', () => {
        // Arrange
        const stored = { pets: { admission: 'yes', notes: { es: 'n' } }, minNights: 2 };

        // Act
        const { policies } = completePoliciesPatch({
            patch: { pets: { admission: 'no' }, paymentMethods: ['cash'] },
            stored
        });

        // Assert
        expect(policies).toStrictEqual({
            pets: { admission: 'no', notes: { es: 'n' } },
            paymentMethods: ['cash']
        });
    });

    it('returns the patch as is when nothing is stored', () => {
        // Act
        const { policies } = completePoliciesPatch({
            patch: { pets: { admission: 'no' } },
            stored: null
        });

        // Assert
        expect(policies).toStrictEqual({ pets: { admission: 'no' } });
    });
});

describe('buildEntityUpdatePayload', () => {
    const fieldIds = ['name', 'policies.paymentMethods', 'policies.pets.admission'];
    const initialValues = {
        name: 'A',
        policies: { paymentMethods: ['cash'], pets: { admission: 'yes', extraCost: true } },
        'policies.paymentMethods': ['cash'],
        'policies.pets.admission': 'yes'
    };

    it('returns a null payload when nothing changed', () => {
        // Act
        const { payload } = buildEntityUpdatePayload({
            fieldIds,
            values: initialValues,
            initialValues
        });

        // Assert
        expect(payload).toBeNull();
    });

    it('sends the policies group read from the live nested values', () => {
        // Arrange: TanStack Form wrote the nested copy; the flat seed is stale.
        const values = {
            ...initialValues,
            policies: {
                paymentMethods: ['cash', 'transfer'],
                pets: { admission: 'on_request', extraCost: true }
            }
        };

        // Act
        const { payload } = buildEntityUpdatePayload({ fieldIds, values, initialValues });

        // Assert
        expect(payload).toStrictEqual({
            policies: {
                paymentMethods: ['cash', 'transfer'],
                pets: { admission: 'on_request', extraCost: true }
            }
        });
    });

    it('leaves an unchanged group out of the payload', () => {
        // Act
        const { payload } = buildEntityUpdatePayload({
            fieldIds,
            values: { ...initialValues, name: 'B' },
            initialValues
        });

        // Assert
        expect(payload).toStrictEqual({ name: 'B' });
    });
});
