import { describe, expect, it } from 'vitest';
import { MainSchema, parseMainSchema } from '../main.schema.js';

describe('MainSchema', () => {
    describe('validation', () => {
        it('should accept valid configuration with all fields', () => {
            // Arrange
            const input = {
                API_PORT: 3001,
                API_HOST: 'http://localhost',
                API_URL: 'http://localhost:3001/api/v1',
                API_CORS_ALLOWED_ORIGINS: ['http://localhost:4321']
            };

            // Act
            const result = MainSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.API_PORT).toBe(3001);
                expect(result.data.API_HOST).toBe('http://localhost');
                expect(result.data.API_URL).toBe('http://localhost:3001/api/v1');
                expect(result.data.API_CORS_ALLOWED_ORIGINS).toEqual(['http://localhost:4321']);
            }
        });

        it('should coerce API_PORT from string to number', () => {
            // Arrange
            const input = {
                API_PORT: '8080',
                API_HOST: 'http://localhost',
                API_URL: 'http://localhost:8080/api/v1',
                API_CORS_ALLOWED_ORIGINS: []
            };

            // Act
            const result = MainSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.API_PORT).toBe(8080);
            }
        });

        it('should accept multiple CORS origins', () => {
            // Arrange
            const input = {
                API_PORT: 3001,
                API_HOST: 'http://localhost',
                API_URL: 'http://localhost:3001/api/v1',
                API_CORS_ALLOWED_ORIGINS: [
                    'http://localhost:4321',
                    'http://localhost:3000',
                    'https://hospeda.com'
                ]
            };

            // Act
            const result = MainSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.API_CORS_ALLOWED_ORIGINS).toHaveLength(3);
            }
        });
    });

    describe('validation errors', () => {
        it('should reject missing required fields', () => {
            // Arrange
            const input = {};

            // Act
            const result = MainSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject non-numeric API_PORT', () => {
            // Arrange
            const input = {
                API_PORT: 'not-a-number',
                API_HOST: 'http://localhost',
                API_URL: 'http://localhost/api/v1',
                API_CORS_ALLOWED_ORIGINS: []
            };

            // Act
            const result = MainSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });
});

describe('parseMainSchema', () => {
    it('should construct API_URL from host and port', () => {
        // Arrange
        const env = {
            VITE_API_PORT: 3001,
            VITE_API_HOST: 'http://localhost',
            API_CORS_ALLOWED_ORIGINS: 'http://localhost:4321,http://localhost:3000'
        } as unknown as ConfigMetaEnv;

        // Act
        const result = parseMainSchema(env);

        // Assert
        expect(result.API_URL).toBe('http://localhost:3001/api/v1');
        expect(result.API_PORT).toBe(3001);
        expect(result.API_HOST).toBe('http://localhost');
    });

    it('should split comma-separated CORS origins string', () => {
        // Arrange
        const env = {
            VITE_API_PORT: 3001,
            VITE_API_HOST: 'http://localhost',
            API_CORS_ALLOWED_ORIGINS: 'http://localhost:4321, http://localhost:3000'
        } as unknown as ConfigMetaEnv;

        // Act
        const result = parseMainSchema(env);

        // Assert
        expect(result.API_CORS_ALLOWED_ORIGINS).toEqual([
            'http://localhost:4321',
            'http://localhost:3000'
        ]);
    });

    it('should pass through CORS origins when already an array', () => {
        // Arrange
        const env = {
            VITE_API_PORT: 3001,
            VITE_API_HOST: 'http://localhost',
            API_CORS_ALLOWED_ORIGINS: ['http://localhost:4321']
        } as unknown as ConfigMetaEnv;

        // Act
        const result = parseMainSchema(env);

        // Assert
        expect(result.API_CORS_ALLOWED_ORIGINS).toEqual(['http://localhost:4321']);
    });
});
