/**
 * GitHub sync functionality for planning sessions and TODOs
 *
 * @module sync
 */

export { detectTaskChanges, createTaskSnapshot } from './change-detector.js';
export { buildIssueBody, buildIssueTitle } from './issue-builder.js';
export { generateLabelsForTask } from './label-manager.js';
export { syncPlanningToGitHub } from './planning-sync.js';
export { detectCommentChanges, createCommentSnapshot } from './todo-change-detector.js';
export { buildTodoIssueBody, buildTodoIssueTitle } from './todo-issue-builder.js';
export { syncTodosToGitHub } from './todo-sync.js';
export { detectCompletedTasks } from './completion-detector.js';
export { OfflineQueue } from './offline-queue.js';
export { OfflineDetector } from './offline-detector.js';
export { QueueProcessor } from './queue-processor.js';
export type {
    SyncOptions,
    SyncResult,
    CreatedIssue,
    UpdatedIssue,
    SkippedTask,
    FailedTask,
    SyncStatistics,
    TaskChanges,
    TodoSyncOptions,
    TodoSyncResult,
    CreatedTodoIssue,
    UpdatedTodoIssue,
    ClosedTodoIssue,
    SkippedTodo,
    FailedTodo,
    TodoSyncStatistics,
    CommentChanges,
    CompletionDetectorOptions,
    CompletionResult,
    DetectedTask,
    CompletedTask,
    ClosedIssue,
    FailedCompletion,
    CompletionStatistics,
    QueuedOperation,
    OperationType,
    OperationStatus,
    QueueStatistics,
    OfflineQueueOptions
} from './types.js';
export type { OfflineDetectorOptions } from './offline-detector.js';
export type { QueueProcessorOptions, QueueProcessingResult } from './queue-processor.js';
