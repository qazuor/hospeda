import { describe, expect, it } from 'vitest';
import {
    createCombinedNormalizer,
    createDateTransformer,
    createExcludingNormalizer,
    createFieldMapper,
    createIncludingNormalizer
} from '../../src/utils/normalizers.js';

describe('createFieldMapper', () => {
    it('maps output fields from input field names', () => {
        // Arrange
        const mapper = createFieldMapper({ outputName: 'inputName', outputAge: 'inputAge' });
        const input = { inputName: 'Alice', inputAge: 30, extra: 'ignored' };

        // Act
        const result = mapper(input);

        // Assert
        expect(result).toEqual({ outputName: 'Alice', outputAge: 30 });
    });

    it('maps to undefined when source field is missing', () => {
        const mapper = createFieldMapper({ name: 'fullName' });
        const input = { otherField: 'value' };

        const result = mapper(input);

        expect(result).toEqual({ name: undefined });
    });

    it('returns empty object for empty field mappings', () => {
        const mapper = createFieldMapper({});
        const result = mapper({ a: 1, b: 2 });

        expect(result).toEqual({});
    });
});

describe('createExcludingNormalizer', () => {
    it('excludes specified fields from output', () => {
        // Arrange
        const normalizer = createExcludingNormalizer(['$schema', 'id', 'slug']);
        const input = { $schema: 'http://...', id: 'abc', slug: 'my-slug', name: 'Alice', age: 30 };

        // Act
        const result = normalizer(input);

        // Assert
        expect(result).toEqual({ name: 'Alice', age: 30 });
        expect(result).not.toHaveProperty('$schema');
        expect(result).not.toHaveProperty('id');
        expect(result).not.toHaveProperty('slug');
    });

    it('returns all fields when exclude list is empty', () => {
        const normalizer = createExcludingNormalizer([]);
        const input = { a: 1, b: 'two' };

        const result = normalizer(input);

        expect(result).toEqual({ a: 1, b: 'two' });
    });

    it('is safe when excluded fields do not exist in input', () => {
        const normalizer = createExcludingNormalizer(['nonExistentField']);
        const input = { name: 'Bob' };

        const result = normalizer(input);

        expect(result).toEqual({ name: 'Bob' });
    });
});

describe('createIncludingNormalizer', () => {
    it('includes only specified fields in output', () => {
        // Arrange
        const normalizer = createIncludingNormalizer(['name', 'email']);
        const input = { name: 'Alice', email: 'alice@example.com', password: 'secret', age: 25 };

        // Act
        const result = normalizer(input);

        // Assert
        expect(result).toEqual({ name: 'Alice', email: 'alice@example.com' });
        expect(result).not.toHaveProperty('password');
        expect(result).not.toHaveProperty('age');
    });

    it('omits fields that are undefined in input', () => {
        const normalizer = createIncludingNormalizer(['name', 'email']);
        const input = { name: 'Bob' };

        const result = normalizer(input);

        expect(result).toEqual({ name: 'Bob' });
        expect(result).not.toHaveProperty('email');
    });

    it('returns empty object when no included fields are present', () => {
        const normalizer = createIncludingNormalizer(['name', 'email']);
        const input = { age: 30 };

        const result = normalizer(input);

        expect(result).toEqual({});
    });
});

describe('createDateTransformer', () => {
    it('transforms date string fields to Date objects', () => {
        // Arrange
        const transformer = createDateTransformer(['birthDate', 'createdAt']);
        const input = {
            name: 'Alice',
            birthDate: '1990-05-15',
            createdAt: '2024-01-01T00:00:00.000Z'
        };

        // Act
        const result = transformer(input);

        // Assert
        expect(result.birthDate).toBeInstanceOf(Date);
        expect(result.createdAt).toBeInstanceOf(Date);
        expect((result.birthDate as Date).getFullYear()).toBe(1990);
    });

    it('leaves non-string date fields unchanged', () => {
        const transformer = createDateTransformer(['birthDate']);
        const existingDate = new Date('1990-01-01');
        const input = { name: 'Bob', birthDate: existingDate };

        const result = transformer(input);

        // Not a string, so it stays as-is
        expect(result.birthDate).toBe(existingDate);
    });

    it('leaves fields unchanged when not in date fields list', () => {
        const transformer = createDateTransformer(['birthDate']);
        const input = { name: 'Charlie', createdAt: '2024-01-01' };

        const result = transformer(input);

        expect(result.createdAt).toBe('2024-01-01');
        expect(result.name).toBe('Charlie');
    });

    it('preserves all other fields in output', () => {
        const transformer = createDateTransformer(['birthDate']);
        const input = { name: 'Alice', email: 'alice@test.com', birthDate: '1990-05-15', age: 34 };

        const result = transformer(input);

        expect(result.name).toBe('Alice');
        expect(result.email).toBe('alice@test.com');
        expect(result.age).toBe(34);
    });
});

describe('createCombinedNormalizer', () => {
    it('applies multiple normalizers in sequence', () => {
        // Arrange: exclude $schema, then transform dates
        const excludeMetadata = createExcludingNormalizer(['$schema', 'id']);
        const transformDates = createDateTransformer(['birthDate']);
        const combined = createCombinedNormalizer(excludeMetadata, transformDates);

        const input = {
            $schema: 'http://...',
            id: 'abc-123',
            name: 'Alice',
            birthDate: '1990-05-15'
        };

        // Act
        const result = combined(input);

        // Assert
        expect(result).not.toHaveProperty('$schema');
        expect(result).not.toHaveProperty('id');
        expect(result.name).toBe('Alice');
        expect(result.birthDate).toBeInstanceOf(Date);
    });

    it('returns original data when no normalizers provided', () => {
        const combined = createCombinedNormalizer();
        const input = { name: 'Alice', age: 30 };

        const result = combined(input);

        expect(result).toEqual(input);
    });

    it('applies normalizers in the correct order', () => {
        // First normalizer adds a field, second normalizer excludes it
        const addField = (data: Record<string, unknown>) => ({ ...data, injected: true });
        const excludeInjected = createExcludingNormalizer(['injected']);
        const combined = createCombinedNormalizer(addField, excludeInjected);

        const input = { name: 'Alice' };
        const result = combined(input);

        expect(result).not.toHaveProperty('injected');
        expect(result.name).toBe('Alice');
    });
});
