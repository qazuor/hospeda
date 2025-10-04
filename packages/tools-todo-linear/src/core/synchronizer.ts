import type {
    AIAnalysis,
    ParsedComment,
    SyncLists,
    SyncOperation,
    SyncResult,
    TodoLinearConfig,
    TrackedComment
} from '../types/index.js';
import logger from '../utils/logger.js';
import { FileScanner } from './file-scanner.js';
import { TodoLinearClient } from './linear-client.js';
import { CommentParser } from './parser.js';
import { TrackingManager } from './tracking.js';

/**
 * Orchestrates the synchronization between TODO comments and Linear issues
 */
export class TodoSynchronizer {
    private readonly config: TodoLinearConfig;
    private readonly tracking: TrackingManager;
    private readonly scanner: FileScanner;
    private readonly client: TodoLinearClient;
    private readonly parser: CommentParser;

    constructor(config: TodoLinearConfig) {
        this.config = config;
        this.tracking = new TrackingManager(config.projectRoot);
        this.scanner = new FileScanner(config);
        this.client = new TodoLinearClient(config);
        this.parser = new CommentParser(config.projectRoot);
    }

    /**
     * Performs a full synchronization
     */
    async sync(verbose = false, forceRetryFailed = false): Promise<SyncResult> {
        const startTime = Date.now();
        const operations: SyncOperation[] = [];
        const errors: string[] = [];
        const orphans: string[] = [];
        let allComments: ParsedComment[] = [];

        try {
            logger.progress('🚀 Starting TODO-Linear synchronization...');

            // Step 1: Scan all files for TODO comments
            allComments = await this.scanner.scanAllFiles();

            // Step 1.5: Warm up label cache to avoid duplicate creation errors
            logger.step('⚙️  Warming up label cache...');
            await this.client.warmupCache();

            // Step 2: Classify comments and build sync lists
            const syncLists = await this.classifyComments(allComments, verbose, forceRetryFailed);

            // Step 3: Process AI analysis for all relevant comments
            let aiAnalysisResults = new Map<string, AIAnalysis>();
            if (this.config.ai.enabled) {
                // Extract ParsedComment objects from both arrays
                const commentsToAnalyze = [
                    ...syncLists.toCreate,
                    ...syncLists.toUpdate.map((item) => item.comment)
                ];
                if (commentsToAnalyze.length > 0) {
                    logger.step(
                        `\n🤖 Processing AI analysis for ${commentsToAnalyze.length} comments...`
                    );
                    try {
                        aiAnalysisResults = await this.client.processAIAnalysis(commentsToAnalyze);
                        logger.success(
                            `✅ AI analysis completed for ${aiAnalysisResults.size} comments`
                        );
                    } catch (error) {
                        logger.warn(
                            `⚠️ AI analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
                        );
                    }
                }
            }

            // Step 4: Process CREATE operations
            if (syncLists.toCreate.length > 0) {
                logger.step(`\n📝 Creating ${syncLists.toCreate.length} new issues...`);
                const createOps = await this.processCreateOperations(
                    syncLists.toCreate,
                    verbose,
                    aiAnalysisResults
                );
                operations.push(...createOps);
            }

            // Step 5: Process UPDATE operations
            if (syncLists.toUpdate.length > 0) {
                logger.step(`\n🔄 Updating ${syncLists.toUpdate.length} existing issues...`);
                const updateOps = await this.processUpdateOperations(
                    syncLists.toUpdate,
                    verbose,
                    aiAnalysisResults
                );
                operations.push(...updateOps);
            }

            // Step 5: Process ARCHIVE operations
            if (syncLists.toArchive.length > 0) {
                logger.step(`\n🗂️  Archiving ${syncLists.toArchive.length} removed issues...`);
                const archiveOps = await this.processArchiveOperations(
                    syncLists.toArchive,
                    verbose
                );
                operations.push(...archiveOps);
            }

            // Step 6: Check for orphaned issues
            if (syncLists.orphans.length > 0) {
                logger.step(
                    `\n🔍 Checking ${syncLists.orphans.length} potentially orphaned issues...`
                );
                const orphanedIds = await this.checkOrphanedIssues(syncLists.orphans, verbose);
                orphans.push(...orphanedIds);
            }

            // Step 7: Save tracking data
            this.tracking.updateLastSync();
            this.tracking.saveTrackingData();

            logger.success('\n✅ Synchronization completed successfully!');
        } catch (error) {
            const errorMsg = `Synchronization failed: ${error instanceof Error ? error.message : String(error)}`;
            errors.push(errorMsg);
            logger.error(`❌ ${errorMsg}`);
        }

        const duration = Date.now() - startTime;
        const successful = operations.filter((op) => op.success).length;
        const failed = operations.filter((op) => !op.success).length;
        const skipped = operations.filter((op) => op.skipped).length;

        // Calculate AI statistics
        const aiStats = this.calculateAIStats();

        return {
            operations,
            totalComments: allComments.length,
            successful,
            failed,
            skipped,
            duration,
            orphans,
            errors,
            aiStats
        };
    }

    /**
     * Classifies comments into sync lists
     */
    private async classifyComments(
        allComments: ParsedComment[],
        verbose: boolean,
        forceRetryFailed = false
    ): Promise<SyncLists> {
        const syncLists: SyncLists = {
            toCreate: [],
            toUpdate: [],
            toArchive: [],
            orphans: []
        };

        const trackedComments = this.tracking.getAllTrackedComments();
        const processedTrackedIds = new Set<string>();

        if (verbose) {
            logger.verbose(
                `\n🔍 Classifying ${allComments.length} comments against ${trackedComments.length} tracked entries...`
            );
        }

        // Process each comment from the codebase
        for (const comment of allComments) {
            if (comment.issueId) {
                // Comment has an issue ID
                const tracked = this.tracking.findByLinearId(comment.issueId);

                if (tracked) {
                    // Issue is tracked
                    processedTrackedIds.add(tracked.linearId);

                    const hasChanged = this.hasCommentChanged(comment, tracked);
                    const needsAIRetry = this.needsAIRetry(tracked, forceRetryFailed);

                    if (hasChanged || needsAIRetry) {
                        syncLists.toUpdate.push({ comment, tracked });
                        if (verbose) {
                            const reason = hasChanged ? 'content changed' : 'AI retry needed';
                            logger.verbose(
                                `🔄 UPDATE: ${comment.filePath}:${comment.line} - "${comment.title}" (${reason})`
                            );
                        }
                    } else if (verbose) {
                        logger.verbose(
                            `⏭️  SKIP: ${comment.filePath}:${comment.line} - "${comment.title}" (no changes, AI complete)`
                        );
                    }
                } else {
                    // Issue ID exists in code but not in tracking (orphan)
                    syncLists.orphans.push(comment.issueId);
                    if (verbose) {
                        logger.verbose(
                            `🔍 ORPHAN: ${comment.filePath}:${comment.line} - ID ${comment.issueId}`
                        );
                    }
                }
            } else {
                // Comment has no issue ID - check if it should be tracked
                const tracked = this.tracking.findByLocation(
                    comment.filePath,
                    comment.line,
                    comment.title
                );

                if (tracked) {
                    // Comment exists in tracking but lost its ID - needs update
                    processedTrackedIds.add(tracked.linearId);
                    syncLists.toUpdate.push({ comment, tracked });
                    if (verbose) {
                        logger.verbose(
                            `🔄 UPDATE (re-link): ${comment.filePath}:${comment.line} - "${comment.title}"`
                        );
                    }
                } else {
                    // New comment
                    syncLists.toCreate.push(comment);
                    if (verbose) {
                        logger.verbose(
                            `📝 CREATE: ${comment.filePath}:${comment.line} - "${comment.title}"`
                        );
                    }
                }
            }
        }

        // Find tracked comments that are no longer in the codebase
        for (const tracked of trackedComments) {
            if (!processedTrackedIds.has(tracked.linearId) && !tracked.isOrphan) {
                syncLists.toArchive.push(tracked);
                if (verbose) {
                    logger.verbose(
                        `🗂️  ARCHIVE: ${tracked.filePath}:${tracked.line} - "${tracked.title}"`
                    );
                }
            }
        }

        logger.info('\n📊 Classification complete:');
        logger.info(`   📝 To create: ${syncLists.toCreate.length}`);
        logger.info(`   🔄 To update: ${syncLists.toUpdate.length}`);
        logger.info(`   🗂️  To archive: ${syncLists.toArchive.length}`);
        logger.info(`   🔍 Orphans to check: ${syncLists.orphans.length}`);

        return syncLists;
    }

    /**
     * Checks if a comment has changed compared to tracking
     */
    private hasCommentChanged(comment: ParsedComment, tracked: TrackedComment): boolean {
        return (
            (comment.title?.toLowerCase().trim() || '') !==
                (tracked.title?.toLowerCase().trim() || '') ||
            comment.line !== tracked.line ||
            comment.filePath !== tracked.filePath
        );
    }

    /**
     * Checks if a tracked comment needs AI retry processing
     */
    private needsAIRetry(tracked: TrackedComment, forceRetryFailed = false): boolean {
        const maxRetries = 3; // Match the batch processor config
        const retryCount = tracked.aiRetryCount ?? 0;

        // Check if AI state is PENDING (failed or not yet processed)
        if (tracked.aiState === 'PENDING') {
            return retryCount < maxRetries;
        }

        // Check if AI state is FAILED but still has retries left
        if (tracked.aiState === 'FAILED') {
            // Normal retry: only if hasn't exceeded retry limit
            if (retryCount < maxRetries) {
                return true;
            }

            // Forced retry: even if exceeded limit (when explicitly requested)
            if (forceRetryFailed) {
                return true;
            }
        }

        return false;
    }

    /**
     * Processes CREATE operations
     */
    private async processCreateOperations(
        comments: ParsedComment[],
        verbose: boolean,
        aiAnalysisResults: Map<string, AIAnalysis>
    ): Promise<SyncOperation[]> {
        const operations: SyncOperation[] = [];

        for (const comment of comments) {
            try {
                if (verbose) {
                    logger.verbose(`   📝 Creating issue for: ${comment.filePath}:${comment.line}`);
                }

                // Get AI analysis for this comment if available
                const aiAnalysis = aiAnalysisResults.get(`${comment.filePath}:${comment.line}`);
                const issueId = await this.client.createIssueWithAnalysis(comment, aiAnalysis);

                // Log the creation
                logger.info(
                    `📝 ${comment.title} (${comment.filePath}:${comment.line}) -> ${this.generateLinearUrl(issueId)}`
                );
                if (verbose) {
                    logger.verbose(`   ✅ Created issue ${issueId} successfully`);
                }

                // Update comment in file with issue ID
                await this.parser.updateCommentInFile(comment, issueId);

                // Add to tracking
                const trackedComment = TrackingManager.createTrackedComment(comment, issueId);
                this.tracking.addTrackedComment(trackedComment);

                // Update AI state based on whether AI was processed for this comment in this sync
                if (this.config.ai.enabled) {
                    // Check if this comment was processed with AI in this sync
                    const aiAnalysis = aiAnalysisResults.get(`${comment.filePath}:${comment.line}`);
                    if (aiAnalysis) {
                        // AI analysis was successful for this comment
                        this.tracking.updateAIState(issueId, 'COMPLETED', 0);
                    } else {
                        // AI is enabled but this comment wasn't processed (maybe batch processing failed)
                        // Set to PENDING so it will be processed in future syncs
                        this.tracking.updateAIState(issueId, 'PENDING', 0);
                    }
                } else {
                    // If AI is globally disabled, mark as skipped
                    this.tracking.updateAIState(issueId, 'SKIPPED', 0);
                }

                operations.push({
                    type: 'create',
                    comment,
                    issueId,
                    success: true
                });

                if (verbose) {
                    logger.verbose(`   ✅ Created issue ${issueId}`);
                }
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                operations.push({
                    type: 'create',
                    comment,
                    issueId: '',
                    success: false,
                    error: errorMsg
                });

                logger.error(
                    `   ❌ Failed to create issue for ${comment.filePath}:${comment.line}: ${errorMsg}`
                );
            }
        }

        return operations;
    }

    /**
     * Processes UPDATE operations
     */
    private async processUpdateOperations(
        updates: Array<{ comment: ParsedComment; tracked: TrackedComment }>,
        verbose: boolean,
        aiAnalysisResults: Map<string, AIAnalysis>
    ): Promise<SyncOperation[]> {
        const operations: SyncOperation[] = [];

        for (const { comment, tracked } of updates) {
            try {
                if (verbose) {
                    logger.verbose(
                        `   🔄 Updating issue ${tracked.linearId} for: ${comment.filePath}:${comment.line}`
                    );
                }

                // Update issue in Linear
                const commentWithId = { ...comment, issueId: tracked.linearId };
                const aiAnalysis = aiAnalysisResults.get(`${comment.filePath}:${comment.line}`);
                await this.client.updateIssueWithAnalysis(commentWithId, aiAnalysis, this.tracking);

                // Log the update
                logger.info(
                    `🔄 ${comment.title} (${comment.filePath}:${comment.line}) -> ${this.generateLinearUrl(tracked.linearId)}`
                );
                if (verbose) {
                    logger.verbose(`   ✅ Updated issue ${tracked.linearId} successfully`);
                }

                // Update comment in file if it doesn't have the ID
                if (!comment.issueId) {
                    await this.parser.updateCommentInFile(comment, tracked.linearId);
                }

                // Update tracking
                this.tracking.updateTrackedComment(tracked.linearId, {
                    filePath: comment.filePath,
                    line: comment.line,
                    title: comment.title,
                    type: comment.type
                });

                // Update AI state based on whether AI was processed for this comment in this sync
                if (this.config.ai.enabled) {
                    if (aiAnalysis) {
                        // AI analysis was successful for this comment
                        this.tracking.updateAIState(tracked.linearId, 'COMPLETED', 0);
                    } else {
                        // AI is enabled but this comment wasn't processed (maybe batch processing failed)
                        // Increment retry count but keep as PENDING for future attempts
                        const currentRetryCount = tracked.aiRetryCount ?? 0;
                        this.tracking.updateAIState(
                            tracked.linearId,
                            'PENDING',
                            currentRetryCount + 1
                        );
                    }
                }

                operations.push({
                    type: 'update',
                    comment,
                    issueId: tracked.linearId,
                    success: true
                });

                if (verbose) {
                    logger.verbose(`   ✅ Updated issue ${tracked.linearId}`);
                }
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                operations.push({
                    type: 'update',
                    comment,
                    issueId: tracked.linearId,
                    success: false,
                    error: errorMsg
                });

                logger.error(`   ❌ Failed to update issue ${tracked.linearId}: ${errorMsg}`);
            }
        }

        return operations;
    }

    /**
     * Processes ARCHIVE operations
     */
    private async processArchiveOperations(
        comments: TrackedComment[],
        verbose: boolean
    ): Promise<SyncOperation[]> {
        const operations: SyncOperation[] = [];

        for (const tracked of comments) {
            try {
                if (verbose) {
                    logger.verbose(
                        `   🗂️  Archiving issue ${tracked.linearId} for: ${tracked.filePath}:${tracked.line}`
                    );
                }

                await this.client.archiveIssue(tracked.linearId);

                // Log the archive
                logger.info(
                    `🗂️ ${tracked.title} (${tracked.filePath}:${tracked.line}) -> ${tracked.linearId}`
                );
                if (verbose) {
                    logger.verbose(`   ✅ Archived issue ${tracked.linearId} successfully`);
                }

                // Remove from tracking
                this.tracking.removeTrackedComment(tracked.linearId);

                // Create a placeholder comment for the operation result
                const placeholderComment: ParsedComment = {
                    type: tracked.type,
                    filePath: tracked.filePath,
                    line: tracked.line,
                    title: tracked.title
                };

                operations.push({
                    type: 'archive',
                    comment: placeholderComment,
                    issueId: tracked.linearId,
                    success: true
                });

                if (verbose) {
                    logger.verbose(`   ✅ Archived issue ${tracked.linearId}`);
                }
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);

                const placeholderComment: ParsedComment = {
                    type: tracked.type,
                    filePath: tracked.filePath,
                    line: tracked.line,
                    title: tracked.title
                };

                operations.push({
                    type: 'archive',
                    comment: placeholderComment,
                    issueId: tracked.linearId,
                    success: false,
                    error: errorMsg
                });

                logger.error(`   ❌ Failed to archive issue ${tracked.linearId}: ${errorMsg}`);
            }
        }

        return operations;
    }

    /**
     * Checks for orphaned issues
     */
    private async checkOrphanedIssues(issueIds: string[], verbose: boolean): Promise<string[]> {
        const orphanedIds: string[] = [];

        for (const issueId of issueIds) {
            try {
                const exists = await this.client.issueExists(issueId);

                if (!exists) {
                    orphanedIds.push(issueId);
                    if (verbose) {
                        logger.verbose(`   🔍 Confirmed orphan: ${issueId}`);
                    }
                } else if (verbose) {
                    logger.verbose(`   ✅ Issue exists: ${issueId}`);
                }
            } catch (error) {
                logger.warn(`   ⚠️  Could not check issue ${issueId}: ${error}`);
            }
        }

        if (orphanedIds.length > 0) {
            logger.warn('\n⚠️  Orphaned issue IDs found:');
            for (const issueId of orphanedIds) {
                logger.warn(`   • ${issueId} (no longer exists in Linear)`);
            }
            logger.warn('\n💡 Run `pnpm todo:clean --id <ID>` to clean specific IDs');
            logger.warn('   or `pnpm todo:clean --all` to clean all orphaned IDs');
        }

        return orphanedIds;
    }

    /**
     * Gets synchronization statistics
     */
    async getStats() {
        const trackedComments = this.tracking.getAllTrackedComments();
        const lastSync = this.tracking.getLastSync();

        return {
            trackedComments: trackedComments.length,
            orphanedComments: trackedComments.filter((c) => c.isOrphan).length,
            lastSync,
            trackingFileExists: this.tracking.trackingFileExists()
        };
    }

    /**
     * Calculates AI processing statistics from tracking data
     */
    private calculateAIStats() {
        const trackedComments = this.tracking.getAllTrackedComments();

        const stats = {
            total: 0,
            completed: 0,
            pending: 0,
            failed: 0,
            disabled: 0,
            skipped: 0
        };

        for (const comment of trackedComments) {
            if (comment.aiState) {
                stats.total++;
                switch (comment.aiState) {
                    case 'COMPLETED':
                        stats.completed++;
                        break;
                    case 'PENDING':
                        stats.pending++;
                        break;
                    case 'FAILED':
                        stats.failed++;
                        break;
                    case 'DISABLED':
                        stats.disabled++;
                        break;
                    case 'SKIPPED':
                        stats.skipped++;
                        break;
                }
            }
        }

        return stats;
    }

    /**
     * Generates a Linear issue URL from an issue ID
     */
    private generateLinearUrl(issueId: string): string {
        return `https://linear.app/issue/${issueId}`;
    }
}
