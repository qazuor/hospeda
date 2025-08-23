/**
 * TODO-Linear Synchronization System v2
 *
 * A filesystem-based tracking system for synchronizing TODO/HACK/DEBUG comments
 * with Linear issues, featuring efficient change detection and robust state management.
 */

// Core classes
export { FileScanner } from './core/file-scanner.js';
export { TodoLinearClient } from './core/linear-client.js';
export { CommentParser } from './core/parser.js';
export { TodoSynchronizer } from './core/synchronizer.js';
export { TrackingManager } from './core/tracking.js';

// Configuration
export { findProjectRoot, isConfigured, loadConfig, validateConfig } from './config/config.js';

// Utilities
export { Logger, default as logger, LogLevel } from './utils/logger.js';

// Types
export type {
    CleanOptions,
    CommentKey,
    CommentType,
    ParsedComment,
    SyncLists,
    SyncOperation,
    SyncOperationType,
    SyncResult,
    TodoLinearConfig,
    TrackedComment,
    TrackingData
} from './types/index.js';
