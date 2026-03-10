import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleDirect, parseCliArgs } from '../direct.js';
import { getCuratedCommands } from '../registry.js';
import { createSearchIndex } from '../search.js';

// Mock runner and format modules for handleDirect tests
vi.mock('../runner.js', () => ({
    runCommand: vi.fn().mockResolvedValue(0),
    buildSpawnArgs: vi.fn()
}));

vi.mock('../format.js', () => ({
    formatHelp: vi.fn().mockReturnValue('mock help output'),
    formatList: vi.fn().mockReturnValue('mock list output'),
    formatResult: vi.fn().mockReturnValue('mock result'),
    formatExecutionInfo: vi.fn().mockReturnValue('mock exec info'),
    formatDangerWarning: vi.fn().mockReturnValue('mock danger warning'),
    formatBanner: vi.fn().mockReturnValue('mock banner'),
    formatCommandLine: vi.fn().mockReturnValue('mock command line')
}));

vi.mock('../history.js', () => ({
    recordCommand: vi.fn().mockResolvedValue(undefined),
    readHistory: vi.fn().mockResolvedValue({ version: 1, entries: [] }),
    findMonorepoRoot: vi.fn().mockReturnValue('/tmp'),
    getRecentCommands: vi.fn().mockReturnValue([]),
    HISTORY_FILE: '.cli-history.json',
    MAX_ENTRIES: 20
}));

describe('parseCliArgs', () => {
    it('should extract command ID as first positional argument', () => {
        // Arrange & Act
        const result = parseCliArgs({ argv: ['db:start'] });

        // Assert
        expect(result.commandId).toBe('db:start');
    });

    it('should return undefined commandId when no args provided', () => {
        // Arrange & Act
        const result = parseCliArgs({ argv: [] });

        // Assert
        expect(result.commandId).toBeUndefined();
    });

    it('should extract --help flag', () => {
        // Arrange & Act
        const result = parseCliArgs({ argv: ['--help'] });

        // Assert
        expect(result.help).toBe(true);
    });

    it('should extract -h shorthand for help', () => {
        // Arrange & Act
        const result = parseCliArgs({ argv: ['-h'] });

        // Assert
        expect(result.help).toBe(true);
    });

    it('should extract --list flag', () => {
        // Arrange & Act
        const result = parseCliArgs({ argv: ['--list'] });

        // Assert
        expect(result.list).toBe(true);
    });

    it('should extract -l shorthand for list', () => {
        // Arrange & Act
        const result = parseCliArgs({ argv: ['-l'] });

        // Assert
        expect(result.list).toBe(true);
    });

    it('should extract --list-all flag and set both list and listAll', () => {
        // Arrange & Act
        const result = parseCliArgs({ argv: ['--list-all'] });

        // Assert
        expect(result.listAll).toBe(true);
        expect(result.list).toBe(true);
    });

    it('should extract -la shorthand for list-all', () => {
        // Arrange & Act
        const result = parseCliArgs({ argv: ['-la'] });

        // Assert
        expect(result.listAll).toBe(true);
        expect(result.list).toBe(true);
    });

    it('should extract --yes flag', () => {
        // Arrange & Act
        const result = parseCliArgs({ argv: ['--yes'] });

        // Assert
        expect(result.yes).toBe(true);
    });

    it('should extract -y shorthand for yes', () => {
        // Arrange & Act
        const result = parseCliArgs({ argv: ['-y'] });

        // Assert
        expect(result.yes).toBe(true);
    });

    it('should extract extra args after --', () => {
        // Arrange & Act
        const result = parseCliArgs({ argv: ['test', '--', '--coverage', '--watch'] });

        // Assert
        expect(result.extraArgs).toEqual(['--coverage', '--watch']);
        expect(result.commandId).toBe('test');
    });

    it('should return empty extraArgs when no -- separator', () => {
        // Arrange & Act
        const result = parseCliArgs({ argv: ['build'] });

        // Assert
        expect(result.extraArgs).toEqual([]);
    });

    it('should return all flags as false by default', () => {
        // Arrange & Act
        const result = parseCliArgs({ argv: [] });

        // Assert
        expect(result.help).toBe(false);
        expect(result.list).toBe(false);
        expect(result.listAll).toBe(false);
        expect(result.yes).toBe(false);
    });

    it('should parse combined flags and command ID together', () => {
        // Arrange & Act
        const result = parseCliArgs({ argv: ['-y', 'db:reset', '--', '--force'] });

        // Assert
        expect(result.yes).toBe(true);
        expect(result.commandId).toBe('db:reset');
        expect(result.extraArgs).toEqual(['--force']);
    });

    it('should ignore flags that start with - as commandId candidates', () => {
        // Arrange & Act
        const result = parseCliArgs({ argv: ['--unknown-flag'] });

        // Assert
        expect(result.commandId).toBeUndefined();
    });

    it('should support --all as alias for --list-all', () => {
        // Arrange & Act
        const result = parseCliArgs({ argv: ['--all'] });

        // Assert
        expect(result.listAll).toBe(true);
        expect(result.list).toBe(true);
    });

    it('should handle empty string as first argument', () => {
        // Arrange & Act - empty string is falsy but is a valid positional
        const result = parseCliArgs({ argv: [''] });

        // Assert
        expect(result.commandId).toBe('');
    });
});

describe('handleDirect', () => {
    const allCommands = getCuratedCommands();
    const fuse = createSearchIndex({ commands: allCommands });

    let consoleLogSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
        vi.clearAllMocks();
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
    });

    it('should return 0 and log help when help flag is true', async () => {
        // Arrange
        const args = parseCliArgs({ argv: ['--help'] });

        // Act
        const exitCode = await handleDirect({ args, allCommands, fuse });

        // Assert
        expect(exitCode).toBe(0);
        expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should log curated commands when list flag is true', async () => {
        // Arrange
        const args = parseCliArgs({ argv: ['--list'] });

        // Act
        const exitCode = await handleDirect({ args, allCommands, fuse });

        // Assert
        expect(exitCode).toBe(0);
        expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should log all commands when listAll flag is true', async () => {
        // Arrange
        const args = parseCliArgs({ argv: ['--list-all'] });
        const { formatList } = await import('../format.js');

        // Act
        await handleDirect({ args, allCommands, fuse });

        // Assert
        expect(vi.mocked(formatList)).toHaveBeenCalledWith(
            expect.objectContaining({ showAll: true })
        );
    });

    it('should return 1 and log message when no commandId provided', async () => {
        // Arrange
        const args = parseCliArgs({ argv: [] });

        // Act
        const exitCode = await handleDirect({ args, allCommands, fuse });

        // Assert
        expect(exitCode).toBe(1);
        expect(consoleLogSpy).toHaveBeenCalledWith(
            'No command specified. Use --help for usage info.'
        );
    });

    it('should call runner for an exact-match command ID', async () => {
        // Arrange
        const args = parseCliArgs({ argv: ['test'] });
        const { runCommand } = await import('../runner.js');

        // Act
        const exitCode = await handleDirect({ args, allCommands, fuse });

        // Assert
        expect(vi.mocked(runCommand)).toHaveBeenCalled();
        expect(exitCode).toBe(0);
    });

    it('should call runner with extraArgs when provided', async () => {
        // Arrange
        const args = parseCliArgs({ argv: ['test', '--', '--coverage'] });
        const { runCommand } = await import('../runner.js');

        // Act
        await handleDirect({ args, allCommands, fuse });

        // Assert
        expect(vi.mocked(runCommand)).toHaveBeenCalledWith(
            expect.objectContaining({ extraArgs: ['--coverage'] })
        );
    });

    it('should return 1 for unknown command with no similar matches', async () => {
        // Arrange
        const args = parseCliArgs({ argv: ['xyzzy-no-match-ever-99999'] });

        // Act
        const exitCode = await handleDirect({ args, allCommands, fuse });

        // Assert
        expect(exitCode).toBe(1);
    });
});
