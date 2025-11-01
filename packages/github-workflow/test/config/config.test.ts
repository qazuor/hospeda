/**
 * Configuration System Tests
 *
 * Following TDD approach - these tests define the expected behavior
 * before implementation exists.
 *
 * @module test/config
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig, validateConfig } from '../../src/config';
import type { WorkflowConfig } from '../../src/config';

describe('Configuration System', () => {
    // Store original env vars
    const originalEnv = process.env;

    beforeEach(() => {
        // Reset env vars
        vi.resetModules();
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        // Restore env vars
        process.env = originalEnv;
    });

    describe('loadConfig', () => {
        it('should load config from environment variables', async () => {
            // Arrange
            process.env.GITHUB_TOKEN = 'ghp_test_token';
            process.env.GH_OWNER = 'test-owner';
            process.env.GH_REPO = 'test-repo';

            // Act
            const config = await loadConfig();

            // Assert
            expect(config.github.token).toBe('ghp_test_token');
            expect(config.github.owner).toBe('test-owner');
            expect(config.github.repo).toBe('test-repo');
        });

        it('should return default config if no file found and no env vars', async () => {
            // Arrange
            process.env.GITHUB_TOKEN = undefined;
            process.env.GH_OWNER = undefined;
            process.env.GH_REPO = undefined;

            // Act & Assert
            // Should throw because required fields are missing
            await expect(loadConfig()).rejects.toThrow(/validation failed/i);
        });

        it('should merge file config with defaults', async () => {
            // Arrange
            process.env.GITHUB_TOKEN = 'ghp_test';
            process.env.GH_OWNER = 'owner';
            process.env.GH_REPO = 'repo';

            // Act
            const config = await loadConfig();

            // Assert
            // Should have defaults for optional fields
            expect(config.sync?.planning?.enabled).toBe(true);
            expect(config.sync?.todos?.enabled).toBe(true);
            expect(config.labels?.universal).toBe('from:claude-code');
        });
    });

    describe('validateConfig', () => {
        it('should validate valid config', () => {
            // Arrange
            const validConfig = {
                github: {
                    token: 'ghp_test',
                    owner: 'hospeda',
                    repo: 'main'
                }
            };

            // Act
            const result = validateConfig(validConfig);

            // Assert
            expect(result.github.token).toBe('ghp_test');
            expect(result.github.owner).toBe('hospeda');
            expect(result.github.repo).toBe('main');
        });

        it('should throw error on missing github.token', () => {
            // Arrange
            const invalidConfig = {
                github: {
                    owner: 'hospeda',
                    repo: 'main'
                }
            };

            // Act & Assert
            expect(() => validateConfig(invalidConfig as any)).toThrow(/github\.token.*required/i);
        });

        it('should throw error on missing github.owner', () => {
            // Arrange
            const invalidConfig = {
                github: {
                    token: 'ghp_test',
                    repo: 'main'
                }
            };

            // Act & Assert
            expect(() => validateConfig(invalidConfig as any)).toThrow(/github\.owner.*required/i);
        });

        it('should throw error on missing github.repo', () => {
            // Arrange
            const invalidConfig = {
                github: {
                    token: 'ghp_test',
                    owner: 'hospeda'
                }
            };

            // Act & Assert
            expect(() => validateConfig(invalidConfig as any)).toThrow(/github\.repo.*required/i);
        });

        it('should provide clear error messages for validation failures', () => {
            // Arrange
            const invalidConfig = {
                github: {
                    token: '',
                    owner: '',
                    repo: ''
                }
            };

            // Act & Assert
            expect(() => validateConfig(invalidConfig)).toThrow('validation failed');
        });

        it('should accept valid config with all optional fields', () => {
            // Arrange
            const fullConfig = {
                github: {
                    token: 'ghp_test',
                    owner: 'hospeda',
                    repo: 'main',
                    projects: {
                        general: 'Hospeda',
                        api: 'Hospeda API',
                        admin: 'Hospeda Admin',
                        web: 'Hospeda Web'
                    }
                },
                sync: {
                    planning: {
                        enabled: true,
                        autoSync: false,
                        projectTemplate: 'Planning: {featureName}',
                        useTemplates: true
                    },
                    todos: {
                        enabled: true,
                        types: ['TODO', 'HACK', 'DEBUG'],
                        excludePaths: ['node_modules'],
                        useTemplates: true
                    }
                },
                labels: {
                    universal: 'from:claude-code',
                    source: {
                        todo: 'todo',
                        hack: 'hack',
                        debug: 'debug'
                    },
                    autoGenerate: {
                        type: true,
                        app: true,
                        package: true,
                        priority: true,
                        difficulty: true,
                        impact: true
                    }
                }
            };

            // Act
            const result = validateConfig(fullConfig);

            // Assert
            expect(result.github.projects?.general).toBe('Hospeda');
            expect(result.sync?.planning?.enabled).toBe(true);
            expect(result.labels?.universal).toBe('from:claude-code');
        });
    });

    describe('mergeWithDefaults', () => {
        it('should merge partial config with defaults', () => {
            // Arrange
            const partialConfig = {
                github: {
                    token: 'ghp_test',
                    owner: 'test',
                    repo: 'repo'
                }
            };

            // Act
            const result = validateConfig(partialConfig);

            // Assert
            // Should have default values
            expect(result.sync?.planning?.enabled).toBe(true);
            expect(result.sync?.todos?.enabled).toBe(true);
            expect(result.labels?.universal).toBe('from:claude-code');
            expect(result.detection?.autoComplete).toBe(true);
            expect(result.enrichment?.enabled).toBe(true);
        });

        it('should preserve user values over defaults', () => {
            // Arrange
            const customConfig = {
                github: {
                    token: 'ghp_test',
                    owner: 'test',
                    repo: 'repo'
                },
                labels: {
                    universal: 'custom:label'
                }
            };

            // Act
            const result = validateConfig(customConfig);

            // Assert
            expect(result.labels?.universal).toBe('custom:label');
        });

        it('should deep merge nested objects', () => {
            // Arrange
            const customConfig = {
                github: {
                    token: 'ghp_test',
                    owner: 'test',
                    repo: 'repo'
                },
                sync: {
                    planning: {
                        enabled: false // Override default
                        // autoSync should get default value
                    }
                }
            };

            // Act
            const result = validateConfig(customConfig);

            // Assert
            expect(result.sync?.planning?.enabled).toBe(false); // Custom value
            expect(result.sync?.planning?.autoSync).toBe(false); // Default value
            expect(result.sync?.todos?.enabled).toBe(true); // Default value
        });
    });

    describe('environment variables', () => {
        it('should use GITHUB_TOKEN from env', async () => {
            // Arrange
            process.env.GITHUB_TOKEN = 'ghp_from_env';
            process.env.GH_OWNER = 'owner';
            process.env.GH_REPO = 'repo';

            // Act
            const config = await loadConfig();

            // Assert
            expect(config.github.token).toBe('ghp_from_env');
        });

        it('should use GH_OWNER from env', async () => {
            // Arrange
            process.env.GITHUB_TOKEN = 'ghp_test';
            process.env.GH_OWNER = 'env_owner';
            process.env.GH_REPO = 'repo';

            // Act
            const config = await loadConfig();

            // Assert
            expect(config.github.owner).toBe('env_owner');
        });

        it('should use GH_REPO from env', async () => {
            // Arrange
            process.env.GITHUB_TOKEN = 'ghp_test';
            process.env.GH_OWNER = 'owner';
            process.env.GH_REPO = 'env_repo';

            // Act
            const config = await loadConfig();

            // Assert
            expect(config.github.repo).toBe('env_repo');
        });

        it('should handle missing env vars gracefully', async () => {
            // Arrange
            process.env.GITHUB_TOKEN = undefined;
            process.env.GH_OWNER = undefined;
            process.env.GH_REPO = undefined;

            // Act & Assert
            // Should throw validation error since no config is available
            await expect(loadConfig()).rejects.toThrow(/validation failed/i);
        });

        it('should use default empty strings for missing individual env vars', async () => {
            // Arrange
            process.env.GITHUB_TOKEN = 'ghp_test';
            // GH_OWNER and GH_REPO not set

            // Act & Assert
            // Should throw because owner/repo are required
            await expect(loadConfig()).rejects.toThrow(/validation failed/i);
        });
    });

    describe('default values', () => {
        it('should have sensible defaults for all optional fields', () => {
            // Arrange
            const minimalConfig = {
                github: {
                    token: 'ghp_test',
                    owner: 'test',
                    repo: 'repo'
                }
            };

            // Act
            const result = validateConfig(minimalConfig);

            // Assert
            expect(result.sync?.planning?.enabled).toBe(true);
            expect(result.sync?.todos?.enabled).toBe(true);
            expect(result.detection?.autoComplete).toBe(true);
            expect(result.detection?.requireTests).toBe(true);
            expect(result.detection?.requireCoverage).toBe(90);
            expect(result.enrichment?.enabled).toBe(true);
            expect(result.hooks?.preCommit).toBe(true);
            expect(result.hooks?.postCommit).toBe(true);
            expect(result.links?.ide).toBe('vscode');
        });

        it('should enable planning sync by default', () => {
            // Arrange
            const config = {
                github: {
                    token: 'ghp_test',
                    owner: 'test',
                    repo: 'repo'
                }
            };

            // Act
            const result = validateConfig(config);

            // Assert
            expect(result.sync?.planning?.enabled).toBe(true);
        });

        it('should enable todo sync by default', () => {
            // Arrange
            const config = {
                github: {
                    token: 'ghp_test',
                    owner: 'test',
                    repo: 'repo'
                }
            };

            // Act
            const result = validateConfig(config);

            // Assert
            expect(result.sync?.todos?.enabled).toBe(true);
        });

        it('should set universal label to "from:claude-code"', () => {
            // Arrange
            const config = {
                github: {
                    token: 'ghp_test',
                    owner: 'test',
                    repo: 'repo'
                }
            };

            // Act
            const result = validateConfig(config);

            // Assert
            expect(result.labels?.universal).toBe('from:claude-code');
        });

        it('should set default TODO types', () => {
            // Arrange
            const config = {
                github: {
                    token: 'ghp_test',
                    owner: 'test',
                    repo: 'repo'
                }
            };

            // Act
            const result = validateConfig(config);

            // Assert
            expect(result.sync?.todos?.types).toEqual(['TODO', 'HACK', 'DEBUG']);
        });
    });

    describe('type safety', () => {
        it('should enforce type-safe configuration', () => {
            // Arrange
            const config = {
                github: {
                    token: 'ghp_test',
                    owner: 'test',
                    repo: 'repo'
                }
            };

            // Act
            const result = validateConfig(config);

            // Assert
            // Type assertions to ensure TypeScript types are correct
            const typedConfig: WorkflowConfig = result;
            expect(typedConfig.github.token).toBeDefined();
            expect(typedConfig.github.owner).toBeDefined();
            expect(typedConfig.github.repo).toBeDefined();
        });
    });

    describe('edge cases', () => {
        it('should handle array replacement in deep merge', () => {
            // Arrange
            const config = {
                github: {
                    token: 'ghp_test',
                    owner: 'test',
                    repo: 'repo'
                },
                sync: {
                    todos: {
                        types: ['CUSTOM'] // Should replace default array
                    }
                }
            };

            // Act
            const result = validateConfig(config);

            // Assert
            expect(result.sync?.todos?.types).toEqual(['CUSTOM']);
        });

        it('should reject null values for record types', () => {
            // Arrange
            const config = {
                github: {
                    token: 'ghp_test',
                    owner: 'test',
                    repo: 'repo'
                },
                labels: {
                    colors: null // Invalid: should be object or undefined
                }
            };

            // Act & Assert
            expect(() => validateConfig(config as any)).toThrow(/validation failed/i);
        });

        it('should handle deeply nested object merging', () => {
            // Arrange
            const config = {
                github: {
                    token: 'ghp_test',
                    owner: 'test',
                    repo: 'repo'
                },
                labels: {
                    autoGenerate: {
                        type: false // Override default
                        // Other fields should keep default
                    }
                }
            };

            // Act
            const result = validateConfig(config);

            // Assert
            expect(result.labels?.autoGenerate?.type).toBe(false); // Custom
            expect(result.labels?.autoGenerate?.app).toBe(true); // Default
            expect(result.labels?.autoGenerate?.package).toBe(true); // Default
        });

        it('should handle validation errors for invalid types', () => {
            // Arrange
            const config = {
                github: {
                    token: 'ghp_test',
                    owner: 'test',
                    repo: 'repo'
                },
                detection: {
                    requireCoverage: 150 // Invalid: > 100
                }
            };

            // Act & Assert
            expect(() => validateConfig(config)).toThrow(/validation failed/i);
        });

        it('should handle empty string values', () => {
            // Arrange
            const config = {
                github: {
                    token: '',
                    owner: '',
                    repo: ''
                }
            };

            // Act & Assert
            expect(() => validateConfig(config)).toThrow(/validation failed/i);
        });
    });
});
