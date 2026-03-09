import { describe, expect, it } from 'vitest';
import { buildSpawnArgs } from '../runner.js';
import type { CliCommand } from '../types.js';

/** Minimal stub for a pnpm-root CliCommand */
function makePnpmRootCmd(script: string): CliCommand {
    return {
        id: script,
        description: 'Test command',
        category: 'testing',
        execution: { type: 'pnpm-root', script },
        source: 'root',
        mode: 'one-shot',
        curated: true
    };
}

/** Minimal stub for a pnpm-filter CliCommand */
function makePnpmFilterCmd(filter: string, script: string): CliCommand {
    return {
        id: `${filter}:${script}`,
        description: 'Test command',
        category: 'testing',
        execution: { type: 'pnpm-filter', filter, script },
        source: filter,
        mode: 'one-shot',
        curated: true
    };
}

/** Minimal stub for a shell CliCommand */
function makeShellCmd(command: string): CliCommand {
    return {
        id: 'shell-cmd',
        description: 'Test shell command',
        category: 'infrastructure',
        execution: { type: 'shell', command },
        source: 'root',
        mode: 'one-shot',
        curated: true
    };
}

describe('buildSpawnArgs', () => {
    describe('pnpm-root execution type', () => {
        it('should return pnpm as command with run and script as args', () => {
            // Arrange
            const cmd = makePnpmRootCmd('test');

            // Act
            const result = buildSpawnArgs({ cmd });

            // Assert
            expect(result.command).toBe('pnpm');
            expect(result.args).toEqual(['run', 'test']);
        });

        it('should handle script names with colons', () => {
            // Arrange
            const cmd = makePnpmRootCmd('db:migrate');

            // Act
            const result = buildSpawnArgs({ cmd });

            // Assert
            expect(result.command).toBe('pnpm');
            expect(result.args).toEqual(['run', 'db:migrate']);
        });

        it('should append -- and extraArgs when extraArgs are provided', () => {
            // Arrange
            const cmd = makePnpmRootCmd('test');

            // Act
            const result = buildSpawnArgs({ cmd, extraArgs: ['--coverage', '--watch'] });

            // Assert
            expect(result.command).toBe('pnpm');
            expect(result.args).toEqual(['run', 'test', '--', '--coverage', '--watch']);
        });

        it('should omit -- separator when extraArgs is empty', () => {
            // Arrange
            const cmd = makePnpmRootCmd('build');

            // Act
            const result = buildSpawnArgs({ cmd, extraArgs: [] });

            // Assert
            expect(result.args).toEqual(['run', 'build']);
            expect(result.args).not.toContain('--');
        });

        it('should omit -- separator when extraArgs is undefined', () => {
            // Arrange
            const cmd = makePnpmRootCmd('lint');

            // Act
            const result = buildSpawnArgs({ cmd });

            // Assert
            expect(result.args).toEqual(['run', 'lint']);
            expect(result.args).not.toContain('--');
        });
    });

    describe('pnpm-filter execution type', () => {
        it('should return pnpm with --filter, filter name and script', () => {
            // Arrange
            const cmd = makePnpmFilterCmd('@repo/seed', 'seed');

            // Act
            const result = buildSpawnArgs({ cmd });

            // Assert
            expect(result.command).toBe('pnpm');
            expect(result.args).toEqual(['--filter', '@repo/seed', 'seed']);
        });

        it('should append -- and extraArgs when provided', () => {
            // Arrange
            const cmd = makePnpmFilterCmd('hospeda-api', 'test:e2e');

            // Act
            const result = buildSpawnArgs({ cmd, extraArgs: ['--reporter=verbose'] });

            // Assert
            expect(result.command).toBe('pnpm');
            expect(result.args).toEqual([
                '--filter',
                'hospeda-api',
                'test:e2e',
                '--',
                '--reporter=verbose'
            ]);
        });

        it('should omit -- separator when extraArgs is empty', () => {
            // Arrange
            const cmd = makePnpmFilterCmd('@repo/i18n', 'generate-types');

            // Act
            const result = buildSpawnArgs({ cmd, extraArgs: [] });

            // Assert
            expect(result.args).toEqual(['--filter', '@repo/i18n', 'generate-types']);
            expect(result.args).not.toContain('--');
        });
    });

    describe('shell execution type', () => {
        it('should split command by spaces and use first token as command', () => {
            // Arrange
            const cmd = makeShellCmd('./scripts/dev.sh');

            // Act
            const result = buildSpawnArgs({ cmd });

            // Assert
            expect(result.command).toBe('./scripts/dev.sh');
            expect(result.args).toEqual([]);
        });

        it('should split multi-word command and separate command from args', () => {
            // Arrange
            const cmd = makeShellCmd('node scripts/dev-admin.js');

            // Act
            const result = buildSpawnArgs({ cmd });

            // Assert
            expect(result.command).toBe('node');
            expect(result.args).toEqual(['scripts/dev-admin.js']);
        });

        it('should split multi-part command into command and base args', () => {
            // Arrange
            const cmd = makeShellCmd('tsx scripts/setup-test-db.ts');

            // Act
            const result = buildSpawnArgs({ cmd });

            // Assert
            expect(result.command).toBe('tsx');
            expect(result.args).toEqual(['scripts/setup-test-db.ts']);
        });

        it('should append extraArgs directly without -- separator', () => {
            // Arrange
            const cmd = makeShellCmd('./scripts/dev.sh');

            // Act
            const result = buildSpawnArgs({ cmd, extraArgs: ['--api-only'] });

            // Assert
            expect(result.command).toBe('./scripts/dev.sh');
            expect(result.args).toEqual(['--api-only']);
            expect(result.args).not.toContain('--');
        });

        it('should append multiple extraArgs without -- separator', () => {
            // Arrange
            const cmd = makeShellCmd('./scripts/dev.sh');

            // Act
            const result = buildSpawnArgs({ cmd, extraArgs: ['--no-api', '--no-web'] });

            // Assert
            expect(result.args).toEqual(['--no-api', '--no-web']);
            expect(result.args).not.toContain('--');
        });

        it('should produce empty args when no base args and no extraArgs', () => {
            // Arrange
            const cmd = makeShellCmd('docker-compose');

            // Act
            const result = buildSpawnArgs({ cmd, extraArgs: [] });

            // Assert
            expect(result.command).toBe('docker-compose');
            expect(result.args).toEqual([]);
        });
    });
});
