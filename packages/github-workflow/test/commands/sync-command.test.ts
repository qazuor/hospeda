/**
 * Tests for /planning:sync command
 *
 * @module test/commands/sync-command
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Module to test
import { type SyncCommandOptions, executeSyncCommand } from '../../src/commands/sync-command.js';

// Mock dependencies
vi.mock('../../src/sync/planning-sync.js', () => ({
    syncPlanningToGitHub: vi.fn()
}));

vi.mock('../../src/enrichment/session-context.js', () => ({
    detectSessionFromPath: vi.fn(),
    loadSessionContext: vi.fn()
}));

describe('sync-command', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('executeSyncCommand', () => {
        it('should execute sync with explicit session path', async () => {
            // Arrange
            const options: SyncCommandOptions = {
                sessionPath: '/project/.claude/sessions/planning/P-001-feature',
                githubConfig: {
                    token: 'test-token',
                    owner: 'test-owner',
                    repo: 'test-repo'
                },
                dryRun: false
            };

            const { syncPlanningToGitHub } = await import('../../src/sync/planning-sync.js');
            vi.mocked(syncPlanningToGitHub).mockResolvedValue({
                success: true,
                sessionId: 'P-001',
                created: [],
                updated: [],
                skipped: [],
                failed: [],
                statistics: {
                    totalTasks: 0,
                    created: 0,
                    updated: 0,
                    skipped: 0,
                    failed: 0
                }
            });

            // Act
            const result = await executeSyncCommand(options);

            // Assert
            expect(result.success).toBe(true);
            expect(result.message).toContain('Successfully synced');
            expect(syncPlanningToGitHub).toHaveBeenCalledWith(
                expect.objectContaining({
                    sessionPath: options.sessionPath,
                    githubConfig: options.githubConfig,
                    dryRun: false
                })
            );
        });

        it('should auto-detect session from current directory', async () => {
            // Arrange
            const options: SyncCommandOptions = {
                currentPath: '/project/.claude/sessions/planning/P-001-feature/PDR.md',
                githubConfig: {
                    token: 'test-token',
                    owner: 'test-owner',
                    repo: 'test-repo'
                }
            };

            const { detectSessionFromPath } = await import(
                '../../src/enrichment/session-context.js'
            );
            vi.mocked(detectSessionFromPath).mockReturnValue({
                detected: true,
                sessionPath: '/project/.claude/sessions/planning/P-001-feature',
                sessionId: 'P-001'
            });

            const { syncPlanningToGitHub } = await import('../../src/sync/planning-sync.js');
            vi.mocked(syncPlanningToGitHub).mockResolvedValue({
                success: true,
                sessionId: 'P-001',
                created: [],
                updated: [],
                skipped: [],
                failed: [],
                statistics: {
                    totalTasks: 0,
                    created: 0,
                    updated: 0,
                    skipped: 0,
                    failed: 0
                }
            });

            // Act
            const result = await executeSyncCommand(options);

            // Assert
            expect(result.success).toBe(true);
            expect(detectSessionFromPath).toHaveBeenCalledWith({
                filePath: options.currentPath
            });
        });

        it('should fail if no session path provided or detected', async () => {
            // Arrange
            const options: SyncCommandOptions = {
                githubConfig: {
                    token: 'test-token',
                    owner: 'test-owner',
                    repo: 'test-repo'
                }
            };

            // Act
            const result = await executeSyncCommand(options);

            // Assert
            expect(result.success).toBe(false);
            expect(result.message).toContain('No session path');
        });

        it('should fail if session detection fails', async () => {
            // Arrange
            const options: SyncCommandOptions = {
                currentPath: '/project/src/index.ts',
                githubConfig: {
                    token: 'test-token',
                    owner: 'test-owner',
                    repo: 'test-repo'
                }
            };

            const { detectSessionFromPath } = await import(
                '../../src/enrichment/session-context.js'
            );
            vi.mocked(detectSessionFromPath).mockReturnValue({
                detected: false
            });

            // Act
            const result = await executeSyncCommand(options);

            // Assert
            expect(result.success).toBe(false);
            expect(result.message).toContain('Could not detect session');
        });

        it('should handle dry run mode', async () => {
            // Arrange
            const options: SyncCommandOptions = {
                sessionPath: '/project/.claude/sessions/planning/P-001-feature',
                githubConfig: {
                    token: 'test-token',
                    owner: 'test-owner',
                    repo: 'test-repo'
                },
                dryRun: true
            };

            const { syncPlanningToGitHub } = await import('../../src/sync/planning-sync.js');
            vi.mocked(syncPlanningToGitHub).mockResolvedValue({
                success: true,
                sessionId: 'P-001',
                created: [
                    {
                        taskId: 'task-1',
                        taskCode: 'T-001-001',
                        issueNumber: 0,
                        issueUrl: 'dry-run'
                    }
                ],
                updated: [],
                skipped: [],
                failed: [],
                statistics: {
                    totalTasks: 1,
                    created: 1,
                    updated: 0,
                    skipped: 0,
                    failed: 0
                }
            });

            // Act
            const result = await executeSyncCommand(options);

            // Assert
            expect(result.success).toBe(true);
            expect(result.message).toContain('DRY RUN');
            expect(syncPlanningToGitHub).toHaveBeenCalledWith(
                expect.objectContaining({
                    dryRun: true
                })
            );
        });

        it('should format success message with statistics', async () => {
            // Arrange
            const options: SyncCommandOptions = {
                sessionPath: '/project/.claude/sessions/planning/P-001-feature',
                githubConfig: {
                    token: 'test-token',
                    owner: 'test-owner',
                    repo: 'test-repo'
                }
            };

            const { syncPlanningToGitHub } = await import('../../src/sync/planning-sync.js');
            vi.mocked(syncPlanningToGitHub).mockResolvedValue({
                success: true,
                sessionId: 'P-001',
                created: [
                    {
                        taskId: 'task-1',
                        taskCode: 'T-001-001',
                        issueNumber: 42,
                        issueUrl: 'https://github.com/test/repo/issues/42'
                    }
                ],
                updated: [],
                skipped: [],
                failed: [],
                statistics: {
                    totalTasks: 1,
                    created: 1,
                    updated: 0,
                    skipped: 0,
                    failed: 0
                }
            });

            // Act
            const result = await executeSyncCommand(options);

            // Assert
            expect(result.success).toBe(true);
            expect(result.message).toContain('P-001');
            expect(result.details).toBeDefined();
            expect(result.details).toMatchObject({
                sessionId: 'P-001',
                statistics: expect.objectContaining({
                    created: 1
                })
            });
        });

        it('should handle sync failure', async () => {
            // Arrange
            const options: SyncCommandOptions = {
                sessionPath: '/project/.claude/sessions/planning/P-001-feature',
                githubConfig: {
                    token: 'test-token',
                    owner: 'test-owner',
                    repo: 'test-repo'
                }
            };

            const { syncPlanningToGitHub } = await import('../../src/sync/planning-sync.js');
            vi.mocked(syncPlanningToGitHub).mockRejectedValue(new Error('GitHub API error'));

            // Act
            const result = await executeSyncCommand(options);

            // Assert
            expect(result.success).toBe(false);
            expect(result.message).toContain('Sync failed');
            expect(result.message).toContain('GitHub API error');
        });

        it('should handle partial sync success with failures', async () => {
            // Arrange
            const options: SyncCommandOptions = {
                sessionPath: '/project/.claude/sessions/planning/P-001-feature',
                githubConfig: {
                    token: 'test-token',
                    owner: 'test-owner',
                    repo: 'test-repo'
                }
            };

            const { syncPlanningToGitHub } = await import('../../src/sync/planning-sync.js');
            vi.mocked(syncPlanningToGitHub).mockResolvedValue({
                success: false, // Sync completed but has failures
                sessionId: 'P-001',
                created: [
                    {
                        taskId: 'task-1',
                        taskCode: 'T-001-001',
                        issueNumber: 42,
                        issueUrl: 'https://github.com/test/repo/issues/42'
                    }
                ],
                updated: [],
                skipped: [],
                failed: [
                    {
                        taskId: 'task-2',
                        error: 'GitHub API error'
                    }
                ],
                statistics: {
                    totalTasks: 2,
                    created: 1,
                    updated: 0,
                    skipped: 0,
                    failed: 1
                }
            });

            // Act
            const result = await executeSyncCommand(options);

            // Assert
            expect(result.success).toBe(false);
            expect(result.message).toContain('1 failures');
            expect(result.details).toMatchObject({
                sessionId: 'P-001',
                statistics: expect.objectContaining({
                    failed: 1
                }),
                failed: expect.arrayContaining([
                    expect.objectContaining({
                        taskId: 'task-2'
                    })
                ])
            });
        });
    });
});
