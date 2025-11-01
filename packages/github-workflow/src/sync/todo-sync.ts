/**
 * TODO synchronization orchestrator
 *
 * Integrates all sync modules to synchronize code comments (TODO, HACK, DEBUG)
 * to GitHub Issues. Coordinates scanning, tracking, issue creation/updates,
 * and cleanup of removed comments.
 *
 * @module sync/todo-sync
 */

import { logger } from '@repo/logger';
import { GitHubClient } from '../core/github-client.js';
import { scanCodeComments } from '../parsers/code-comment-parser.js';
import type { CodeComment } from '../parsers/types.js';
import { TrackingManager } from '../tracking/tracking-manager.js';
import { createCommentSnapshot, detectCommentChanges } from './todo-change-detector.js';
import { buildTodoIssueBody, buildTodoIssueTitle } from './todo-issue-builder.js';
import type { TodoSyncOptions, TodoSyncResult } from './types.js';

/**
 * Default tracking path
 */
const DEFAULT_TRACKING_PATH = '.todoLinear/tracking.json';

/**
 * Generate labels for a code comment
 *
 * Creates labels based on comment type, priority, and custom labels.
 * Applies consistent labeling strategy across all comment types.
 *
 * @param comment - Code comment to generate labels for
 * @returns Array of label names
 */
function generateLabelsForComment(comment: CodeComment): string[] {
    const labels: string[] = [];

    // Universal label
    labels.push('from:claude-code');

    // Type label
    labels.push(comment.type.toLowerCase());

    // Priority label (if specified)
    if (comment.priority) {
        const priorityLabel = comment.priority.toLowerCase();
        if (priorityLabel.startsWith('p')) {
            // P1, P2, P3 format
            labels.push(`priority:${priorityLabel}`);
        } else {
            // high, medium, low format
            labels.push(`priority:${priorityLabel}`);
        }
    }

    // Custom labels from comment metadata
    if (comment.labels?.length) {
        labels.push(...comment.labels);
    }

    // File-based labels
    if (comment.filePath.includes('/test/') || comment.filePath.endsWith('.test.ts')) {
        labels.push('file:test');
    } else if (comment.filePath.includes('/src/')) {
        labels.push('file:src');
    }

    return labels;
}

/**
 * Synchronize code comments to GitHub Issues
 *
 * Main orchestrator that coordinates:
 * 1. Code scanning for TODO/HACK/DEBUG comments
 * 2. Tracking database management
 * 3. Issue creation/update/closure
 * 4. Error handling and reporting
 *
 * @param options - Synchronization options
 * @returns Synchronization result
 *
 * @example
 * ```typescript
 * const result = await syncTodosToGitHub({
 *   baseDir: './src',
 *   githubConfig: {
 *     token: process.env.GITHUB_TOKEN!,
 *     owner: 'hospeda',
 *     repo: 'main'
 *   },
 *   updateExisting: true,
 *   closeRemoved: true
 * });
 *
 * console.log(`Created: ${result.statistics.created}`);
 * console.log(`Updated: ${result.statistics.updated}`);
 * console.log(`Closed: ${result.statistics.closed}`);
 * ```
 */
export async function syncTodosToGitHub(options: TodoSyncOptions): Promise<TodoSyncResult> {
    const {
        baseDir,
        include,
        exclude,
        commentTypes = ['TODO', 'HACK', 'DEBUG'],
        githubConfig,
        trackingPath = DEFAULT_TRACKING_PATH,
        dryRun = false,
        updateExisting = false,
        closeRemoved = false
    } = options;

    logger.info(
        {
            baseDir,
            commentTypes,
            dryRun,
            updateExisting,
            closeRemoved
        },
        'Starting TODO sync'
    );

    // Initialize result
    const result: TodoSyncResult = {
        success: true,
        scanned: {
            filesScanned: 0,
            commentsFound: 0
        },
        created: [],
        updated: [],
        closed: [],
        skipped: [],
        failed: [],
        statistics: {
            totalComments: 0,
            created: 0,
            updated: 0,
            closed: 0,
            skipped: 0,
            failed: 0
        }
    };

    try {
        // Step 1: Scan codebase for comments
        logger.debug({ baseDir }, 'Scanning codebase for comments');
        const scanResult = await scanCodeComments({
            baseDir,
            include,
            exclude,
            commentTypes
        });

        result.scanned.filesScanned = scanResult.filesScanned;
        result.scanned.commentsFound = scanResult.commentsFound;
        result.statistics.totalComments = scanResult.commentsFound;

        logger.info(
            {
                filesScanned: scanResult.filesScanned,
                commentsFound: scanResult.commentsFound
            },
            'Code scan completed'
        );

        // Step 2: Load tracking database
        const trackingManager = new TrackingManager(trackingPath);
        await trackingManager.load();
        logger.debug({ trackingPath }, 'Tracking database loaded');

        // Step 3: Initialize GitHub client (only if not dry run)
        let githubClient: GitHubClient | undefined;
        if (!dryRun) {
            githubClient = new GitHubClient(githubConfig);
            logger.debug('GitHub client initialized');
        }

        // Step 4: Process each comment
        const commentIds = new Set<string>();
        for (const comment of scanResult.comments) {
            commentIds.add(comment.id);

            try {
                await processComment({
                    comment,
                    trackingManager,
                    githubClient,
                    githubConfig,
                    dryRun,
                    updateExisting,
                    result
                });
            } catch (error) {
                logger.error(
                    {
                        commentId: comment.id,
                        error: (error as Error).message
                    },
                    'Failed to process comment'
                );

                result.failed.push({
                    commentId: comment.id,
                    error: (error as Error).message
                });
                result.statistics.failed++;
            }
        }

        // Step 5: Close removed comments (if enabled)
        if (closeRemoved && !dryRun && githubClient) {
            logger.debug('Checking for removed comments');

            // Find all tracked code-comment records
            const allRecords = await trackingManager.getRecords();
            const codeCommentRecords = allRecords.filter((r) => r.type === 'code-comment');

            for (const record of codeCommentRecords) {
                const commentId = record.source.commentId;
                if (!commentId) continue;

                // If comment ID not in current scan, it was removed
                if (!commentIds.has(commentId) && record.github) {
                    try {
                        logger.info(
                            {
                                commentId,
                                issueNumber: record.github.issueNumber
                            },
                            'Closing issue for removed comment'
                        );

                        await githubClient.closeIssue(record.github.issueNumber);

                        // Update tracking
                        await trackingManager.updateRecord(record.id, {
                            status: 'updated'
                        });

                        result.closed.push({
                            commentId,
                            issueNumber: record.github.issueNumber,
                            reason: 'Comment removed from source code'
                        });
                        result.statistics.closed++;
                    } catch (error) {
                        logger.error(
                            {
                                commentId,
                                error: (error as Error).message
                            },
                            'Failed to close removed comment'
                        );

                        result.failed.push({
                            commentId,
                            error: `Failed to close: ${(error as Error).message}`
                        });
                        result.statistics.failed++;
                    }
                }
            }
        }

        // Step 6: Save tracking database (if not dry run)
        if (!dryRun) {
            await trackingManager.save();
            logger.info('Tracking database saved');
        }

        // Determine overall success
        result.success = result.statistics.failed === 0;

        logger.info(
            {
                success: result.success,
                statistics: result.statistics
            },
            'TODO sync completed'
        );

        return result;
    } catch (error) {
        logger.error({ error: (error as Error).message }, 'TODO sync failed');
        result.success = false;
        throw error;
    }
}

/**
 * Process a single code comment
 */
async function processComment(input: {
    comment: CodeComment;
    trackingManager: TrackingManager;
    githubClient: GitHubClient | undefined;
    githubConfig: TodoSyncOptions['githubConfig'];
    dryRun: boolean;
    updateExisting: boolean;
    result: TodoSyncResult;
}): Promise<void> {
    const { comment, trackingManager, githubClient, githubConfig, dryRun, updateExisting, result } =
        input;

    // Check if comment already synced
    const existingRecord = await trackingManager.findByCommentId(comment.id);

    if (existingRecord && !updateExisting) {
        // Skip already synced comment
        logger.debug({ commentId: comment.id }, 'Skipping already synced comment');
        result.skipped.push({
            commentId: comment.id,
            reason: 'Already synced'
        });
        result.statistics.skipped++;
        return;
    }

    if (existingRecord && updateExisting) {
        // Check for changes
        const changes = detectCommentChanges({
            comment,
            trackingRecord: existingRecord
        });

        if (changes.changedFields.length === 0) {
            // No changes, skip
            logger.debug({ commentId: comment.id }, 'No changes detected for comment');
            result.skipped.push({
                commentId: comment.id,
                reason: 'No changes'
            });
            result.statistics.skipped++;
            return;
        }

        // Update existing issue
        if (!dryRun && githubClient && existingRecord.github) {
            logger.info(
                {
                    commentId: comment.id,
                    issueNumber: existingRecord.github.issueNumber,
                    changes: changes.changedFields
                },
                'Updating existing issue'
            );

            const title = buildTodoIssueTitle({ comment });
            const body = buildTodoIssueBody({
                comment,
                owner: githubConfig.owner,
                repo: githubConfig.repo
            });

            await githubClient.updateIssue(existingRecord.github.issueNumber, {
                title,
                body
            });

            // Update tracking record
            existingRecord.commentSnapshot = createCommentSnapshot(comment);
            await trackingManager.updateRecord(existingRecord.id, {
                status: 'updated',
                commentSnapshot: existingRecord.commentSnapshot,
                github: {
                    ...existingRecord.github,
                    updatedAt: new Date().toISOString()
                }
            });

            result.updated.push({
                commentId: comment.id,
                issueNumber: existingRecord.github.issueNumber,
                changes: changes.changedFields
            });
            result.statistics.updated++;
        }

        return;
    }

    // Create new issue
    if (dryRun) {
        logger.debug({ commentId: comment.id }, 'Dry run: would create issue');
        result.created.push({
            commentId: comment.id,
            type: comment.type,
            filePath: comment.filePath,
            lineNumber: comment.lineNumber,
            issueNumber: 0,
            issueUrl: 'dry-run'
        });
        result.statistics.created++;
        return;
    }

    if (!githubClient) {
        throw new Error('GitHub client required for creating issues');
    }

    logger.info(
        {
            commentId: comment.id,
            type: comment.type,
            filePath: comment.filePath,
            lineNumber: comment.lineNumber
        },
        'Creating new issue'
    );

    // Build issue
    const title = buildTodoIssueTitle({ comment });
    const body = buildTodoIssueBody({
        comment,
        owner: githubConfig.owner,
        repo: githubConfig.repo
    });
    const labels = generateLabelsForComment(comment);

    // Create issue
    const issueNumber = await githubClient.createIssue({
        title,
        body,
        labels
    });

    const issueUrl = `https://github.com/${githubConfig.owner}/${githubConfig.repo}/issues/${issueNumber}`;

    logger.info(
        {
            commentId: comment.id,
            issueNumber,
            issueUrl
        },
        'Issue created'
    );

    // Create tracking record
    const trackingRecord = await trackingManager.addRecord({
        type: 'code-comment',
        source: {
            commentId: comment.id,
            filePath: comment.filePath,
            lineNumber: comment.lineNumber
        },
        status: 'pending',
        syncAttempts: 0
    });

    // Mark as synced with snapshot
    trackingRecord.commentSnapshot = createCommentSnapshot(comment);
    await trackingManager.markAsSynced(trackingRecord.id, issueNumber, issueUrl);
    await trackingManager.updateRecord(trackingRecord.id, {
        commentSnapshot: trackingRecord.commentSnapshot
    });

    result.created.push({
        commentId: comment.id,
        type: comment.type,
        filePath: comment.filePath,
        lineNumber: comment.lineNumber,
        issueNumber,
        issueUrl
    });
    result.statistics.created++;
}
