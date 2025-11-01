/**
 * Tests for planning sync orchestrator
 *
 * @module test/sync/planning-sync
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHubClient } from '../../src/core/github-client';
import { syncPlanningToGitHub } from '../../src/sync/planning-sync';

// Mock GitHubClient
vi.mock('../../src/core/github-client');

describe('planning-sync', () => {
    let tempDir: string;
    let trackingPath: string;
    let sessionPath: string;

    beforeEach(async () => {
        // Create temp directory for tests
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'planning-sync-test-'));
        trackingPath = path.join(tempDir, 'tracking.json');

        // Copy fixtures to temp dir
        sessionPath = path.join(tempDir, 'P-999-test');
        await fs.mkdir(sessionPath, { recursive: true });

        const fixturesPath = path.join(__dirname, 'fixtures', 'mock-planning');
        await fs.copyFile(path.join(fixturesPath, 'PDR.md'), path.join(sessionPath, 'PDR.md'));
        await fs.copyFile(path.join(fixturesPath, 'TODOs.md'), path.join(sessionPath, 'TODOs.md'));

        // Reset mocks
        vi.clearAllMocks();
    });

    afterEach(async () => {
        // Clean up temp directory
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    describe('syncPlanningToGitHub', () => {
        it('should successfully sync new planning session', async () => {
            // Arrange
            const mockCreateIssue = vi.fn().mockImplementation(async () => {
                return mockCreateIssue.mock.calls.length; // Return sequential issue numbers
            });

            const mockAddLabels = vi.fn().mockResolvedValue(undefined);
            const mockLinkIssues = vi.fn().mockResolvedValue(undefined);

            vi.mocked(GitHubClient).mockImplementation(
                () =>
                    ({
                        createIssue: mockCreateIssue,
                        addLabels: mockAddLabels,
                        linkIssues: mockLinkIssues
                    }) as unknown as GitHubClient
            );

            // Act
            const result = await syncPlanningToGitHub({
                sessionPath,
                githubConfig: {
                    token: 'test-token',
                    owner: 'test-owner',
                    repo: 'test-repo'
                },
                trackingPath,
                dryRun: false,
                updateExisting: false
            });

            // Assert
            expect(result.success).toBe(true);
            expect(result.sessionId).toBe('P-999');
            expect(result.statistics.totalTasks).toBe(4); // 3 parent + 1 subtask
            expect(result.statistics.created).toBeGreaterThan(0);
            expect(result.statistics.failed).toBe(0);
            expect(result.created.length).toBeGreaterThan(0);

            // Verify GitHub client was called
            expect(mockCreateIssue).toHaveBeenCalled();
        });

        it('should handle dry run mode without creating issues', async () => {
            // Arrange
            const mockCreateIssue = vi.fn();

            vi.mocked(GitHubClient).mockImplementation(
                () =>
                    ({
                        createIssue: mockCreateIssue
                    }) as unknown as GitHubClient
            );

            // Act
            const result = await syncPlanningToGitHub({
                sessionPath,
                githubConfig: {
                    token: 'test-token',
                    owner: 'test-owner',
                    repo: 'test-repo'
                },
                trackingPath,
                dryRun: true
            });

            // Assert
            expect(result.success).toBe(true);
            expect(mockCreateIssue).not.toHaveBeenCalled();
            expect(result.statistics.totalTasks).toBeGreaterThan(0);
        });

        it('should skip already synced tasks when updateExisting is false', async () => {
            // Arrange
            const mockCreateIssue = vi.fn().mockResolvedValue(1);
            const mockAddLabels = vi.fn().mockResolvedValue(undefined);
            const mockLinkIssues = vi.fn().mockResolvedValue(undefined);

            vi.mocked(GitHubClient).mockImplementation(
                () =>
                    ({
                        createIssue: mockCreateIssue,
                        addLabels: mockAddLabels,
                        linkIssues: mockLinkIssues
                    }) as unknown as GitHubClient
            );

            // First sync
            await syncPlanningToGitHub({
                sessionPath,
                githubConfig: {
                    token: 'test-token',
                    owner: 'test-owner',
                    repo: 'test-repo'
                },
                trackingPath,
                dryRun: false,
                updateExisting: false
            });

            // Reset mock calls
            mockCreateIssue.mockClear();

            // Act - Second sync with same data
            const result = await syncPlanningToGitHub({
                sessionPath,
                githubConfig: {
                    token: 'test-token',
                    owner: 'test-owner',
                    repo: 'test-repo'
                },
                trackingPath,
                dryRun: false,
                updateExisting: false
            });

            // Assert
            expect(result.success).toBe(true);
            expect(result.statistics.skipped).toBeGreaterThan(0);
            expect(mockCreateIssue).not.toHaveBeenCalled(); // No new issues created
        });

        it('should handle GitHub API errors gracefully', async () => {
            // Arrange
            const mockCreateIssue = vi.fn().mockRejectedValue(new Error('GitHub API error'));

            vi.mocked(GitHubClient).mockImplementation(
                () =>
                    ({
                        createIssue: mockCreateIssue
                    }) as unknown as GitHubClient
            );

            // Act
            const result = await syncPlanningToGitHub({
                sessionPath,
                githubConfig: {
                    token: 'test-token',
                    owner: 'test-owner',
                    repo: 'test-repo'
                },
                trackingPath,
                dryRun: false
            });

            // Assert
            expect(result.success).toBe(false);
            expect(result.statistics.failed).toBeGreaterThan(0);
            expect(result.failed.length).toBeGreaterThan(0);
            expect(result.failed[0]?.error).toContain('GitHub API error');
        });

        it('should throw error for non-existent planning session', async () => {
            // Arrange
            const invalidPath = path.join(tempDir, 'non-existent');

            // Act & Assert
            await expect(
                syncPlanningToGitHub({
                    sessionPath: invalidPath,
                    githubConfig: {
                        token: 'test-token',
                        owner: 'test-owner',
                        repo: 'test-repo'
                    },
                    trackingPath
                })
            ).rejects.toThrow();
        });

        it('should link subtasks to parent tasks', async () => {
            // Arrange
            let issueCounter = 0;
            const mockCreateIssue = vi.fn().mockImplementation(async () => {
                issueCounter++;
                return issueCounter;
            });

            const mockAddLabels = vi.fn().mockResolvedValue(undefined);
            const mockLinkIssues = vi.fn().mockResolvedValue(undefined);

            vi.mocked(GitHubClient).mockImplementation(
                () =>
                    ({
                        createIssue: mockCreateIssue,
                        addLabels: mockAddLabels,
                        linkIssues: mockLinkIssues
                    }) as unknown as GitHubClient
            );

            // Act
            await syncPlanningToGitHub({
                sessionPath,
                githubConfig: {
                    token: 'test-token',
                    owner: 'test-owner',
                    repo: 'test-repo'
                },
                trackingPath,
                dryRun: false
            });

            // Assert - linkIssues should be called for subtasks
            expect(mockLinkIssues).toHaveBeenCalled();
        });

        it('should update TODOs.md with GitHub links after sync', async () => {
            // Arrange
            const mockCreateIssue = vi.fn().mockResolvedValue(123);
            const mockAddLabels = vi.fn().mockResolvedValue(undefined);

            vi.mocked(GitHubClient).mockImplementation(
                () =>
                    ({
                        createIssue: mockCreateIssue,
                        addLabels: mockAddLabels
                    }) as unknown as GitHubClient
            );

            // Act
            await syncPlanningToGitHub({
                sessionPath,
                githubConfig: {
                    token: 'test-token',
                    owner: 'test-owner',
                    repo: 'test-repo'
                },
                trackingPath,
                dryRun: false
            });

            // Assert - Check TODOs.md was updated
            const todosContent = await fs.readFile(path.join(sessionPath, 'TODOs.md'), 'utf-8');

            expect(todosContent).toContain('**GitHub:**');
            expect(todosContent).toMatch(/#\d+/); // Contains issue number
        });
    });
});
