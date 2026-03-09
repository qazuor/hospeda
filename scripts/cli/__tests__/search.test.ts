import { describe, expect, it } from 'vitest';
import { getCuratedCommands } from '../registry.js';
import { createSearchIndex, searchCommands } from '../search.js';

const commands = getCuratedCommands();
const fuse = createSearchIndex({ commands });

describe('createSearchIndex', () => {
    it('should create a working Fuse instance', () => {
        // Arrange
        const testFuse = createSearchIndex({ commands });

        // Act
        const results = testFuse.search('test');

        // Assert
        expect(results).toBeDefined();
        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBeGreaterThan(0);
    });

    it('should create an index with all provided commands', () => {
        // Arrange
        const subset = commands.slice(0, 5);
        const localFuse = createSearchIndex({ commands: subset });

        // Act
        const results = localFuse.search('dev');

        // Assert - should only find from subset
        expect(results.length).toBeLessThanOrEqual(5);
    });
});

describe('searchCommands', () => {
    it('should return test-related commands first for query "test"', () => {
        // Arrange & Act
        const results = searchCommands({ fuse, query: 'test' });

        // Assert
        expect(results.length).toBeGreaterThan(0);
        const firstResult = results[0];
        expect(firstResult).toBeDefined();
        expect(firstResult?.category).toBe('testing');
    });

    it('should return database commands for query "db"', () => {
        // Arrange & Act
        const results = searchCommands({ fuse, query: 'db' });

        // Assert
        expect(results.length).toBeGreaterThan(0);
        const categories = results.slice(0, 5).map((r) => r.category);
        expect(categories).toContain('database');
    });

    it('should return code-quality commands for query "lint"', () => {
        // Arrange & Act
        const results = searchCommands({ fuse, query: 'lint' });

        // Assert
        expect(results.length).toBeGreaterThan(0);
        const firstResult = results[0];
        expect(firstResult).toBeDefined();
        expect(firstResult?.category).toBe('code-quality');
    });

    it('should return empty array for empty query', () => {
        // Arrange & Act
        const results = searchCommands({ fuse, query: '' });

        // Assert
        expect(results).toEqual([]);
    });

    it('should return empty array for whitespace-only query', () => {
        // Arrange & Act
        const results = searchCommands({ fuse, query: '   ' });

        // Assert
        expect(results).toEqual([]);
    });

    it('should rank exact ID match "db:start" higher than partial matches', () => {
        // Arrange & Act
        const results = searchCommands({ fuse, query: 'db:start' });

        // Assert
        expect(results.length).toBeGreaterThan(0);
        const firstResult = results[0];
        expect(firstResult).toBeDefined();
        expect(firstResult?.id).toBe('db:start');
    });

    it('should return results sorted by relevance (best match first)', () => {
        // Arrange & Act
        const results = searchCommands({ fuse, query: 'build' });

        // Assert
        expect(results.length).toBeGreaterThan(0);
        const topResult = results[0];
        expect(topResult).toBeDefined();
        // The exact 'build' command should appear in top results
        const topIds = results.slice(0, 3).map((r) => r.id);
        expect(topIds).toContain('build');
    });

    it('should return CliCommand objects (not Fuse result wrappers)', () => {
        // Arrange & Act
        const results = searchCommands({ fuse, query: 'test' });

        // Assert
        expect(results.length).toBeGreaterThan(0);
        const first = results[0];
        expect(first).toBeDefined();
        // Should be a plain CliCommand, not a Fuse result with .item/.score
        expect(first).toHaveProperty('id');
        expect(first).toHaveProperty('description');
        expect(first).toHaveProperty('category');
        expect(first).not.toHaveProperty('item');
        expect(first).not.toHaveProperty('score');
    });

    it('should return no results for a completely unrelated query', () => {
        // Arrange & Act
        const results = searchCommands({ fuse, query: 'xyzzy-no-match-ever' });

        // Assert
        expect(results).toEqual([]);
    });
});
