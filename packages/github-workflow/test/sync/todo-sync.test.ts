/**
 * Tests for TODO synchronization orchestrator
 *
 * Integration tests for syncing code comments to GitHub Issues
 */

import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHubClient } from '../../src/core/github-client.js';
import type { CodeComment } from '../../src/parsers/types.js';
import { syncTodosToGitHub } from '../../src/sync/todo-sync.js';
import { TrackingManager } from '../../src/tracking/tracking-manager.js';

// Mock modules
vi.mock('../../src/core/github-client.js');
vi.mock('../../src/parsers/code-comment-parser.js');

describe('syncTodosToGitHub', () => {
    let tempDir: string;
    let trackingPath: string;

    beforeEach(async () => {
        // Create temporary directory for tests
        tempDir = join(process.cwd(), '.test-tmp', `test-${Date.now()}`);
        trackingPath = join(tempDir, 'tracking.json');
        await mkdir(tempDir, { recursive: true });

        // Clear all mocks
        vi.clearAllMocks();
    });

    afterEach(async () => {
        // Cleanup
        await rm(tempDir, { recursive: true, force: true });
    });

    it('should create issues for new TODOs', async () => {
        // Arrange
        const mockComments: CodeComment[] = [
            {
                id: 'comment-1',
                type: 'TODO',
                content: 'Implement user authentication',
                filePath: 'src/auth/user.ts',
                lineNumber: 42
            },
            {
                id: 'comment-2',
                type: 'HACK',
                content: 'Temporary fix for API bug',
                filePath: 'src/api/client.ts',
                lineNumber: 100,
                priority: 'high'
            }
        ];

        // Mock scanCodeComments
        const { scanCodeComments } = await import('../../src/parsers/code-comment-parser.js');
        vi.mocked(scanCodeComments).mockResolvedValue({
            comments: mockComments,
            filesScanned: 2,
            commentsFound: 2,
            byType: { TODO: [mockComments[0]!], HACK: [mockComments[1]!], DEBUG: [] },
            byFile: {
                'src/auth/user.ts': [mockComments[0]!],
                'src/api/client.ts': [mockComments[1]!]
            }
        });

        // Mock GitHub client
        const mockCreateIssue = vi.fn();
        mockCreateIssue.mockResolvedValueOnce(1).mockResolvedValueOnce(2);
        vi.mocked(GitHubClient).mockImplementation(
            () =>
                ({
                    createIssue: mockCreateIssue
                }) as never
        );

        // Act
        const result = await syncTodosToGitHub({
            baseDir: tempDir,
            githubConfig: {
                token: 'test-token',
                owner: 'hospeda',
                repo: 'main'
            },
            trackingPath,
            dryRun: false
        });

        // Assert
        expect(result.success).toBe(true);
        expect(result.scanned.filesScanned).toBe(2);
        expect(result.scanned.commentsFound).toBe(2);
        expect(result.statistics.created).toBe(2);
        expect(result.statistics.updated).toBe(0);
        expect(result.statistics.skipped).toBe(0);
        expect(result.statistics.failed).toBe(0);

        expect(result.created).toHaveLength(2);
        expect(result.created[0]).toMatchObject({
            commentId: 'comment-1',
            type: 'TODO',
            filePath: 'src/auth/user.ts',
            lineNumber: 42,
            issueNumber: 1
        });
        expect(result.created[1]).toMatchObject({
            commentId: 'comment-2',
            type: 'HACK',
            filePath: 'src/api/client.ts',
            lineNumber: 100,
            issueNumber: 2
        });

        expect(mockCreateIssue).toHaveBeenCalledTimes(2);
    });

    it('should skip already synced TODOs when updateExisting is false', async () => {
        // Arrange
        const mockComments: CodeComment[] = [
            {
                id: 'comment-1',
                type: 'TODO',
                content: 'Test comment',
                filePath: 'src/test.ts',
                lineNumber: 10
            }
        ];

        // Mock scanCodeComments
        const { scanCodeComments } = await import('../../src/parsers/code-comment-parser.js');
        vi.mocked(scanCodeComments).mockResolvedValue({
            comments: mockComments,
            filesScanned: 1,
            commentsFound: 1,
            byType: { TODO: [mockComments[0]!], HACK: [], DEBUG: [] },
            byFile: { 'src/test.ts': [mockComments[0]!] }
        });

        // Pre-populate tracking with existing record
        const trackingManager = new TrackingManager(trackingPath);
        await trackingManager.load();
        const record = await trackingManager.addRecord({
            type: 'code-comment',
            source: {
                commentId: 'comment-1'
            },
            status: 'pending',
            syncAttempts: 0
        });
        await trackingManager.markAsSynced(
            record.id,
            42,
            'https://github.com/hospeda/main/issues/42'
        );
        await trackingManager.save();

        // Mock GitHub client (should not be called)
        const mockCreateIssue = vi.fn();
        vi.mocked(GitHubClient).mockImplementation(
            () =>
                ({
                    createIssue: mockCreateIssue
                }) as never
        );

        // Act
        const result = await syncTodosToGitHub({
            baseDir: tempDir,
            githubConfig: {
                token: 'test-token',
                owner: 'hospeda',
                repo: 'main'
            },
            trackingPath,
            updateExisting: false,
            dryRun: false
        });

        // Assert
        expect(result.success).toBe(true);
        expect(result.statistics.created).toBe(0);
        expect(result.statistics.skipped).toBe(1);
        expect(result.skipped[0]).toMatchObject({
            commentId: 'comment-1',
            reason: 'Already synced'
        });
        expect(mockCreateIssue).not.toHaveBeenCalled();
    });

    it('should update changed TODOs when updateExisting is true', async () => {
        // Arrange
        const mockComments: CodeComment[] = [
            {
                id: 'comment-1',
                type: 'TODO',
                content: 'Updated comment content',
                filePath: 'src/test.ts',
                lineNumber: 10
            }
        ];

        // Mock scanCodeComments
        const { scanCodeComments } = await import('../../src/parsers/code-comment-parser.js');
        vi.mocked(scanCodeComments).mockResolvedValue({
            comments: mockComments,
            filesScanned: 1,
            commentsFound: 1,
            byType: { TODO: [mockComments[0]!], HACK: [], DEBUG: [] },
            byFile: { 'src/test.ts': [mockComments[0]!] }
        });

        // Pre-populate tracking with old snapshot
        const trackingManager = new TrackingManager(trackingPath);
        await trackingManager.load();
        const record = await trackingManager.addRecord({
            type: 'code-comment',
            source: {
                commentId: 'comment-1'
            },
            status: 'pending',
            syncAttempts: 0
        });
        await trackingManager.markAsSynced(
            record.id,
            42,
            'https://github.com/hospeda/main/issues/42'
        );
        // Add old snapshot
        const updatedRecord = await trackingManager.findByCommentId('comment-1');
        if (updatedRecord) {
            updatedRecord.commentSnapshot = {
                content: 'Original comment content',
                filePath: 'src/test.ts',
                lineNumber: 10
            };
            await trackingManager.updateRecord(updatedRecord.id, {
                commentSnapshot: updatedRecord.commentSnapshot
            });
        }
        await trackingManager.save();

        // Mock GitHub client
        const mockUpdateIssue = vi.fn().mockResolvedValue(undefined);
        vi.mocked(GitHubClient).mockImplementation(
            () =>
                ({
                    updateIssue: mockUpdateIssue
                }) as never
        );

        // Act
        const result = await syncTodosToGitHub({
            baseDir: tempDir,
            githubConfig: {
                token: 'test-token',
                owner: 'hospeda',
                repo: 'main'
            },
            trackingPath,
            updateExisting: true,
            dryRun: false
        });

        // Assert
        expect(result.success).toBe(true);
        expect(result.statistics.updated).toBe(1);
        expect(result.statistics.created).toBe(0);
        expect(result.updated[0]).toMatchObject({
            commentId: 'comment-1',
            issueNumber: 42,
            changes: ['content']
        });
        expect(mockUpdateIssue).toHaveBeenCalledWith(42, expect.any(Object));
    });

    it('should close removed TODOs when closeRemoved is true', async () => {
        // Arrange - No comments in scan (all removed)
        const { scanCodeComments } = await import('../../src/parsers/code-comment-parser.js');
        vi.mocked(scanCodeComments).mockResolvedValue({
            comments: [],
            filesScanned: 0,
            commentsFound: 0,
            byType: { TODO: [], HACK: [], DEBUG: [] },
            byFile: {}
        });

        // Pre-populate tracking with existing TODO
        const trackingManager = new TrackingManager(trackingPath);
        await trackingManager.load();
        const record = await trackingManager.addRecord({
            type: 'code-comment',
            source: {
                commentId: 'comment-1'
            },
            status: 'pending',
            syncAttempts: 0
        });
        await trackingManager.markAsSynced(
            record.id,
            42,
            'https://github.com/hospeda/main/issues/42'
        );
        await trackingManager.save();

        // Mock GitHub client
        const mockCloseIssue = vi.fn().mockResolvedValue(undefined);
        vi.mocked(GitHubClient).mockImplementation(
            () =>
                ({
                    closeIssue: mockCloseIssue
                }) as never
        );

        // Act
        const result = await syncTodosToGitHub({
            baseDir: tempDir,
            githubConfig: {
                token: 'test-token',
                owner: 'hospeda',
                repo: 'main'
            },
            trackingPath,
            closeRemoved: true,
            dryRun: false
        });

        // Assert
        expect(result.success).toBe(true);
        expect(result.statistics.closed).toBe(1);
        expect(result.closed[0]).toMatchObject({
            commentId: 'comment-1',
            issueNumber: 42,
            reason: 'Comment removed from source code'
        });
        expect(mockCloseIssue).toHaveBeenCalledWith(42);
    });

    it('should handle dry run mode without creating issues', async () => {
        // Arrange
        const mockComments: CodeComment[] = [
            {
                id: 'comment-1',
                type: 'TODO',
                content: 'Test',
                filePath: 'src/test.ts',
                lineNumber: 1
            }
        ];

        const { scanCodeComments } = await import('../../src/parsers/code-comment-parser.js');
        vi.mocked(scanCodeComments).mockResolvedValue({
            comments: mockComments,
            filesScanned: 1,
            commentsFound: 1,
            byType: { TODO: mockComments, HACK: [], DEBUG: [] },
            byFile: { 'src/test.ts': mockComments }
        });

        const mockCreateIssue = vi.fn();
        vi.mocked(GitHubClient).mockImplementation(
            () =>
                ({
                    createIssue: mockCreateIssue
                }) as never
        );

        // Act
        const result = await syncTodosToGitHub({
            baseDir: tempDir,
            githubConfig: {
                token: 'test-token',
                owner: 'hospeda',
                repo: 'main'
            },
            trackingPath,
            dryRun: true
        });

        // Assert
        expect(result.success).toBe(true);
        expect(result.statistics.created).toBe(1);
        expect(result.created[0]?.issueNumber).toBe(0);
        expect(result.created[0]?.issueUrl).toBe('dry-run');
        expect(mockCreateIssue).not.toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
        // Arrange
        const mockComments: CodeComment[] = [
            {
                id: 'comment-1',
                type: 'TODO',
                content: 'Test',
                filePath: 'src/test.ts',
                lineNumber: 1
            }
        ];

        const { scanCodeComments } = await import('../../src/parsers/code-comment-parser.js');
        vi.mocked(scanCodeComments).mockResolvedValue({
            comments: mockComments,
            filesScanned: 1,
            commentsFound: 1,
            byType: { TODO: mockComments, HACK: [], DEBUG: [] },
            byFile: { 'src/test.ts': mockComments }
        });

        // Mock GitHub client to throw error
        const mockCreateIssue = vi.fn().mockRejectedValue(new Error('API rate limit exceeded'));
        vi.mocked(GitHubClient).mockImplementation(
            () =>
                ({
                    createIssue: mockCreateIssue
                }) as never
        );

        // Act
        const result = await syncTodosToGitHub({
            baseDir: tempDir,
            githubConfig: {
                token: 'test-token',
                owner: 'hospeda',
                repo: 'main'
            },
            trackingPath,
            dryRun: false
        });

        // Assert
        expect(result.success).toBe(false);
        expect(result.statistics.failed).toBe(1);
        expect(result.failed[0]).toMatchObject({
            commentId: 'comment-1',
            error: 'API rate limit exceeded'
        });
    });

    it('should filter comments by type', async () => {
        // Arrange
        const mockComments: CodeComment[] = [
            {
                id: 'comment-1',
                type: 'TODO',
                content: 'TODO comment',
                filePath: 'src/test.ts',
                lineNumber: 1
            },
            {
                id: 'comment-2',
                type: 'HACK',
                content: 'HACK comment',
                filePath: 'src/test.ts',
                lineNumber: 2
            },
            {
                id: 'comment-3',
                type: 'DEBUG',
                content: 'DEBUG comment',
                filePath: 'src/test.ts',
                lineNumber: 3
            }
        ];

        const { scanCodeComments } = await import('../../src/parsers/code-comment-parser.js');
        vi.mocked(scanCodeComments).mockResolvedValue({
            comments: [mockComments[0]!], // Only TODO
            filesScanned: 1,
            commentsFound: 1,
            byType: { TODO: [mockComments[0]!], HACK: [], DEBUG: [] },
            byFile: { 'src/test.ts': [mockComments[0]!] }
        });

        const mockCreateIssue = vi.fn().mockResolvedValue(1);
        vi.mocked(GitHubClient).mockImplementation(
            () =>
                ({
                    createIssue: mockCreateIssue
                }) as never
        );

        // Act
        const result = await syncTodosToGitHub({
            baseDir: tempDir,
            commentTypes: ['TODO'], // Only sync TODOs
            githubConfig: {
                token: 'test-token',
                owner: 'hospeda',
                repo: 'main'
            },
            trackingPath,
            dryRun: false
        });

        // Assert
        expect(result.success).toBe(true);
        expect(result.statistics.created).toBe(1);
        expect(result.created[0]?.type).toBe('TODO');
        expect(mockCreateIssue).toHaveBeenCalledTimes(1);
    });

    it('should handle empty codebase gracefully', async () => {
        // Arrange
        const { scanCodeComments } = await import('../../src/parsers/code-comment-parser.js');
        vi.mocked(scanCodeComments).mockResolvedValue({
            comments: [],
            filesScanned: 0,
            commentsFound: 0,
            byType: { TODO: [], HACK: [], DEBUG: [] },
            byFile: {}
        });

        // Act
        const result = await syncTodosToGitHub({
            baseDir: tempDir,
            githubConfig: {
                token: 'test-token',
                owner: 'hospeda',
                repo: 'main'
            },
            trackingPath,
            dryRun: false
        });

        // Assert
        expect(result.success).toBe(true);
        expect(result.scanned.filesScanned).toBe(0);
        expect(result.scanned.commentsFound).toBe(0);
        expect(result.statistics.created).toBe(0);
        expect(result.statistics.updated).toBe(0);
        expect(result.statistics.closed).toBe(0);
    });
});
