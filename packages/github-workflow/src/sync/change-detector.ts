/**
 * Change detection for task updates
 *
 * Detects changes between current task state and last synced state.
 *
 * @module sync/change-detector
 */

import type { Task } from '../parsers/types.js';
import type { TrackingRecord } from '../tracking/types.js';
import type { TaskChanges } from './types.js';

/**
 * Input for detecting task changes
 */
export type DetectTaskChangesInput = {
    /** Current task from planning */
    task: Task;

    /** Tracking record with synced state */
    trackingRecord: TrackingRecord;
};

/**
 * Task snapshot stored in tracking record
 */
export type TaskSnapshot = {
    /** Task title */
    title: string;

    /** Task description */
    description?: string;

    /** Task status */
    status: string;

    /** Task estimate */
    estimate?: string;

    /** Task assignee */
    assignee?: string;
};

/**
 * Detect changes between current task and last synced state
 *
 * Compares task fields with the snapshot stored in the tracking record
 * to identify what has changed since the last sync.
 *
 * @param input - Change detection input
 * @returns Task changes detected
 *
 * @example
 * ```typescript
 * const changes = detectTaskChanges({
 *   task: currentTask,
 *   trackingRecord: record
 * });
 *
 * if (changes.changedFields.length > 0) {
 *   console.log('Task changed:', changes.changedFields);
 * }
 * ```
 */
export function detectTaskChanges(input: DetectTaskChangesInput): TaskChanges {
    const { task, trackingRecord } = input;

    // Get task snapshot from tracking record
    const snapshot = (trackingRecord as unknown as { taskSnapshot?: TaskSnapshot }).taskSnapshot;

    const changes: TaskChanges = {
        titleChanged: false,
        descriptionChanged: false,
        statusChanged: false,
        estimateChanged: false,
        assigneeChanged: false,
        changedFields: []
    };

    // If no snapshot exists, consider it as changes needed
    if (!snapshot) {
        changes.titleChanged = true;
        changes.descriptionChanged = task.description !== undefined;
        changes.statusChanged = true;
        changes.estimateChanged = task.estimate !== undefined;
        changes.assigneeChanged = task.assignee !== undefined;

        changes.changedFields.push('title');
        if (task.description) changes.changedFields.push('description');
        changes.changedFields.push('status');
        if (task.estimate) changes.changedFields.push('estimate');
        if (task.assignee) changes.changedFields.push('assignee');

        return changes;
    }

    // Check title
    if (task.title !== snapshot.title) {
        changes.titleChanged = true;
        changes.changedFields.push('title');
    }

    // Check description
    if (task.description !== snapshot.description) {
        changes.descriptionChanged = true;
        changes.changedFields.push('description');
    }

    // Check status
    if (task.status !== snapshot.status) {
        changes.statusChanged = true;
        changes.changedFields.push('status');
    }

    // Check estimate
    if (task.estimate !== snapshot.estimate) {
        changes.estimateChanged = true;
        changes.changedFields.push('estimate');
    }

    // Check assignee
    if (task.assignee !== snapshot.assignee) {
        changes.assigneeChanged = true;
        changes.changedFields.push('assignee');
    }

    return changes;
}

/**
 * Create task snapshot for tracking
 *
 * @param task - Task to snapshot
 * @returns Task snapshot
 */
export function createTaskSnapshot(task: Task): TaskSnapshot {
    return {
        title: task.title,
        description: task.description,
        status: task.status,
        estimate: task.estimate,
        assignee: task.assignee
    };
}
