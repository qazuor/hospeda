import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type EnvConfig, loadEnvConfig } from '../../src/config/env-config';

describe('loadEnvConfig', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        // Reset env vars before each test
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        // Restore original env
        process.env = originalEnv;
    });

    describe('when REPLICATE_API_TOKEN is provided', () => {
        it('should load configuration successfully with valid API token', () => {
            // Arrange
            process.env.REPLICATE_API_TOKEN = 'r8_test_token_123456789';

            // Act
            const config = loadEnvConfig();

            // Assert
            expect(config.replicateApiToken).toBe('r8_test_token_123456789');
            expect(config.replicateModel).toBe('black-forest-labs/flux-schnell');
        });

        it('should use custom model when REPLICATE_MODEL is set', () => {
            // Arrange
            process.env.REPLICATE_API_TOKEN = 'r8_test_token_123456789';
            process.env.REPLICATE_MODEL = 'black-forest-labs/flux-dev';

            // Act
            const config = loadEnvConfig();

            // Assert
            expect(config.replicateApiToken).toBe('r8_test_token_123456789');
            expect(config.replicateModel).toBe('black-forest-labs/flux-dev');
        });

        it('should return config object with correct shape', () => {
            // Arrange
            process.env.REPLICATE_API_TOKEN = 'r8_test_token_123456789';

            // Act
            const config = loadEnvConfig();

            // Assert
            expect(config).toHaveProperty('replicateApiToken');
            expect(config).toHaveProperty('replicateModel');
            expect(typeof config.replicateApiToken).toBe('string');
            expect(typeof config.replicateModel).toBe('string');
        });
    });

    describe('when REPLICATE_API_TOKEN is missing', () => {
        it('should throw error with clear message', () => {
            // Arrange
            process.env.REPLICATE_API_TOKEN = undefined;

            // Act & Assert
            expect(() => loadEnvConfig()).toThrow(
                'REPLICATE_API_TOKEN environment variable is required'
            );
        });

        it('should throw error when token is empty string', () => {
            // Arrange
            process.env.REPLICATE_API_TOKEN = '';

            // Act & Assert
            expect(() => loadEnvConfig()).toThrow(
                'REPLICATE_API_TOKEN environment variable is required'
            );
        });

        it('should throw error when token is whitespace only', () => {
            // Arrange
            process.env.REPLICATE_API_TOKEN = '   ';

            // Act & Assert
            expect(() => loadEnvConfig()).toThrow(
                'REPLICATE_API_TOKEN environment variable is required'
            );
        });
    });

    describe('when REPLICATE_MODEL is invalid', () => {
        it('should throw error for empty model string', () => {
            // Arrange
            process.env.REPLICATE_API_TOKEN = 'r8_test_token_123456789';
            process.env.REPLICATE_MODEL = '';

            // Act & Assert
            expect(() => loadEnvConfig()).toThrow('REPLICATE_MODEL must be a non-empty string');
        });

        it('should throw error for whitespace-only model', () => {
            // Arrange
            process.env.REPLICATE_API_TOKEN = 'r8_test_token_123456789';
            process.env.REPLICATE_MODEL = '   ';

            // Act & Assert
            expect(() => loadEnvConfig()).toThrow('REPLICATE_MODEL must be a non-empty string');
        });
    });

    describe('edge cases', () => {
        it('should handle very long API token', () => {
            // Arrange
            const longToken = `r8_${'a'.repeat(200)}`;
            process.env.REPLICATE_API_TOKEN = longToken;

            // Act
            const config = loadEnvConfig();

            // Assert
            expect(config.replicateApiToken).toBe(longToken);
        });

        it('should handle model names with slashes and hyphens', () => {
            // Arrange
            process.env.REPLICATE_API_TOKEN = 'r8_test_token_123456789';
            process.env.REPLICATE_MODEL = 'owner/model-name-v2';

            // Act
            const config = loadEnvConfig();

            // Assert
            expect(config.replicateModel).toBe('owner/model-name-v2');
        });

        it('should trim whitespace from API token', () => {
            // Arrange
            process.env.REPLICATE_API_TOKEN = '  r8_test_token_123456789  ';

            // Act
            const config = loadEnvConfig();

            // Assert
            expect(config.replicateApiToken).toBe('r8_test_token_123456789');
        });

        it('should trim whitespace from model name', () => {
            // Arrange
            process.env.REPLICATE_API_TOKEN = 'r8_test_token_123456789';
            process.env.REPLICATE_MODEL = '  black-forest-labs/flux-dev  ';

            // Act
            const config = loadEnvConfig();

            // Assert
            expect(config.replicateModel).toBe('black-forest-labs/flux-dev');
        });
    });

    describe('type safety', () => {
        it('should return EnvConfig type with all required fields', () => {
            // Arrange
            process.env.REPLICATE_API_TOKEN = 'r8_test_token_123456789';

            // Act
            const config: EnvConfig = loadEnvConfig();

            // Assert - TypeScript compilation ensures type safety
            expect(config.replicateApiToken).toBeDefined();
            expect(config.replicateModel).toBeDefined();
        });
    });
});
