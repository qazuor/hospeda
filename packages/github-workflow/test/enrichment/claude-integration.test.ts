/**
 * Tests for Claude Code integration
 *
 * @module test/enrichment/claude-integration
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Module to test
import {
    type ClaudeCommandInput,
    executeClaudeCommand
} from '../../src/enrichment/claude-integration.js';

// Mock dependencies
vi.mock('../../src/commands/sync-command.js', () => ({
    executeSyncCommand: vi.fn()
}));

vi.mock('../../src/commands/generate-command.js', () => ({
    executeGenerateCommand: vi.fn()
}));

describe('claude-integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('executeClaudeCommand', () => {
        it('should execute sync command', async () => {
            // Arrange
            const input: ClaudeCommandInput = {
                command: 'planning:sync',
                options: {
                    sessionPath: '/project/.claude/sessions/planning/P-001-feature'
                },
                githubConfig: {
                    token: 'test-token',
                    owner: 'test-owner',
                    repo: 'test-repo'
                }
            };

            const { executeSyncCommand } = await import('../../src/commands/sync-command.js');
            vi.mocked(executeSyncCommand).mockResolvedValue({
                success: true,
                message: 'Sync successful'
            });

            // Act
            const result = await executeClaudeCommand(input);

            // Assert
            expect(result.success).toBe(true);
            expect(result.message).toBe('Sync successful');
            expect(executeSyncCommand).toHaveBeenCalledWith(
                expect.objectContaining({
                    sessionPath: '/project/.claude/sessions/planning/P-001-feature',
                    githubConfig: input.githubConfig
                })
            );
        });

        it('should execute generate command', async () => {
            // Arrange
            const input: ClaudeCommandInput = {
                command: 'planning:generate-todos',
                options: {
                    sessionPath: '/project/.claude/sessions/planning/P-001-feature'
                }
            };

            const { executeGenerateCommand } = await import(
                '../../src/commands/generate-command.js'
            );
            vi.mocked(executeGenerateCommand).mockResolvedValue({
                success: true,
                message: 'Generated TODOs'
            });

            // Act
            const result = await executeClaudeCommand(input);

            // Assert
            expect(result.success).toBe(true);
            expect(result.message).toBe('Generated TODOs');
            expect(executeGenerateCommand).toHaveBeenCalledWith(
                expect.objectContaining({
                    sessionPath: '/project/.claude/sessions/planning/P-001-feature'
                })
            );
        });

        it('should pass current path to commands', async () => {
            // Arrange
            const input: ClaudeCommandInput = {
                command: 'planning:sync',
                options: {
                    currentPath: '/project/.claude/sessions/planning/P-001-feature/PDR.md'
                },
                githubConfig: {
                    token: 'test-token',
                    owner: 'test-owner',
                    repo: 'test-repo'
                }
            };

            const { executeSyncCommand } = await import('../../src/commands/sync-command.js');
            vi.mocked(executeSyncCommand).mockResolvedValue({
                success: true,
                message: 'Success'
            });

            // Act
            await executeClaudeCommand(input);

            // Assert
            expect(executeSyncCommand).toHaveBeenCalledWith(
                expect.objectContaining({
                    currentPath: input.options.currentPath
                })
            );
        });

        it('should handle unknown command', async () => {
            // Arrange
            const input: ClaudeCommandInput = {
                command: 'unknown:command' as 'planning:sync',
                options: {}
            };

            // Act
            const result = await executeClaudeCommand(input);

            // Assert
            expect(result.success).toBe(false);
            expect(result.message).toContain('Unknown command');
        });

        it('should handle command errors', async () => {
            // Arrange
            const input: ClaudeCommandInput = {
                command: 'planning:sync',
                options: {
                    sessionPath: '/invalid/path'
                },
                githubConfig: {
                    token: 'test-token',
                    owner: 'test-owner',
                    repo: 'test-repo'
                }
            };

            const { executeSyncCommand } = await import('../../src/commands/sync-command.js');
            vi.mocked(executeSyncCommand).mockRejectedValue(new Error('Command failed'));

            // Act
            const result = await executeClaudeCommand(input);

            // Assert
            expect(result.success).toBe(false);
            expect(result.message).toContain('Command failed');
        });

        it('should pass dry run option to sync', async () => {
            // Arrange
            const input: ClaudeCommandInput = {
                command: 'planning:sync',
                options: {
                    sessionPath: '/project/.claude/sessions/planning/P-001-feature',
                    dryRun: true
                },
                githubConfig: {
                    token: 'test-token',
                    owner: 'test-owner',
                    repo: 'test-repo'
                }
            };

            const { executeSyncCommand } = await import('../../src/commands/sync-command.js');
            vi.mocked(executeSyncCommand).mockResolvedValue({
                success: true,
                message: 'Dry run complete'
            });

            // Act
            await executeClaudeCommand(input);

            // Assert
            expect(executeSyncCommand).toHaveBeenCalledWith(
                expect.objectContaining({
                    dryRun: true
                })
            );
        });

        it('should pass output directory to generate', async () => {
            // Arrange
            const input: ClaudeCommandInput = {
                command: 'planning:generate-todos',
                options: {
                    sessionPath: '/project/.claude/sessions/planning/P-001-feature',
                    outputDir: '.linear-todos'
                }
            };

            const { executeGenerateCommand } = await import(
                '../../src/commands/generate-command.js'
            );
            vi.mocked(executeGenerateCommand).mockResolvedValue({
                success: true,
                message: 'Generated'
            });

            // Act
            await executeClaudeCommand(input);

            // Assert
            expect(executeGenerateCommand).toHaveBeenCalledWith(
                expect.objectContaining({
                    outputDir: '.linear-todos'
                })
            );
        });
    });
});
