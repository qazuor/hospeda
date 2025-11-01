/**
 * Tests for completion detection system
 *
 * @module test/sync/completion-detector
 */

import * as childProcess from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHubClient } from '../../src/core/github-client';
import { detectCompletedTasks } from '../../src/sync/completion-detector';

// Mock GitHubClient
vi.mock('../../src/core/github-client');

// Mock child_process for git commands
vi.mock('node:child_process');

describe('completion-detector', () => {
    let tempDir: string;
    let trackingPath: string;
    let sessionPath: string;

    beforeEach(async () => {
        // Create temp directory for tests
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'completion-test-'));
        trackingPath = path.join(tempDir, 'tracking.json');

        // Copy fixtures to temp dir
        sessionPath = path.join(tempDir, 'P-999-test');
        await fs.mkdir(sessionPath, { recursive: true });

        const fixturesPath = path.join(__dirname, 'fixtures', 'mock-planning');
        await fs.copyFile(path.join(fixturesPath, 'PDR.md'), path.join(sessionPath, 'PDR.md'));
        await fs.copyFile(path.join(fixturesPath, 'TODOs.md'), path.join(sessionPath, 'TODOs.md'));

        // Create initial tracking file
        await fs.writeFile(
            trackingPath,
            JSON.stringify(
                {
                    version: '1.0.0',
                    metadata: {
                        lastSync: new Date().toISOString(),
                        totalRecords: 0,
                        byStatus: {
                            pending: 0,
                            synced: 0,
                            updated: 0,
                            failed: 0
                        }
                    },
                    records: []
                },
                null,
                2
            )
        );

        // Reset mocks
        vi.clearAllMocks();

        // Default mock for execSync (no commits)
        vi.mocked(childProcess.execSync).mockReturnValue('');
    });

    afterEach(async () => {
        // Clean up temp directory
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    describe('detectCompletedTasks', () => {
        it('should detect and complete task from commit message', async () => {
            // Arrange
            vi.mocked(childProcess.execSync).mockReturnValue(
                'abc123|2024-01-15T10:00:00Z|feat: implement feature [T-999-001]'
            );

            const mockCloseIssue = vi.fn().mockResolvedValue(undefined);
            const mockUpdateIssue = vi.fn().mockResolvedValue(undefined);
            vi.mocked(GitHubClient).mockImplementation(
                () =>
                    ({
                        closeIssue: mockCloseIssue,
                        updateIssue: mockUpdateIssue
                    }) as unknown as GitHubClient
            );

            // Populate tracking with task
            await fs.writeFile(
                trackingPath,
                JSON.stringify({
                    version: '1.0.0',
                    metadata: {
                        lastSync: new Date().toISOString(),
                        totalRecords: 1,
                        byStatus: { pending: 0, synced: 1, updated: 0, failed: 0 }
                    },
                    records: [
                        {
                            id: 'track-001',
                            type: 'planning-task',
                            source: {
                                sessionId: 'P-999',
                                taskId: 'T-999-001'
                            },
                            status: 'synced',
                            github: {
                                issueNumber: 42,
                                issueUrl: 'https://github.com/test/repo/issues/42',
                                createdAt: '2024-01-01T00:00:00Z',
                                updatedAt: '2024-01-01T00:00:00Z'
                            },
                            syncAttempts: 1,
                            lastSyncedAt: '2024-01-01T00:00:00Z',
                            createdAt: '2024-01-01T00:00:00Z',
                            updatedAt: '2024-01-01T00:00:00Z'
                        }
                    ]
                })
            );

            // Act
            const result = await detectCompletedTasks({
                sessionPath,
                trackingPath,
                githubConfig: {
                    token: 'test-token',
                    owner: 'test-owner',
                    repo: 'test-repo'
                },
                dryRun: false
            });

            // Assert
            expect(result.success).toBe(true);
            expect(result.detected.length).toBe(1);
            expect(result.detected[0]?.taskCode).toBe('T-999-001');
            expect(result.completed.length).toBe(1);
            expect(result.closed.length).toBe(1);
            expect(mockCloseIssue).toHaveBeenCalledWith(42);

            // Verify TODOs.md updated
            const todosContent = await fs.readFile(path.join(sessionPath, 'TODOs.md'), 'utf-8');
            expect(todosContent).toContain('[x]');
        });

        it('should detect multiple task codes in one commit', async () => {
            // Arrange
            vi.mocked(childProcess.execSync).mockReturnValue(
                'abc123|2024-01-15T10:00:00Z|feat: implement features [T-999-001] [T-999-002]'
            );

            const mockCloseIssue = vi.fn().mockResolvedValue(undefined);
            const mockUpdateIssue = vi.fn().mockResolvedValue(undefined);
            vi.mocked(GitHubClient).mockImplementation(
                () =>
                    ({
                        closeIssue: mockCloseIssue,
                        updateIssue: mockUpdateIssue
                    }) as unknown as GitHubClient
            );

            // Populate tracking with 2 tasks
            await fs.writeFile(
                trackingPath,
                JSON.stringify({
                    version: '1.0.0',
                    metadata: {
                        lastSync: new Date().toISOString(),
                        totalRecords: 2,
                        byStatus: { pending: 0, synced: 2, updated: 0, failed: 0 }
                    },
                    records: [
                        {
                            id: 'track-001',
                            type: 'planning-task',
                            source: { sessionId: 'P-999', taskId: 'T-999-001' },
                            status: 'synced',
                            github: {
                                issueNumber: 42,
                                issueUrl: 'https://github.com/test/repo/issues/42',
                                createdAt: '2024-01-01T00:00:00Z',
                                updatedAt: '2024-01-01T00:00:00Z'
                            },
                            syncAttempts: 1,
                            lastSyncedAt: '2024-01-01T00:00:00Z',
                            createdAt: '2024-01-01T00:00:00Z',
                            updatedAt: '2024-01-01T00:00:00Z'
                        },
                        {
                            id: 'track-002',
                            type: 'planning-task',
                            source: { sessionId: 'P-999', taskId: 'T-999-002' },
                            status: 'synced',
                            github: {
                                issueNumber: 43,
                                issueUrl: 'https://github.com/test/repo/issues/43',
                                createdAt: '2024-01-01T00:00:00Z',
                                updatedAt: '2024-01-01T00:00:00Z'
                            },
                            syncAttempts: 1,
                            lastSyncedAt: '2024-01-01T00:00:00Z',
                            createdAt: '2024-01-01T00:00:00Z',
                            updatedAt: '2024-01-01T00:00:00Z'
                        }
                    ]
                })
            );

            // Act
            const result = await detectCompletedTasks({
                sessionPath,
                trackingPath,
                githubConfig: {
                    token: 'test-token',
                    owner: 'test-owner',
                    repo: 'test-repo'
                },
                dryRun: false
            });

            // Assert
            expect(result.detected.length).toBe(2);
            expect(result.completed.length).toBe(2);
            expect(result.closed.length).toBe(2);
            expect(mockCloseIssue).toHaveBeenCalledTimes(2);
        });

        it('should skip already completed tasks', async () => {
            // Arrange
            // Update fixture to have a completed task
            const todosContent = await fs.readFile(path.join(sessionPath, 'TODOs.md'), 'utf-8');
            const updatedContent = todosContent.replace(
                '- [ ] **T-999-001**',
                '- [x] **T-999-001**'
            );
            await fs.writeFile(path.join(sessionPath, 'TODOs.md'), updatedContent);

            vi.mocked(childProcess.execSync).mockReturnValue(
                'abc123|2024-01-15T10:00:00Z|feat: implement [T-999-001]'
            );

            const mockCloseIssue = vi.fn().mockResolvedValue(undefined);
            vi.mocked(GitHubClient).mockImplementation(
                () =>
                    ({
                        closeIssue: mockCloseIssue,
                        updateIssue: vi.fn().mockResolvedValue(undefined)
                    }) as unknown as GitHubClient
            );

            // Act
            const result = await detectCompletedTasks({
                sessionPath,
                trackingPath,
                githubConfig: {
                    token: 'test-token',
                    owner: 'test-owner',
                    repo: 'test-repo'
                },
                dryRun: false
            });

            // Assert
            expect(result.detected.length).toBe(1);
            expect(result.completed.length).toBe(0);
            expect(result.failed.length).toBe(1);
            expect(result.failed[0]?.reason).toContain('already completed');
        });

        it('should skip tasks not in tracking database', async () => {
            // Arrange
            vi.mocked(childProcess.execSync).mockReturnValue(
                'abc123|2024-01-15T10:00:00Z|feat: implement [T-999-001]'
            );

            const mockCloseIssue = vi.fn().mockResolvedValue(undefined);
            vi.mocked(GitHubClient).mockImplementation(
                () =>
                    ({
                        closeIssue: mockCloseIssue,
                        updateIssue: vi.fn().mockResolvedValue(undefined)
                    }) as unknown as GitHubClient
            );

            // Empty tracking - no records

            // Act
            const result = await detectCompletedTasks({
                sessionPath,
                trackingPath,
                githubConfig: {
                    token: 'test-token',
                    owner: 'test-owner',
                    repo: 'test-repo'
                },
                dryRun: false
            });

            // Assert
            expect(result.detected.length).toBe(1);
            expect(result.completed.length).toBe(0);
            expect(result.failed.length).toBe(1);
            expect(result.failed[0]?.reason).toContain('tracking');
        });

        it('should skip tasks not found in TODOs.md', async () => {
            // Arrange
            vi.mocked(childProcess.execSync).mockReturnValue(
                'abc123|2024-01-15T10:00:00Z|feat: implement [T-999-999]'
            );

            const mockCloseIssue = vi.fn().mockResolvedValue(undefined);
            vi.mocked(GitHubClient).mockImplementation(
                () =>
                    ({
                        closeIssue: mockCloseIssue,
                        updateIssue: vi.fn().mockResolvedValue(undefined)
                    }) as unknown as GitHubClient
            );

            // Act
            const result = await detectCompletedTasks({
                sessionPath,
                trackingPath,
                githubConfig: {
                    token: 'test-token',
                    owner: 'test-owner',
                    repo: 'test-repo'
                },
                dryRun: false
            });

            // Assert
            expect(result.detected.length).toBe(1);
            expect(result.failed.length).toBe(1);
            expect(result.failed[0]?.reason).toContain('not found in TODOs.md');
        });

        it('should handle dry run mode', async () => {
            // Arrange
            vi.mocked(childProcess.execSync).mockReturnValue(
                'abc123|2024-01-15T10:00:00Z|feat: implement [T-999-001]'
            );

            const mockCloseIssue = vi.fn().mockResolvedValue(undefined);
            const mockUpdateIssue = vi.fn().mockResolvedValue(undefined);
            vi.mocked(GitHubClient).mockImplementation(
                () =>
                    ({
                        closeIssue: mockCloseIssue,
                        updateIssue: mockUpdateIssue
                    }) as unknown as GitHubClient
            );

            // Populate tracking with task
            await fs.writeFile(
                trackingPath,
                JSON.stringify({
                    version: '1.0.0',
                    metadata: {
                        lastSync: new Date().toISOString(),
                        totalRecords: 1,
                        byStatus: { pending: 0, synced: 1, updated: 0, failed: 0 }
                    },
                    records: [
                        {
                            id: 'track-001',
                            type: 'planning-task',
                            source: { sessionId: 'P-999', taskId: 'T-999-001' },
                            status: 'synced',
                            github: {
                                issueNumber: 42,
                                issueUrl: 'https://github.com/test/repo/issues/42',
                                createdAt: '2024-01-01T00:00:00Z',
                                updatedAt: '2024-01-01T00:00:00Z'
                            },
                            syncAttempts: 1,
                            lastSyncedAt: '2024-01-01T00:00:00Z',
                            createdAt: '2024-01-01T00:00:00Z',
                            updatedAt: '2024-01-01T00:00:00Z'
                        }
                    ]
                })
            );

            // Act
            await detectCompletedTasks({
                sessionPath,
                trackingPath,
                githubConfig: {
                    token: 'test-token',
                    owner: 'test-owner',
                    repo: 'test-repo'
                },
                dryRun: true
            });

            // Assert
            expect(mockCloseIssue).not.toHaveBeenCalled();
            expect(mockUpdateIssue).not.toHaveBeenCalled();
        });

        it('should handle no commits found', async () => {
            // Arrange
            vi.mocked(childProcess.execSync).mockReturnValue('');

            const mockCloseIssue = vi.fn().mockResolvedValue(undefined);
            vi.mocked(GitHubClient).mockImplementation(
                () =>
                    ({
                        closeIssue: mockCloseIssue,
                        updateIssue: vi.fn().mockResolvedValue(undefined)
                    }) as unknown as GitHubClient
            );

            // Act
            const result = await detectCompletedTasks({
                sessionPath,
                trackingPath,
                githubConfig: {
                    token: 'test-token',
                    owner: 'test-owner',
                    repo: 'test-repo'
                },
                dryRun: false
            });

            // Assert
            expect(result.detected.length).toBe(0);
            expect(result.completed.length).toBe(0);
            expect(result.statistics.totalDetected).toBe(0);
        });

        it('should handle GitHub API errors gracefully', async () => {
            // Arrange
            vi.mocked(childProcess.execSync).mockReturnValue(
                'abc123|2024-01-15T10:00:00Z|feat: implement [T-999-001]'
            );

            const mockCloseIssue = vi.fn().mockRejectedValue(new Error('GitHub API error'));
            const mockUpdateIssue = vi.fn().mockRejectedValue(new Error('GitHub API error'));
            vi.mocked(GitHubClient).mockImplementation(
                () =>
                    ({
                        closeIssue: mockCloseIssue,
                        updateIssue: mockUpdateIssue
                    }) as unknown as GitHubClient
            );

            // Populate tracking with task
            await fs.writeFile(
                trackingPath,
                JSON.stringify({
                    version: '1.0.0',
                    metadata: {
                        lastSync: new Date().toISOString(),
                        totalRecords: 1,
                        byStatus: { pending: 0, synced: 1, updated: 0, failed: 0 }
                    },
                    records: [
                        {
                            id: 'track-001',
                            type: 'planning-task',
                            source: { sessionId: 'P-999', taskId: 'T-999-001' },
                            status: 'synced',
                            github: {
                                issueNumber: 42,
                                issueUrl: 'https://github.com/test/repo/issues/42',
                                createdAt: '2024-01-01T00:00:00Z',
                                updatedAt: '2024-01-01T00:00:00Z'
                            },
                            syncAttempts: 1,
                            lastSyncedAt: '2024-01-01T00:00:00Z',
                            createdAt: '2024-01-01T00:00:00Z',
                            updatedAt: '2024-01-01T00:00:00Z'
                        }
                    ]
                })
            );

            // Act
            const result = await detectCompletedTasks({
                sessionPath,
                trackingPath,
                githubConfig: {
                    token: 'test-token',
                    owner: 'test-owner',
                    repo: 'test-repo'
                },
                dryRun: false
            });

            // Assert
            expect(result.failed.length).toBeGreaterThan(0);
            expect(result.failed[0]?.error).toContain('GitHub API error');
        });

        it('should deduplicate same task code in multiple commits', async () => {
            // Arrange
            vi.mocked(childProcess.execSync).mockReturnValue(
                'abc123|2024-01-15T10:00:00Z|feat: start [T-999-001]\ndef456|2024-01-15T11:00:00Z|feat: finish [T-999-001]'
            );

            const mockCloseIssue = vi.fn().mockResolvedValue(undefined);
            const mockUpdateIssue = vi.fn().mockResolvedValue(undefined);
            vi.mocked(GitHubClient).mockImplementation(
                () =>
                    ({
                        closeIssue: mockCloseIssue,
                        updateIssue: mockUpdateIssue
                    }) as unknown as GitHubClient
            );

            // Populate tracking with task
            await fs.writeFile(
                trackingPath,
                JSON.stringify({
                    version: '1.0.0',
                    metadata: {
                        lastSync: new Date().toISOString(),
                        totalRecords: 1,
                        byStatus: { pending: 0, synced: 1, updated: 0, failed: 0 }
                    },
                    records: [
                        {
                            id: 'track-001',
                            type: 'planning-task',
                            source: { sessionId: 'P-999', taskId: 'T-999-001' },
                            status: 'synced',
                            github: {
                                issueNumber: 42,
                                issueUrl: 'https://github.com/test/repo/issues/42',
                                createdAt: '2024-01-01T00:00:00Z',
                                updatedAt: '2024-01-01T00:00:00Z'
                            },
                            syncAttempts: 1,
                            lastSyncedAt: '2024-01-01T00:00:00Z',
                            createdAt: '2024-01-01T00:00:00Z',
                            updatedAt: '2024-01-01T00:00:00Z'
                        }
                    ]
                })
            );

            // Act
            const result = await detectCompletedTasks({
                sessionPath,
                trackingPath,
                githubConfig: {
                    token: 'test-token',
                    owner: 'test-owner',
                    repo: 'test-repo'
                },
                dryRun: false
            });

            // Assert
            expect(result.detected.length).toBe(2); // Detected in 2 commits
            expect(mockCloseIssue).toHaveBeenCalledTimes(1); // Only closed once
        });

        it('should provide accurate statistics', async () => {
            // Arrange
            vi.mocked(childProcess.execSync).mockReturnValue(
                'abc123|2024-01-15T10:00:00Z|feat: tasks [T-999-001] [T-999-002]\ndef456|2024-01-15T11:00:00Z|fix: bug [T-999-999]'
            );

            const mockCloseIssue = vi.fn().mockResolvedValue(undefined);
            const mockUpdateIssue = vi.fn().mockResolvedValue(undefined);
            vi.mocked(GitHubClient).mockImplementation(
                () =>
                    ({
                        closeIssue: mockCloseIssue,
                        updateIssue: mockUpdateIssue
                    }) as unknown as GitHubClient
            );

            // Populate tracking with 2 tasks (T-999-999 will fail)
            await fs.writeFile(
                trackingPath,
                JSON.stringify({
                    version: '1.0.0',
                    metadata: {
                        lastSync: new Date().toISOString(),
                        totalRecords: 2,
                        byStatus: { pending: 0, synced: 2, updated: 0, failed: 0 }
                    },
                    records: [
                        {
                            id: 'track-001',
                            type: 'planning-task',
                            source: { sessionId: 'P-999', taskId: 'T-999-001' },
                            status: 'synced',
                            github: {
                                issueNumber: 42,
                                issueUrl: 'https://github.com/test/repo/issues/42',
                                createdAt: '2024-01-01T00:00:00Z',
                                updatedAt: '2024-01-01T00:00:00Z'
                            },
                            syncAttempts: 1,
                            lastSyncedAt: '2024-01-01T00:00:00Z',
                            createdAt: '2024-01-01T00:00:00Z',
                            updatedAt: '2024-01-01T00:00:00Z'
                        },
                        {
                            id: 'track-002',
                            type: 'planning-task',
                            source: { sessionId: 'P-999', taskId: 'T-999-002' },
                            status: 'synced',
                            github: {
                                issueNumber: 43,
                                issueUrl: 'https://github.com/test/repo/issues/43',
                                createdAt: '2024-01-01T00:00:00Z',
                                updatedAt: '2024-01-01T00:00:00Z'
                            },
                            syncAttempts: 1,
                            lastSyncedAt: '2024-01-01T00:00:00Z',
                            createdAt: '2024-01-01T00:00:00Z',
                            updatedAt: '2024-01-01T00:00:00Z'
                        }
                    ]
                })
            );

            // Act
            const result = await detectCompletedTasks({
                sessionPath,
                trackingPath,
                githubConfig: {
                    token: 'test-token',
                    owner: 'test-owner',
                    repo: 'test-repo'
                },
                dryRun: false
            });

            // Assert
            expect(result.statistics.totalDetected).toBe(3); // T-999-001, T-999-002, T-999-999
            expect(result.statistics.totalCompleted).toBe(2); // Only 001 and 002 found in TODOs
            expect(result.statistics.totalClosed).toBe(2);
            expect(result.statistics.totalFailed).toBe(1); // T-999-999 not found
        });
    });
});
