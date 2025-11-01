/**
 * Change detector for TODO comments
 *
 * Detects changes in code comments to determine if GitHub issues need updates.
 * Compares current comment state with tracked snapshot to identify modifications.
 *
 * @module sync/todo-change-detector
 */

import type { CodeComment } from '../parsers/types.js';
import type { TrackingRecord } from '../tracking/types.js';
import type { CommentChanges } from './types.js';

/**
 * Snapshot of comment state for change detection
 */
export type CommentSnapshot = {
    /** Comment content */
    content: string;

    /** File path */
    filePath: string;

    /** Line number */
    lineNumber: number;

    /** Priority level */
    priority?: string;

    /** Assigned user */
    assignee?: string;

    /** Labels/tags */
    labels?: string[];
};

/**
 * Input for creating comment snapshot
 */
export type CreateCommentSnapshotInput = CodeComment;

/**
 * Input for detecting comment changes
 */
export type DetectCommentChangesInput = {
    /** Current comment state */
    comment: CodeComment;

    /** Tracking record with previous snapshot */
    trackingRecord: TrackingRecord;
};

/**
 * Create snapshot of comment for change tracking
 *
 * Captures essential fields that should trigger issue updates when changed.
 * Normalizes empty arrays to undefined for consistent comparison.
 *
 * @param comment - Comment to snapshot
 * @returns Comment snapshot
 *
 * @example
 * ```typescript
 * const snapshot = createCommentSnapshot({
 *   id: 'comment-123',
 *   type: 'TODO',
 *   content: 'Fix bug',
 *   filePath: 'src/test.ts',
 *   lineNumber: 10,
 *   priority: 'high'
 * });
 * // { content: 'Fix bug', filePath: 'src/test.ts', lineNumber: 10, priority: 'high' }
 * ```
 */
export function createCommentSnapshot(comment: CreateCommentSnapshotInput): CommentSnapshot {
    return {
        content: comment.content,
        filePath: comment.filePath,
        lineNumber: comment.lineNumber,
        priority: comment.priority,
        assignee: comment.assignee,
        labels: comment.labels && comment.labels.length > 0 ? comment.labels : undefined
    };
}

/**
 * Detect changes in code comment
 *
 * Compares current comment with tracked snapshot to identify modifications.
 * Used to determine if GitHub issue needs updating.
 *
 * Change detection:
 * - Content: Text of the comment
 * - File path: File location (file was moved)
 * - Line number: Line position (code was edited)
 * - Priority: Priority level changed
 * - Assignee: Assigned user changed
 * - Labels: Tags added/removed/modified
 *
 * @param input - Change detection input
 * @param input.comment - Current comment state
 * @param input.trackingRecord - Tracking record with snapshot
 * @returns Detected changes
 *
 * @example
 * ```typescript
 * const changes = detectCommentChanges({
 *   comment: currentComment,
 *   trackingRecord: trackingRecord
 * });
 *
 * if (changes.changedFields.length > 0) {
 *   console.log(`Changes detected: ${changes.changedFields.join(', ')}`);
 * }
 * ```
 */
export function detectCommentChanges(input: DetectCommentChangesInput): CommentChanges {
    const { comment, trackingRecord } = input;

    const changes: CommentChanges = {
        contentChanged: false,
        filePathChanged: false,
        lineNumberChanged: false,
        priorityChanged: false,
        assigneeChanged: false,
        labelsChanged: false,
        changedFields: []
    };

    // Get previous snapshot
    const snapshot = trackingRecord.commentSnapshot;

    // If no snapshot exists, consider everything changed
    if (!snapshot) {
        changes.contentChanged = true;
        changes.filePathChanged = true;
        changes.lineNumberChanged = true;
        changes.priorityChanged = !!comment.priority;
        changes.assigneeChanged = !!comment.assignee;
        changes.labelsChanged = !!comment.labels?.length;
        changes.changedFields = ['content', 'filePath', 'lineNumber'];
        if (comment.priority) changes.changedFields.push('priority');
        if (comment.assignee) changes.changedFields.push('assignee');
        if (comment.labels?.length) changes.changedFields.push('labels');
        return changes;
    }

    // Check content
    if (comment.content !== snapshot.content) {
        changes.contentChanged = true;
        changes.changedFields.push('content');
    }

    // Check file path
    if (comment.filePath !== snapshot.filePath) {
        changes.filePathChanged = true;
        changes.changedFields.push('filePath');
    }

    // Check line number
    if (comment.lineNumber !== snapshot.lineNumber) {
        changes.lineNumberChanged = true;
        changes.changedFields.push('lineNumber');
    }

    // Check priority
    if (comment.priority !== snapshot.priority) {
        changes.priorityChanged = true;
        changes.changedFields.push('priority');
    }

    // Check assignee
    if (comment.assignee !== snapshot.assignee) {
        changes.assigneeChanged = true;
        changes.changedFields.push('assignee');
    }

    // Check labels (order-independent comparison)
    const currentLabels = comment.labels?.slice().sort();
    const snapshotLabels = snapshot.labels?.slice().sort();
    const currentLabelsStr = currentLabels?.join(',') || '';
    const snapshotLabelsStr = snapshotLabels?.join(',') || '';

    if (currentLabelsStr !== snapshotLabelsStr) {
        changes.labelsChanged = true;
        changes.changedFields.push('labels');
    }

    return changes;
}
