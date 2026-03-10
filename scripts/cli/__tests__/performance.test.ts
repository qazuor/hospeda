import { describe, expect, it } from 'vitest';
import { getCuratedCommands } from '../registry.js';
import { createSearchIndex, searchCommands } from '../search.js';

/**
 * Performance budget tests for the CLI tool.
 * These validate that critical operations stay within acceptable bounds
 * for a responsive developer experience.
 */
describe('performance budgets', () => {
    it('should create search index in under 100ms', () => {
        // Arrange
        const commands = getCuratedCommands();

        // Act
        const start = performance.now();
        createSearchIndex({ commands });
        const elapsed = performance.now() - start;

        // Assert
        expect(elapsed).toBeLessThan(100);
    });

    it('should execute a search query in under 50ms', () => {
        // Arrange
        const commands = getCuratedCommands();
        const fuse = createSearchIndex({ commands });

        // Act
        const start = performance.now();
        searchCommands({ fuse, query: 'db:start' });
        const elapsed = performance.now() - start;

        // Assert
        expect(elapsed).toBeLessThan(50);
    });

    it('should load curated commands in under 10ms', () => {
        // Arrange & Act
        const start = performance.now();
        getCuratedCommands();
        const elapsed = performance.now() - start;

        // Assert
        expect(elapsed).toBeLessThan(10);
    });

    it('should handle 10 consecutive searches in under 100ms', () => {
        // Arrange
        const commands = getCuratedCommands();
        const fuse = createSearchIndex({ commands });
        const queries = [
            'db',
            'test',
            'lint',
            'build',
            'seed',
            'dev',
            'format',
            'env',
            'clean',
            'migrate'
        ];

        // Act
        const start = performance.now();
        for (const query of queries) {
            searchCommands({ fuse, query });
        }
        const elapsed = performance.now() - start;

        // Assert
        expect(elapsed).toBeLessThan(100);
    });
});
