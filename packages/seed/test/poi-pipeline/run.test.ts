import { describe, expect, it } from 'vitest';
import { DEFAULT_INPUT_PATH, parseArgs } from '../../scripts/poi-pipeline/run.js';

describe('parseArgs', () => {
    it('returns defaults when no flags are passed', () => {
        // Arrange
        const argv: string[] = [];

        // Act
        const result = parseArgs(argv);

        // Assert
        expect(result).toEqual({ dryRun: false, input: DEFAULT_INPUT_PATH });
    });

    it('sets dryRun to true when --dry-run is passed', () => {
        // Arrange
        const argv = ['--dry-run'];

        // Act
        const result = parseArgs(argv);

        // Assert
        expect(result.dryRun).toBe(true);
    });

    it('coerces --limit=20 to the number 20', () => {
        // Arrange
        const argv = ['--limit=20'];

        // Act
        const result = parseArgs(argv);

        // Assert
        expect(result.limit).toBe(20);
    });

    it('throws a clear error when --limit is not a positive integer', () => {
        // Arrange
        const argv = ['--limit=abc'];

        // Act & Assert
        expect(() => parseArgs(argv)).toThrow(/Invalid --limit value 'abc'/);
    });

    it('throws a clear error when --limit is zero or negative', () => {
        // Arrange
        const argv = ['--limit=0'];

        // Act & Assert
        expect(() => parseArgs(argv)).toThrow(/Invalid --limit value '0'/);
    });

    it('overrides the default input path with --input', () => {
        // Arrange
        const argv = ['--input=/x.csv'];

        // Act
        const result = parseArgs(argv);

        // Assert
        expect(result.input).toBe('/x.csv');
    });

    it('parses multiple flags together', () => {
        // Arrange
        const argv = ['--dry-run', '--limit=5', '--input=/tmp/pois.csv'];

        // Act
        const result = parseArgs(argv);

        // Assert
        expect(result).toEqual({ dryRun: true, limit: 5, input: '/tmp/pois.csv' });
    });
});
