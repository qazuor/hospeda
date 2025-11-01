/**
 * Loader-specific tests for edge case coverage
 *
 * @module test/config/loader
 */

import { describe, expect, it } from 'vitest';
import { loadConfigFile, loadConfigFromEnv } from '../../src/config/loader';

describe('Configuration Loader', () => {
    describe('loadConfigFile', () => {
        it('should return null when no config file is found', async () => {
            // Arrange
            const searchFrom = '/tmp/nonexistent-directory-for-testing';

            // Act
            const result = await loadConfigFile(searchFrom);

            // Assert
            expect(result).toBeNull();
        });

        it('should return null when searching from a directory without config', async () => {
            // Arrange - search from a temp directory
            const searchFrom = '/tmp';

            // Act
            const result = await loadConfigFile(searchFrom);

            // Assert
            expect(result).toBeNull();
        });
    });

    describe('loadConfigFromEnv', () => {
        it('should return empty object when no env vars are set', () => {
            // Arrange
            const originalEnv = process.env;
            process.env = {}; // Clear all env vars

            try {
                // Act
                const result = loadConfigFromEnv();

                // Assert
                expect(result).toEqual({});
            } finally {
                // Restore
                process.env = originalEnv;
            }
        });

        it('should return partial config when only GITHUB_TOKEN is set', () => {
            // Arrange
            const originalEnv = process.env;
            process.env = { GITHUB_TOKEN: 'ghp_test' };

            try {
                // Act
                const result = loadConfigFromEnv();

                // Assert
                expect(result.github).toBeDefined();
                expect(result.github?.token).toBe('ghp_test');
                expect(result.github?.owner).toBe('');
                expect(result.github?.repo).toBe('');
            } finally {
                // Restore
                process.env = originalEnv;
            }
        });

        it('should return partial config when only GH_OWNER is set', () => {
            // Arrange
            const originalEnv = process.env;
            process.env = { GH_OWNER: 'test-owner' };

            try {
                // Act
                const result = loadConfigFromEnv();

                // Assert
                expect(result.github).toBeDefined();
                expect(result.github?.token).toBe('');
                expect(result.github?.owner).toBe('test-owner');
                expect(result.github?.repo).toBe('');
            } finally {
                // Restore
                process.env = originalEnv;
            }
        });

        it('should return partial config when only GH_REPO is set', () => {
            // Arrange
            const originalEnv = process.env;
            process.env = { GH_REPO: 'test-repo' };

            try {
                // Act
                const result = loadConfigFromEnv();

                // Assert
                expect(result.github).toBeDefined();
                expect(result.github?.token).toBe('');
                expect(result.github?.owner).toBe('');
                expect(result.github?.repo).toBe('test-repo');
            } finally {
                // Restore
                process.env = originalEnv;
            }
        });
    });
});
