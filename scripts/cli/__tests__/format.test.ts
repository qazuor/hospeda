import { describe, expect, it } from 'vitest';
import {
    calculateIdPad,
    formatBanner,
    formatCommandLine,
    formatDangerWarning,
    formatExecutionInfo,
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

/** Base defaults for a safe (non-dangerous) test command */
const CMD_DEFAULTS = {
    id: 'test-cmd',
    description: 'A test command for unit tests',
    category: 'testing' as const,
    execution: { type: 'pnpm-root' as const, script: 'test' },
    source: 'root',
    mode: 'one-shot' as const,
    curated: true
} satisfies CliCommand;

function makeCmd(overrides: Partial<CliCommand> = {}): CliCommand {
    if (overrides.dangerous === true) {
        return {
            ...CMD_DEFAULTS,
            ...overrides,
            dangerous: true,
            dangerMessage:
                (overrides as { dangerMessage?: string }).dangerMessage ??
                'This is a dangerous operation'
        };
    }
    return { ...CMD_DEFAULTS, ...overrides } as CliCommand;
}

describe('formatBanner', () => {
    it('should include version string from package.json', () => {
        // Arrange & Act
        const banner = formatBanner();
        const plain = stripAnsi(banner);

        // Assert - version is read from root package.json (currently 0.0.1)
        expect(plain).toMatch(/v\d+\.\d+\.\d+/);
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
        expect(help).toMatch(/v\d+\.\d+\.\d+/);
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

describe('formatExecutionInfo', () => {
    it('should include the command ID', () => {
        // Arrange
        const cmd = makeCmd({ id: 'db:start' });

        // Act
        const info = stripAnsi(formatExecutionInfo({ cmd }));

        // Assert
        expect(info).toContain('db:start');
    });

    it('should show "Running:" label', () => {
        // Arrange
        const cmd = makeCmd({ id: 'test' });

        // Act
        const info = stripAnsi(formatExecutionInfo({ cmd }));

        // Assert
        expect(info).toContain('Running:');
    });

    it('should show the pnpm command for pnpm-root execution', () => {
        // Arrange
        const cmd = makeCmd({
            id: 'build',
            execution: { type: 'pnpm-root', script: 'build' }
        });

        // Act
        const info = stripAnsi(formatExecutionInfo({ cmd }));

        // Assert
        expect(info).toContain('pnpm run build');
    });

    it('should show the pnpm --filter command for pnpm-filter execution', () => {
        // Arrange
        const cmd = makeCmd({
            id: 'db:seed',
            execution: { type: 'pnpm-filter', filter: '@repo/seed', script: 'seed' }
        });

        // Act
        const info = stripAnsi(formatExecutionInfo({ cmd }));

        // Assert
        expect(info).toContain('pnpm --filter @repo/seed seed');
    });

    it('should show the raw command for shell execution', () => {
        // Arrange
        const cmd = makeCmd({
            id: 'dev:all',
            execution: { type: 'shell', command: './scripts/dev-all.sh' }
        });

        // Act
        const info = stripAnsi(formatExecutionInfo({ cmd }));

        // Assert
        expect(info).toContain('./scripts/dev-all.sh');
    });

    it('should show argHint tip when present', () => {
        // Arrange
        const cmd = makeCmd({
            id: 'test',
            argHint: '--watch, --coverage'
        });

        // Act
        const info = stripAnsi(formatExecutionInfo({ cmd }));

        // Assert
        expect(info).toContain('--watch, --coverage');
        expect(info).toContain('Tip:');
    });

    it('should not show Tip when no argHint', () => {
        // Arrange
        const cmd = makeCmd({ id: 'test' });

        // Act
        const info = stripAnsi(formatExecutionInfo({ cmd }));

        // Assert
        expect(info).not.toContain('Tip:');
    });
});

describe('formatDangerWarning', () => {
    it('should include the command ID', () => {
        // Arrange
        const cmd = makeCmd({
            id: 'db:reset',
            dangerous: true,
            dangerMessage: 'Drops all data'
        });

        // Act
        const warning = stripAnsi(formatDangerWarning({ cmd }));

        // Assert
        expect(warning).toContain('db:reset');
    });

    it('should include the danger message', () => {
        // Arrange
        const cmd = makeCmd({
            id: 'db:reset',
            dangerous: true,
            dangerMessage: 'This will destroy everything'
        });

        // Act
        const warning = stripAnsi(formatDangerWarning({ cmd }));

        // Assert
        expect(warning).toContain('This will destroy everything');
    });

    it('should show fallback message when dangerMessage is missing', () => {
        // Arrange - simulate a discovered command with no dangerMessage
        const cmd = {
            id: 'unknown-danger',
            description: 'Some command',
            category: 'testing' as const,
            execution: { type: 'pnpm-root' as const, script: 'test' },
            source: 'root',
            mode: 'one-shot' as const,
            curated: false
        } as CliCommand;

        // Act
        const warning = stripAnsi(formatDangerWarning({ cmd }));

        // Assert
        expect(warning).toContain('This operation may be irreversible.');
    });

    it('should contain the ⚠ warning symbol', () => {
        // Arrange
        const cmd = makeCmd({
            id: 'db:fresh',
            dangerous: true,
            dangerMessage: 'Resets DB'
        });

        // Act
        const warning = formatDangerWarning({ cmd });

        // Assert
        expect(warning).toContain('⚠');
    });
});

describe('calculateIdPad', () => {
    it('should return MIN_ID_PAD for empty commands', () => {
        // Arrange & Act
        const pad = calculateIdPad({ commands: [] });

        // Assert
        expect(pad).toBe(22);
    });

    it('should return MIN_ID_PAD when all IDs are short', () => {
        // Arrange
        const commands = [makeCmd({ id: 'dev' }), makeCmd({ id: 'test' })];

        // Act
        const pad = calculateIdPad({ commands });

        // Assert
        expect(pad).toBe(22);
    });

    it('should increase padding for long IDs', () => {
        // Arrange
        const commands = [makeCmd({ id: 'a-very-long-command-id-that-exceeds-min-pad' })];

        // Act
        const pad = calculateIdPad({ commands });

        // Assert
        expect(pad).toBeGreaterThan(22);
        expect(pad).toBe('a-very-long-command-id-that-exceeds-min-pad'.length + 2);
    });

    it('should use the longest ID to calculate padding', () => {
        // Arrange
        const commands = [
            makeCmd({ id: 'short' }),
            makeCmd({ id: 'this-is-a-much-longer-id-for-testing' })
        ];

        // Act
        const pad = calculateIdPad({ commands });

        // Assert
        expect(pad).toBe('this-is-a-much-longer-id-for-testing'.length + 2);
    });
});
