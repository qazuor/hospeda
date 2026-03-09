import { describe, expect, it } from 'vitest';
import { DbSchema, parseDBSchema } from '../db.schema.js';

describe('DbSchema', () => {
    describe('validation', () => {
        it('should accept a valid database URL', () => {
            // Arrange
            const input = { HOSPEDA_DATABASE_URL: 'postgresql://user:pass@localhost:5432/hospeda' };

            // Act
            const result = DbSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.HOSPEDA_DATABASE_URL).toBe(
                    'postgresql://user:pass@localhost:5432/hospeda'
                );
            }
        });

        it('should accept any non-empty string as database URL', () => {
            // Arrange
            const input = { HOSPEDA_DATABASE_URL: 'some-connection-string' };

            // Act
            const result = DbSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });
    });

    describe('validation errors', () => {
        it('should reject missing HOSPEDA_DATABASE_URL', () => {
            // Arrange
            const input = {};

            // Act
            const result = DbSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject undefined HOSPEDA_DATABASE_URL', () => {
            // Arrange
            const input = { HOSPEDA_DATABASE_URL: undefined };

            // Act
            const result = DbSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });
});

describe('parseDBSchema', () => {
    it('should parse a valid database URL from env', () => {
        // Arrange
        const env = {
            HOSPEDA_DATABASE_URL: 'postgresql://user:pass@localhost:5432/test'
        } as ConfigMetaEnv;

        // Act
        const result = parseDBSchema(env);

        // Assert
        expect(result.HOSPEDA_DATABASE_URL).toBe('postgresql://user:pass@localhost:5432/test');
    });

    it('should throw for missing database URL', () => {
        // Arrange
        const env = {} as ConfigMetaEnv;

        // Act / Assert
        expect(() => parseDBSchema(env)).toThrow();
    });
});
