import { describe, expect, it } from 'vitest';
import {
    formatBanner,
    formatCommandLine,
    formatHelp,
    formatList,
    formatResult
} from '../format.js';
import { getCuratedCommands } from '../registry.js';
import type { CliCommand } from '../types.js';

/** Strip ANSI escape codes for plain-text assertions */
function stripAnsi(str: string): string {
    // biome-ignore lint/suspicious/noControlCharactersInRegex: intentionally matching ANSI escape sequences
    return str.replace(/\x1b\[[0-9;]*m/g, '');
}

function makeCmd(overrides: Partial<CliCommand> = {}): CliCommand {
    return {
        id: 'test-cmd',
        description: 'A test command for unit tests',
        category: 'testing',
        execution: { type: 'pnpm-root', script: 'test' },
        source: 'root',
        mode: 'one-shot',
        curated: true,
        ...overrides
    };
}

describe('formatBanner', () => {
    it('should include version string v1.0.0', () => {
        // Arrange & Act
        const banner = formatBanner();
        const plain = stripAnsi(banner);

        // Assert
        expect(plain).toContain('v1.0.0');
    });

    it('should include the Hospeda CLI title', () => {
        // Arrange & Act
        const banner = formatBanner();
        const plain = stripAnsi(banner);

        // Assert
        expect(plain).toContain('Hospeda CLI');
    });

    it('should contain box-drawing characters', () => {
        // Arrange & Act
        const banner = formatBanner();

        // Assert
        expect(banner).toContain('╭');
        expect(banner).toContain('╮');
        expect(banner).toContain('╰');
        expect(banner).toContain('╯');
    });
});

describe('formatCommandLine', () => {
    it('should align output by padding the command ID to fixed width', () => {
        // Arrange - both IDs are shorter than ID_PAD (22 chars) so they get padded equally
        const shortCmd = makeCmd({ id: 'test', description: 'Short desc' });
        const medCmd = makeCmd({ id: 'test:coverage', description: 'Medium desc' });

        // Act
        const shortLine = stripAnsi(formatCommandLine({ cmd: shortCmd }));
        const medLine = stripAnsi(formatCommandLine({ cmd: medCmd }));

        // Assert - description starts at the same column (prefix "  " + padded ID = same offset)
        const shortDescStart = shortLine.indexOf(shortCmd.description);
        const medDescStart = medLine.indexOf(medCmd.description);
        expect(shortDescStart).toBe(medDescStart);
    });

    it('should show warning prefix ⚠ for dangerous commands', () => {
        // Arrange
        const dangerCmd = makeCmd({
            id: 'db:reset',
            dangerous: true,
            dangerMessage: 'This will drop everything'
        });

        // Act
        const line = formatCommandLine({ cmd: dangerCmd });

        // Assert
        expect(line).toContain('⚠');
    });

    it('should not show ⚠ prefix for non-dangerous commands', () => {
        // Arrange
        const safeCmd = makeCmd({ id: 'test', dangerous: undefined });

        // Act
        const line = formatCommandLine({ cmd: safeCmd });

        // Assert
        expect(stripAnsi(line)).not.toContain('⚠');
    });

    it('should include the command description', () => {
        // Arrange
        const cmd = makeCmd({ description: 'My special test description' });

        // Act
        const line = stripAnsi(formatCommandLine({ cmd }));

        // Assert
        expect(line).toContain('My special test description');
    });

    it('should include the source in square brackets', () => {
        // Arrange
        const cmd = makeCmd({ source: '@repo/seed' });

        // Act
        const line = stripAnsi(formatCommandLine({ cmd }));

        // Assert
        expect(line).toContain('[@repo/seed]');
    });
});

describe('formatHelp', () => {
    it('should group commands by category with Development: header', () => {
        // Arrange
        const commands = getCuratedCommands();

        // Act
        const help = stripAnsi(formatHelp({ commands }));

        // Assert
        expect(help).toContain('Development:');
    });

    it('should group commands by category with Database: header', () => {
        // Arrange
        const commands = getCuratedCommands();

        // Act
        const help = stripAnsi(formatHelp({ commands }));

        // Assert
        expect(help).toContain('Database:');
    });

    it('should include the version banner', () => {
        // Arrange
        const commands = getCuratedCommands();

        // Act
        const help = stripAnsi(formatHelp({ commands }));

        // Assert
        expect(help).toContain('v1.0.0');
    });

    it('should include usage instructions', () => {
        // Arrange
        const commands = getCuratedCommands();

        // Act
        const help = stripAnsi(formatHelp({ commands }));

        // Assert
        expect(help).toContain('Usage:');
        expect(help).toContain('pnpm cli');
    });

    it('should list flag options', () => {
        // Arrange
        const commands = getCuratedCommands();

        // Act
        const help = stripAnsi(formatHelp({ commands }));

        // Assert
        expect(help).toContain('--help');
        expect(help).toContain('--list');
        expect(help).toContain('--yes');
    });

    it('should skip categories with no commands', () => {
        // Arrange - only provide development commands
        const devCommands = getCuratedCommands().filter((c) => c.category === 'development');

        // Act
        const help = stripAnsi(formatHelp({ commands: devCommands }));

        // Assert
        expect(help).toContain('Development:');
        expect(help).not.toContain('Database:');
    });
});

describe('formatList', () => {
    it('should output one line per command', () => {
        // Arrange
        const commands = getCuratedCommands();

        // Act
        const list = formatList({ commands });
        const lines = list.split('\n').filter((l) => l.trim().length > 0);

        // Assert
        expect(lines).toHaveLength(commands.length);
    });

    it('should include command ID and description in each line', () => {
        // Arrange
        const commands = getCuratedCommands().slice(0, 3);

        // Act
        const list = formatList({ commands });

        // Assert
        for (const cmd of commands) {
            expect(list).toContain(cmd.id);
            expect(list).toContain(cmd.description);
        }
    });

    it('should include source bracket tags when showAll=true', () => {
        // Arrange
        const commands = getCuratedCommands();
        const rootCmd = commands.find((c) => c.source === 'root');
        const filteredCmds = rootCmd ? [rootCmd] : commands.slice(0, 1);

        // Act
        const list = formatList({ commands: filteredCmds, showAll: true });

        // Assert
        expect(list).toContain('[root]');
    });

    it('should not include source bracket tags when showAll=false', () => {
        // Arrange
        const commands = getCuratedCommands().slice(0, 3);

        // Act
        const list = formatList({ commands, showAll: false });

        // Assert
        expect(list).not.toContain('[root]');
    });

    it('should not include source bracket tags by default', () => {
        // Arrange
        const commands = getCuratedCommands().slice(0, 3);

        // Act
        const list = formatList({ commands });

        // Assert
        expect(list).not.toContain('[');
    });

    it('should return empty string for empty commands array', () => {
        // Arrange & Act
        const list = formatList({ commands: [] });

        // Assert
        expect(list).toBe('');
    });
});

describe('formatResult', () => {
    it('should show ✓ checkmark for exit code 0', () => {
        // Arrange & Act
        const result = formatResult({ exitCode: 0, durationMs: 1234 });

        // Assert
        expect(result).toContain('✓');
    });

    it('should show ✗ cross for non-zero exit code', () => {
        // Arrange & Act
        const result = formatResult({ exitCode: 1, durationMs: 500 });

        // Assert
        expect(result).toContain('✗');
    });

    it('should show ✗ for exit code 2', () => {
        // Arrange & Act
        const result = formatResult({ exitCode: 2, durationMs: 100 });

        // Assert
        expect(result).toContain('✗');
    });

    it('should include the exit code in the output', () => {
        // Arrange & Act
        const successResult = stripAnsi(formatResult({ exitCode: 0, durationMs: 100 }));
        const failResult = stripAnsi(formatResult({ exitCode: 42, durationMs: 100 }));

        // Assert
        expect(successResult).toContain('exit code: 0');
        expect(failResult).toContain('exit code: 42');
    });

    it('should format duration in ms when less than 1000ms', () => {
        // Arrange & Act
        const result = stripAnsi(formatResult({ exitCode: 0, durationMs: 456 }));

        // Assert
        expect(result).toContain('456ms');
    });

    it('should format duration in seconds when >= 1000ms', () => {
        // Arrange & Act
        const result = stripAnsi(formatResult({ exitCode: 0, durationMs: 2500 }));

        // Assert
        expect(result).toContain('2.5s');
    });
});
