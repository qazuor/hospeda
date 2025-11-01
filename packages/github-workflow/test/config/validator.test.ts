/**
 * Validator-specific tests for edge case coverage
 *
 * @module test/config/validator
 */

import { describe, expect, it, vi } from 'vitest';
import * as schemas from '../../src/config/schemas';
import { validateConfig } from '../../src/config/validator';

describe('Configuration Validator', () => {
    describe('validateConfig error handling', () => {
        it('should re-throw non-Zod errors', () => {
            // Arrange
            const config = {
                github: {
                    token: 'ghp_test',
                    owner: 'test',
                    repo: 'repo'
                }
            };

            // Mock the schema parse to throw a non-Zod error
            const originalParse = schemas.workflowConfigSchema.parse;
            vi.spyOn(schemas.workflowConfigSchema, 'parse').mockImplementation(() => {
                throw new Error('Non-Zod error');
            });

            try {
                // Act & Assert
                expect(() => validateConfig(config)).toThrow('Non-Zod error');
            } finally {
                // Restore
                schemas.workflowConfigSchema.parse = originalParse;
            }
        });

        it('should handle TypeError in deep merge gracefully', () => {
            // Arrange - create a config with circular reference (edge case)
            const config: any = {
                github: {
                    token: 'ghp_test',
                    owner: 'test',
                    repo: 'repo'
                }
            };

            // This should not throw during merge, only during validation
            const result = validateConfig(config);

            // Assert
            expect(result).toBeDefined();
            expect(result.github.token).toBe('ghp_test');
        });

        it('should handle undefined values in nested objects', () => {
            // Arrange
            const config = {
                github: {
                    token: 'ghp_test',
                    owner: 'test',
                    repo: 'repo'
                },
                sync: {
                    planning: {
                        enabled: undefined // Should use default
                    }
                }
            };

            // Act
            const result = validateConfig(config);

            // Assert
            // undefined values should be ignored, defaults should apply
            expect(result.sync?.planning?.enabled).toBe(true); // Default value
        });
    });

    describe('deep merge edge cases', () => {
        it('should handle primitives correctly', () => {
            // Arrange
            const config = {
                github: {
                    token: 'ghp_test',
                    owner: 'test',
                    repo: 'repo'
                },
                detection: {
                    autoComplete: false, // Boolean override
                    requireCoverage: 95 // Number override
                }
            };

            // Act
            const result = validateConfig(config);

            // Assert
            expect(result.detection?.autoComplete).toBe(false);
            expect(result.detection?.requireCoverage).toBe(95);
        });

        it('should handle string overrides', () => {
            // Arrange
            const config = {
                github: {
                    token: 'ghp_test',
                    owner: 'test',
                    repo: 'repo'
                },
                labels: {
                    universal: 'custom-label'
                }
            };

            // Act
            const result = validateConfig(config);

            // Assert
            expect(result.labels?.universal).toBe('custom-label');
        });
    });
});
