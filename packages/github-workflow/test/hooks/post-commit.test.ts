/**
 * Tests for post-commit hook
 *
 * @module test/hooks/post-commit
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runPostCommitHook } from '../../src/hooks/post-commit.js';

// Mock dependencies
vi.mock('@repo/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

vi.mock('../../src/config/index.js', () => ({
    loadConfig: vi.fn()
}));

vi.mock('../../src/sync/completion-detector.js', () => ({
    detectCompletedTasks: vi.fn()
}));

vi.mock('node:fs', () => ({
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn()
}));

// Import mocked modules
import { existsSync, readdirSync, statSync } from 'node:fs';
import { loadConfig } from '../../src/config/index.js';
import { detectCompletedTasks } from '../../src/sync/completion-detector.js';

describe('runPostCommitHook', () => {
    const mockConfig = {
        github: {
            token: 'ghp_test',
            owner: 'test-owner',
            repo: 'test-repo'
        },
        completion: {
            enabled: true
        },
        tracking: {
            path: '.github-workflow/tracking.json'
        }
    };

    const mockCompletionResult = {
        success: true,
        sessionId: 'P-003',
        detected: [
            {
                taskCode: 'T-003-001',
                commitHash: 'abc123',
                commitMessage: 'feat: implement feature T-003-001',
                timestamp: '2025-11-01T10:00:00Z'
            }
        ],
        completed: [
            {
                taskCode: 'T-003-001',
                taskTitle: 'Test task',
                closedAt: '2025-11-01T10:00:00Z'
            }
        ],
        closed: [
            {
                taskCode: 'T-003-001',
                issueNumber: 123,
                issueUrl: 'https://github.com/test/repo/issues/123'
            }
        ],
        failed: [],
        statistics: {
            totalDetected: 1,
            totalCompleted: 1,
            totalClosed: 1,
            totalFailed: 0
        }
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('basic functionality', () => {
        it('should run successfully when completion is enabled', async () => {
            // Arrange
            vi.mocked(loadConfig).mockResolvedValue(mockConfig as any);
            vi.mocked(existsSync).mockReturnValue(true);
            vi.mocked(readdirSync).mockReturnValue(['P-003-feature'] as any);
            vi.mocked(statSync).mockReturnValue({ isDirectory: () => true } as any);
            vi.mocked(detectCompletedTasks).mockResolvedValue(mockCompletionResult);

            // Act
            await runPostCommitHook({
                projectRoot: '/test/project',
                silent: true
            });

            // Assert
            expect(loadConfig).toHaveBeenCalledWith('/test/project');
            expect(detectCompletedTasks).toHaveBeenCalledWith(
                expect.objectContaining({
                    commitLimit: 1,
                    dryRun: false
                })
            );
        });

        it('should skip when completion is disabled', async () => {
            // Arrange
            vi.mocked(loadConfig).mockResolvedValue({
                ...mockConfig,
                completion: { enabled: false }
            } as any);

            // Act
            await runPostCommitHook({
                projectRoot: '/test/project',
                silent: true
            });

            // Assert
            expect(detectCompletedTasks).not.toHaveBeenCalled();
        });

        it('should skip when no planning sessions found', async () => {
            // Arrange
            vi.mocked(loadConfig).mockResolvedValue(mockConfig as any);
            vi.mocked(existsSync).mockReturnValue(false);

            // Act
            await runPostCommitHook({
                projectRoot: '/test/project',
                silent: true
            });

            // Assert
            expect(detectCompletedTasks).not.toHaveBeenCalled();
        });
    });

    describe('options handling', () => {
        it('should use default options when not provided', async () => {
            // Arrange
            vi.mocked(loadConfig).mockResolvedValue(mockConfig as any);
            vi.mocked(existsSync).mockReturnValue(true);
            vi.mocked(readdirSync).mockReturnValue(['P-003-feature'] as any);
            vi.mocked(statSync).mockReturnValue({ isDirectory: () => true } as any);
            vi.mocked(detectCompletedTasks).mockResolvedValue(mockCompletionResult);

            // Act
            await runPostCommitHook();

            // Assert
            expect(detectCompletedTasks).toHaveBeenCalledWith(
                expect.objectContaining({
                    commitLimit: 1,
                    dryRun: false
                })
            );
        });

        it('should respect custom commit limit', async () => {
            // Arrange
            vi.mocked(loadConfig).mockResolvedValue(mockConfig as any);
            vi.mocked(existsSync).mockReturnValue(true);
            vi.mocked(readdirSync).mockReturnValue(['P-003-feature'] as any);
            vi.mocked(statSync).mockReturnValue({ isDirectory: () => true } as any);
            vi.mocked(detectCompletedTasks).mockResolvedValue(mockCompletionResult);

            // Act
            await runPostCommitHook({
                commitLimit: 5,
                silent: true
            });

            // Assert
            expect(detectCompletedTasks).toHaveBeenCalledWith(
                expect.objectContaining({
                    commitLimit: 5
                })
            );
        });

        it('should run in dry-run mode when enabled', async () => {
            // Arrange
            vi.mocked(loadConfig).mockResolvedValue(mockConfig as any);
            vi.mocked(existsSync).mockReturnValue(true);
            vi.mocked(readdirSync).mockReturnValue(['P-003-feature'] as any);
            vi.mocked(statSync).mockReturnValue({ isDirectory: () => true } as any);
            vi.mocked(detectCompletedTasks).mockResolvedValue(mockCompletionResult);

            // Act
            await runPostCommitHook({
                dryRun: true,
                silent: true
            });

            // Assert
            expect(detectCompletedTasks).toHaveBeenCalledWith(
                expect.objectContaining({
                    dryRun: true
                })
            );
        });
    });

    describe('error handling', () => {
        it('should handle config loading error gracefully', async () => {
            // Arrange
            vi.mocked(loadConfig).mockRejectedValue(new Error('Config not found'));

            // Act & Assert
            await expect(
                runPostCommitHook({
                    silent: true
                })
            ).resolves.not.toThrow();
        });

        it('should handle completion detection error gracefully', async () => {
            // Arrange
            vi.mocked(loadConfig).mockResolvedValue(mockConfig as any);
            vi.mocked(existsSync).mockReturnValue(true);
            vi.mocked(readdirSync).mockReturnValue(['P-003-feature'] as any);
            vi.mocked(statSync).mockReturnValue({ isDirectory: () => true } as any);
            vi.mocked(detectCompletedTasks).mockRejectedValue(new Error('Detection failed'));

            // Act & Assert
            await expect(
                runPostCommitHook({
                    silent: true
                })
            ).resolves.not.toThrow();
        });

        it('should continue processing other sessions if one fails', async () => {
            // Arrange
            vi.mocked(loadConfig).mockResolvedValue(mockConfig as any);
            vi.mocked(existsSync).mockReturnValue(true);
            vi.mocked(readdirSync).mockReturnValue(['P-003-feature', 'P-004-another'] as any);
            vi.mocked(statSync).mockReturnValue({ isDirectory: () => true } as any);

            // First session fails, second succeeds
            vi.mocked(detectCompletedTasks)
                .mockRejectedValueOnce(new Error('First failed'))
                .mockResolvedValueOnce(mockCompletionResult);

            // Act
            await runPostCommitHook({
                silent: true
            });

            // Assert
            expect(detectCompletedTasks).toHaveBeenCalledTimes(2);
        });
    });

    describe('multiple sessions', () => {
        it('should process multiple planning sessions', async () => {
            // Arrange
            vi.mocked(loadConfig).mockResolvedValue(mockConfig as any);
            vi.mocked(existsSync).mockReturnValue(true);
            vi.mocked(readdirSync).mockReturnValue([
                'P-003-feature',
                'P-004-another',
                'P-005-third'
            ] as any);
            vi.mocked(statSync).mockReturnValue({ isDirectory: () => true } as any);
            vi.mocked(detectCompletedTasks).mockResolvedValue(mockCompletionResult);

            // Act
            await runPostCommitHook({
                silent: true
            });

            // Assert
            expect(detectCompletedTasks).toHaveBeenCalledTimes(3);
        });

        it('should aggregate statistics from multiple sessions', async () => {
            // Arrange
            vi.mocked(loadConfig).mockResolvedValue(mockConfig as any);
            vi.mocked(existsSync).mockReturnValue(true);
            vi.mocked(readdirSync).mockReturnValue(['P-003-feature', 'P-004-another'] as any);
            vi.mocked(statSync).mockReturnValue({ isDirectory: () => true } as any);
            vi.mocked(detectCompletedTasks).mockResolvedValue(mockCompletionResult);

            // Act
            await runPostCommitHook({
                silent: true
            });

            // Assert
            // Should have called detectCompletedTasks twice
            expect(detectCompletedTasks).toHaveBeenCalledTimes(2);
        });
    });
});
