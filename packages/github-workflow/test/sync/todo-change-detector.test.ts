/**
 * Tests for TODO change detector
 *
 * Validates detection of changes in code comments for issue updates
 */

import { describe, expect, it } from 'vitest';
import type { CodeComment } from '../../src/parsers/types.js';
import {
    createCommentSnapshot,
    detectCommentChanges
} from '../../src/sync/todo-change-detector.js';
import type { TrackingRecord } from '../../src/tracking/types.js';

describe('createCommentSnapshot', () => {
    it('should create snapshot of comment without metadata', () => {
        // Arrange
        const comment: CodeComment = {
            id: 'comment-123',
            type: 'TODO',
            content: 'Fix bug',
            filePath: 'src/test.ts',
            lineNumber: 10
        };

        // Act
        const snapshot = createCommentSnapshot(comment);

        // Assert
        expect(snapshot).toEqual({
            content: 'Fix bug',
            filePath: 'src/test.ts',
            lineNumber: 10,
            priority: undefined,
            assignee: undefined,
            labels: undefined
        });
    });

    it('should create snapshot of comment with full metadata', () => {
        // Arrange
        const comment: CodeComment = {
            id: 'comment-123',
            type: 'TODO',
            content: 'Optimize query',
            filePath: 'src/db/query.ts',
            lineNumber: 50,
            priority: 'high',
            assignee: 'john',
            labels: ['performance', 'database']
        };

        // Act
        const snapshot = createCommentSnapshot(comment);

        // Assert
        expect(snapshot).toEqual({
            content: 'Optimize query',
            filePath: 'src/db/query.ts',
            lineNumber: 50,
            priority: 'high',
            assignee: 'john',
            labels: ['performance', 'database']
        });
    });

    it('should normalize empty labels array', () => {
        // Arrange
        const comment: CodeComment = {
            id: 'comment-123',
            type: 'TODO',
            content: 'Test',
            filePath: 'test.ts',
            lineNumber: 1,
            labels: []
        };

        // Act
        const snapshot = createCommentSnapshot(comment);

        // Assert
        expect(snapshot.labels).toBeUndefined();
    });
});

describe('detectCommentChanges', () => {
    it('should detect no changes when comment is identical', () => {
        // Arrange
        const comment: CodeComment = {
            id: 'comment-123',
            type: 'TODO',
            content: 'Fix bug',
            filePath: 'src/test.ts',
            lineNumber: 10
        };

        const trackingRecord: TrackingRecord = {
            id: 'tracking-123',
            type: 'code-comment',
            source: {
                commentId: 'comment-123'
            },
            status: 'synced',
            github: {
                issueNumber: 42,
                issueUrl: 'https://github.com/test/test/issues/42',
                syncedAt: '2024-01-01T00:00:00Z'
            },
            syncAttempts: 1,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
            commentSnapshot: {
                content: 'Fix bug',
                filePath: 'src/test.ts',
                lineNumber: 10
            }
        };

        // Act
        const changes = detectCommentChanges({ comment, trackingRecord });

        // Assert
        expect(changes.contentChanged).toBe(false);
        expect(changes.filePathChanged).toBe(false);
        expect(changes.lineNumberChanged).toBe(false);
        expect(changes.priorityChanged).toBe(false);
        expect(changes.assigneeChanged).toBe(false);
        expect(changes.labelsChanged).toBe(false);
        expect(changes.changedFields).toEqual([]);
    });

    it('should detect content change', () => {
        // Arrange
        const comment: CodeComment = {
            id: 'comment-123',
            type: 'TODO',
            content: 'Fix critical bug',
            filePath: 'src/test.ts',
            lineNumber: 10
        };

        const trackingRecord: TrackingRecord = {
            id: 'tracking-123',
            type: 'code-comment',
            source: {
                commentId: 'comment-123'
            },
            status: 'synced',
            github: {
                issueNumber: 42,
                issueUrl: 'https://github.com/test/test/issues/42',
                syncedAt: '2024-01-01T00:00:00Z'
            },
            syncAttempts: 1,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
            commentSnapshot: {
                content: 'Fix bug',
                filePath: 'src/test.ts',
                lineNumber: 10
            }
        };

        // Act
        const changes = detectCommentChanges({ comment, trackingRecord });

        // Assert
        expect(changes.contentChanged).toBe(true);
        expect(changes.filePathChanged).toBe(false);
        expect(changes.lineNumberChanged).toBe(false);
        expect(changes.changedFields).toContain('content');
        expect(changes.changedFields).toHaveLength(1);
    });

    it('should detect file path change', () => {
        // Arrange
        const comment: CodeComment = {
            id: 'comment-123',
            type: 'TODO',
            content: 'Fix bug',
            filePath: 'src/new-location.ts',
            lineNumber: 10
        };

        const trackingRecord: TrackingRecord = {
            id: 'tracking-123',
            type: 'code-comment',
            source: {
                commentId: 'comment-123'
            },
            status: 'synced',
            github: {
                issueNumber: 42,
                issueUrl: 'https://github.com/test/test/issues/42',
                syncedAt: '2024-01-01T00:00:00Z'
            },
            syncAttempts: 1,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
            commentSnapshot: {
                content: 'Fix bug',
                filePath: 'src/old-location.ts',
                lineNumber: 10
            }
        };

        // Act
        const changes = detectCommentChanges({ comment, trackingRecord });

        // Assert
        expect(changes.filePathChanged).toBe(true);
        expect(changes.contentChanged).toBe(false);
        expect(changes.changedFields).toContain('filePath');
    });

    it('should detect line number change', () => {
        // Arrange
        const comment: CodeComment = {
            id: 'comment-123',
            type: 'TODO',
            content: 'Fix bug',
            filePath: 'src/test.ts',
            lineNumber: 20
        };

        const trackingRecord: TrackingRecord = {
            id: 'tracking-123',
            type: 'code-comment',
            source: {
                commentId: 'comment-123'
            },
            status: 'synced',
            github: {
                issueNumber: 42,
                issueUrl: 'https://github.com/test/test/issues/42',
                syncedAt: '2024-01-01T00:00:00Z'
            },
            syncAttempts: 1,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
            commentSnapshot: {
                content: 'Fix bug',
                filePath: 'src/test.ts',
                lineNumber: 10
            }
        };

        // Act
        const changes = detectCommentChanges({ comment, trackingRecord });

        // Assert
        expect(changes.lineNumberChanged).toBe(true);
        expect(changes.changedFields).toContain('lineNumber');
    });

    it('should detect priority change', () => {
        // Arrange
        const comment: CodeComment = {
            id: 'comment-123',
            type: 'TODO',
            content: 'Fix bug',
            filePath: 'src/test.ts',
            lineNumber: 10,
            priority: 'high'
        };

        const trackingRecord: TrackingRecord = {
            id: 'tracking-123',
            type: 'code-comment',
            source: {
                commentId: 'comment-123'
            },
            status: 'synced',
            github: {
                issueNumber: 42,
                issueUrl: 'https://github.com/test/test/issues/42',
                syncedAt: '2024-01-01T00:00:00Z'
            },
            syncAttempts: 1,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
            commentSnapshot: {
                content: 'Fix bug',
                filePath: 'src/test.ts',
                lineNumber: 10,
                priority: 'medium'
            }
        };

        // Act
        const changes = detectCommentChanges({ comment, trackingRecord });

        // Assert
        expect(changes.priorityChanged).toBe(true);
        expect(changes.changedFields).toContain('priority');
    });

    it('should detect priority added', () => {
        // Arrange
        const comment: CodeComment = {
            id: 'comment-123',
            type: 'TODO',
            content: 'Fix bug',
            filePath: 'src/test.ts',
            lineNumber: 10,
            priority: 'high'
        };

        const trackingRecord: TrackingRecord = {
            id: 'tracking-123',
            type: 'code-comment',
            source: {
                commentId: 'comment-123'
            },
            status: 'synced',
            github: {
                issueNumber: 42,
                issueUrl: 'https://github.com/test/test/issues/42',
                syncedAt: '2024-01-01T00:00:00Z'
            },
            syncAttempts: 1,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
            commentSnapshot: {
                content: 'Fix bug',
                filePath: 'src/test.ts',
                lineNumber: 10
            }
        };

        // Act
        const changes = detectCommentChanges({ comment, trackingRecord });

        // Assert
        expect(changes.priorityChanged).toBe(true);
        expect(changes.changedFields).toContain('priority');
    });

    it('should detect assignee change', () => {
        // Arrange
        const comment: CodeComment = {
            id: 'comment-123',
            type: 'TODO',
            content: 'Fix bug',
            filePath: 'src/test.ts',
            lineNumber: 10,
            assignee: 'maria'
        };

        const trackingRecord: TrackingRecord = {
            id: 'tracking-123',
            type: 'code-comment',
            source: {
                commentId: 'comment-123'
            },
            status: 'synced',
            github: {
                issueNumber: 42,
                issueUrl: 'https://github.com/test/test/issues/42',
                syncedAt: '2024-01-01T00:00:00Z'
            },
            syncAttempts: 1,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
            commentSnapshot: {
                content: 'Fix bug',
                filePath: 'src/test.ts',
                lineNumber: 10,
                assignee: 'john'
            }
        };

        // Act
        const changes = detectCommentChanges({ comment, trackingRecord });

        // Assert
        expect(changes.assigneeChanged).toBe(true);
        expect(changes.changedFields).toContain('assignee');
    });

    it('should detect labels change', () => {
        // Arrange
        const comment: CodeComment = {
            id: 'comment-123',
            type: 'TODO',
            content: 'Fix bug',
            filePath: 'src/test.ts',
            lineNumber: 10,
            labels: ['bug', 'urgent']
        };

        const trackingRecord: TrackingRecord = {
            id: 'tracking-123',
            type: 'code-comment',
            source: {
                commentId: 'comment-123'
            },
            status: 'synced',
            github: {
                issueNumber: 42,
                issueUrl: 'https://github.com/test/test/issues/42',
                syncedAt: '2024-01-01T00:00:00Z'
            },
            syncAttempts: 1,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
            commentSnapshot: {
                content: 'Fix bug',
                filePath: 'src/test.ts',
                lineNumber: 10,
                labels: ['bug']
            }
        };

        // Act
        const changes = detectCommentChanges({ comment, trackingRecord });

        // Assert
        expect(changes.labelsChanged).toBe(true);
        expect(changes.changedFields).toContain('labels');
    });

    it('should detect multiple changes', () => {
        // Arrange
        const comment: CodeComment = {
            id: 'comment-123',
            type: 'TODO',
            content: 'Fix critical bug',
            filePath: 'src/new-file.ts',
            lineNumber: 20,
            priority: 'high',
            assignee: 'maria'
        };

        const trackingRecord: TrackingRecord = {
            id: 'tracking-123',
            type: 'code-comment',
            source: {
                commentId: 'comment-123'
            },
            status: 'synced',
            github: {
                issueNumber: 42,
                issueUrl: 'https://github.com/test/test/issues/42',
                syncedAt: '2024-01-01T00:00:00Z'
            },
            syncAttempts: 1,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
            commentSnapshot: {
                content: 'Fix bug',
                filePath: 'src/old-file.ts',
                lineNumber: 10
            }
        };

        // Act
        const changes = detectCommentChanges({ comment, trackingRecord });

        // Assert
        expect(changes.contentChanged).toBe(true);
        expect(changes.filePathChanged).toBe(true);
        expect(changes.lineNumberChanged).toBe(true);
        expect(changes.priorityChanged).toBe(true);
        expect(changes.assigneeChanged).toBe(true);
        expect(changes.changedFields).toContain('content');
        expect(changes.changedFields).toContain('filePath');
        expect(changes.changedFields).toContain('lineNumber');
        expect(changes.changedFields).toContain('priority');
        expect(changes.changedFields).toContain('assignee');
        expect(changes.changedFields).toHaveLength(5);
    });

    it('should handle missing snapshot', () => {
        // Arrange
        const comment: CodeComment = {
            id: 'comment-123',
            type: 'TODO',
            content: 'Fix bug',
            filePath: 'src/test.ts',
            lineNumber: 10
        };

        const trackingRecord: TrackingRecord = {
            id: 'tracking-123',
            type: 'code-comment',
            source: {
                commentId: 'comment-123'
            },
            status: 'synced',
            github: {
                issueNumber: 42,
                issueUrl: 'https://github.com/test/test/issues/42',
                syncedAt: '2024-01-01T00:00:00Z'
            },
            syncAttempts: 1,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z'
            // No commentSnapshot
        };

        // Act
        const changes = detectCommentChanges({ comment, trackingRecord });

        // Assert
        // All changes should be true when snapshot is missing
        expect(changes.contentChanged).toBe(true);
        expect(changes.filePathChanged).toBe(true);
        expect(changes.lineNumberChanged).toBe(true);
        expect(changes.changedFields.length).toBeGreaterThan(0);
    });

    it('should handle labels order difference as no change', () => {
        // Arrange
        const comment: CodeComment = {
            id: 'comment-123',
            type: 'TODO',
            content: 'Fix bug',
            filePath: 'src/test.ts',
            lineNumber: 10,
            labels: ['bug', 'urgent']
        };

        const trackingRecord: TrackingRecord = {
            id: 'tracking-123',
            type: 'code-comment',
            source: {
                commentId: 'comment-123'
            },
            status: 'synced',
            github: {
                issueNumber: 42,
                issueUrl: 'https://github.com/test/test/issues/42',
                syncedAt: '2024-01-01T00:00:00Z'
            },
            syncAttempts: 1,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
            commentSnapshot: {
                content: 'Fix bug',
                filePath: 'src/test.ts',
                lineNumber: 10,
                labels: ['urgent', 'bug']
            }
        };

        // Act
        const changes = detectCommentChanges({ comment, trackingRecord });

        // Assert
        expect(changes.labelsChanged).toBe(false);
        expect(changes.changedFields).not.toContain('labels');
    });
});
