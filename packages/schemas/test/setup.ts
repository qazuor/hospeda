import { faker } from '@faker-js/faker';
import { expect } from 'vitest';

/**
 * Global test setup for schemas package
 */

// Set consistent seed for reproducible tests
faker.seed(12345);

// Global test utilities
declare global {
    namespace Vi {
        interface JestAssertion<T = any> {
            toBeValidZodSchema(): T;
            toFailZodValidation(): T;
        }
    }
}

// Custom matchers for Zod schemas
expect.extend({
    toBeValidZodSchema(received, schema) {
        try {
            schema.parse(received);
            return {
                message: () => 'Expected schema to reject the data, but it was valid',
                pass: true
            };
        } catch (error) {
            return {
                message: () => `Expected schema to accept the data, but got error: ${error}`,
                pass: false
            };
        }
    },

    toFailZodValidation(received, schema) {
        try {
            schema.parse(received);
            return {
                message: () => 'Expected schema to reject the data, but it was valid',
                pass: false
            };
        } catch (error) {
            return {
                message: () => `Expected schema to reject the data and it did: ${error}`,
                pass: true
            };
        }
    }
});
