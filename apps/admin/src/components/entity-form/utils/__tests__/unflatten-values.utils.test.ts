import { describe, expect, it } from 'vitest';
import { prepareFormValues, unflattenValues } from '../unflatten-values.utils';

describe('unflattenValues', () => {
    it('nests dotted keys and keeps plain keys', () => {
        // Act
        const result = unflattenValues({
            'location.country': 'AR',
            'location.state': 'ER',
            name: 'X'
        });

        // Assert
        expect(result).toStrictEqual({ location: { country: 'AR', state: 'ER' }, name: 'X' });
    });

    it('never mutates its input (HOS-2060)', () => {
        // Arrange: the edit form's live values carry both copies of a field.
        const policies = { paymentMethods: ['cash', 'transfer'] };
        const values = { policies, 'policies.paymentMethods': ['cash'] };

        // Act
        unflattenValues(values);

        // Assert
        expect(values.policies).toBe(policies);
        expect(policies).toStrictEqual({ paymentMethods: ['cash', 'transfer'] });
    });

    it('lets the live nested value win over the stale flat seed (HOS-2060)', () => {
        // Arrange
        const values = {
            policies: { paymentMethods: ['cash', 'transfer'], pets: { admission: 'on_request' } },
            'policies.paymentMethods': ['cash'],
            'policies.pets.admission': 'yes'
        };

        // Act
        const result = unflattenValues(values);

        // Assert
        expect(result.policies).toStrictEqual({
            paymentMethods: ['cash', 'transfer'],
            pets: { admission: 'on_request' }
        });
    });

    it('falls back to the flat key when the nested path is undefined', () => {
        // Arrange: a create form keeps flat keys only, next to a partial object.
        const values = { location: { street: 'Mitre' }, 'location.number': '12' };

        // Act
        const result = unflattenValues(values);

        // Assert
        expect(result.location).toStrictEqual({ street: 'Mitre', number: '12' });
        expect(values.location).toStrictEqual({ street: 'Mitre' });
    });
});

describe('prepareFormValues', () => {
    it('seeds a flat key for each dotted field and keeps the entity', () => {
        // Act
        const result = prepareFormValues({ id: '1', policies: { minNights: 2 } }, [
            'policies.minNights',
            'policies.maxNights'
        ]);

        // Assert
        expect(result).toStrictEqual({
            id: '1',
            policies: { minNights: 2 },
            'policies.minNights': 2
        });
    });
});
