/**
 * GitHub sync functionality for planning sessions and TODOs
 *
 * @module sync
 */

export { detectTaskChanges, createTaskSnapshot } from './change-detector.js';
export { buildIssueBody, buildIssueTitle } from './issue-builder.js';
export { generateLabelsForTask } from './label-manager.js';
export { syncPlanningToGitHub } from './planning-sync.js';
export type {
    SyncOptions,
    SyncResult,
    CreatedIssue,
    UpdatedIssue,
    SkippedTask,
    FailedTask,
    SyncStatistics,
    TaskChanges
} from './types.js';
