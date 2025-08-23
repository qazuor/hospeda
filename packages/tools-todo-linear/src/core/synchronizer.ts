import type {
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
    async sync(verbose = false): Promise<SyncResult> {
        const startTime = Date.now();
        const operations: SyncOperation[] = [];
        const errors: string[] = [];
        const orphans: string[] = [];
        let allComments: ParsedComment[] = [];

        try {
            logger.progress('🚀 Starting TODO-Linear synchronization...');

            // Step 1: Scan all files for TODO comments
            allComments = await this.scanner.scanAllFiles();

            // Step 2: Classify comments and build sync lists
            const syncLists = await this.classifyComments(allComments, verbose);

            // Step 3: Process CREATE operations
            if (syncLists.toCreate.length > 0) {
                logger.step(`\n📝 Creating ${syncLists.toCreate.length} new issues...`);
                const createOps = await this.processCreateOperations(syncLists.toCreate, verbose);
                operations.push(...createOps);
            }

            // Step 4: Process UPDATE operations
            if (syncLists.toUpdate.length > 0) {
                logger.step(`\n🔄 Updating ${syncLists.toUpdate.length} existing issues...`);
                const updateOps = await this.processUpdateOperations(syncLists.toUpdate, verbose);
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

        return {
            operations,
            totalComments: allComments.length,
            successful,
            failed,
            skipped,
            duration,
            orphans,
            errors
        };
    }

    /**
     * Classifies comments into sync lists
     */
    private async classifyComments(
        allComments: ParsedComment[],
        verbose: boolean
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

                    if (this.hasCommentChanged(comment, tracked)) {
                        syncLists.toUpdate.push({ comment, tracked });
                        if (verbose) {
                            logger.verbose(
                                `🔄 UPDATE: ${comment.filePath}:${comment.line} - "${comment.title}"`
                            );
                        }
                    } else if (verbose) {
                        logger.verbose(
                            `⏭️  SKIP: ${comment.filePath}:${comment.line} - "${comment.title}" (no changes)`
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
            comment.title.toLowerCase().trim() !== tracked.title.toLowerCase().trim() ||
            comment.line !== tracked.line ||
            comment.filePath !== tracked.filePath
        );
    }

    /**
     * Processes CREATE operations
     */
    private async processCreateOperations(
        comments: ParsedComment[],
        verbose: boolean
    ): Promise<SyncOperation[]> {
        const operations: SyncOperation[] = [];

        for (const comment of comments) {
            try {
                if (verbose) {
                    logger.verbose(`   📝 Creating issue for: ${comment.filePath}:${comment.line}`);
                }

                const issueId = await this.client.createIssue(comment);

                // Log the creation
                logger.info(
                    `📝 ${comment.title} (${comment.filePath}:${comment.line}) -> ${issueId}`
                );
                if (verbose) {
                    logger.verbose(`   ✅ Created issue ${issueId} successfully`);
                }

                // Update comment in file with issue ID
                await this.parser.updateCommentInFile(comment, issueId);

                // Add to tracking
                const trackedComment = TrackingManager.createTrackedComment(comment, issueId);
                this.tracking.addTrackedComment(trackedComment);

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
        verbose: boolean
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
                await this.client.updateIssue(commentWithId);

                // Log the update
                logger.info(
                    `🔄 ${comment.title} (${comment.filePath}:${comment.line}) -> ${tracked.linearId}`
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
}
