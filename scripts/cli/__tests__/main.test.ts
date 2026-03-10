import { describe, expect, it } from 'vitest';
import { main } from '../main.js';

/**
 * Tests for main.ts entry point.
 * These are integration-level tests that verify the main function
 * returns proper exit codes and handles errors gracefully.
 *
 * Note: main() orchestrates all other modules, so these tests
 * run against the real workspace and may be slower than unit tests.
 */
describe('main', () => {
    it('should return 0 for --help flag', async () => {
        // Arrange
        const original = process.argv;
        process.argv = ['node', 'cli.ts', '--help'];

        // Act
        const code = await main();

        // Assert
        expect(code).toBe(0);

        // Cleanup
        process.argv = original;
    });

    it('should return 0 for -h flag', async () => {
        // Arrange
        const original = process.argv;
        process.argv = ['node', 'cli.ts', '-h'];

        // Act
        const code = await main();

        // Assert
        expect(code).toBe(0);

        // Cleanup
        process.argv = original;
    });

    it('should return 0 for --list flag', async () => {
        // Arrange
        const original = process.argv;
        process.argv = ['node', 'cli.ts', '--list'];

        // Act
        const code = await main();

        // Assert
        expect(code).toBe(0);

        // Cleanup
        process.argv = original;
    });

    it('should return 0 for -l flag', async () => {
        // Arrange
        const original = process.argv;
        process.argv = ['node', 'cli.ts', '-l'];

        // Act
        const code = await main();

        // Assert
        expect(code).toBe(0);

        // Cleanup
        process.argv = original;
    });

    it('should return 0 for --list-all flag', async () => {
        // Arrange
        const original = process.argv;
        process.argv = ['node', 'cli.ts', '--list-all'];

        // Act
        const code = await main();

        // Assert
        expect(code).toBe(0);

        // Cleanup
        process.argv = original;
    });

    it('should return 1 for unknown command', async () => {
        // Arrange
        const original = process.argv;
        process.argv = ['node', 'cli.ts', 'nonexistent-command-xyz-abc-123'];

        // Act
        const code = await main();

        // Assert
        expect(code).toBe(1);

        // Cleanup
        process.argv = original;
    });

    it('should return a number type always', async () => {
        // Arrange
        const original = process.argv;
        process.argv = ['node', 'cli.ts', '--help'];

        // Act
        const code = await main();

        // Assert
        expect(typeof code).toBe('number');

        // Cleanup
        process.argv = original;
    });

    it('should handle --all flag (alias for --list-all)', async () => {
        // Arrange
        const original = process.argv;
        process.argv = ['node', 'cli.ts', '--all'];

        // Act
        const code = await main();

        // Assert
        expect(code).toBe(0);

        // Cleanup
        process.argv = original;
    });
});
