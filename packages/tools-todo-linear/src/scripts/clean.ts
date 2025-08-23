#!/usr/bin/env node
import { glob } from 'glob';
import { findProjectRoot } from '../config/config.js';
import { CommentParser } from '../core/parser.js';
import { TrackingManager } from '../core/tracking.js';
import logger from '../utils/logger.js';

type CleanOptions = {
    all: boolean;
    issueId?: string;
};

async function main() {
    logger.info('🧹 TODO-Linear Clean v2');
    logger.info('Cleaning orphaned TODO IDs...\n');

    try {
        // Parse command line arguments
        const options = parseArguments();

        // Find project root
        const projectRoot = findProjectRoot();
        logger.info(`📁 Project root: ${projectRoot}`);

        if (options.all) {
            await cleanAll(projectRoot);
        } else if (options.issueId) {
            await cleanSpecificId(projectRoot, options.issueId);
        } else {
            showUsage();
            process.exit(1);
        }

        logger.success('\n✅ Cleaning completed!');
    } catch (error) {
        logger.error('💥 Fatal error:', error);
        process.exit(1);
    }
}

/**
 * Parses command line arguments
 */
function parseArguments(): CleanOptions {
    const args = process.argv.slice(2);

    if (args.includes('--all')) {
        return { all: true };
    }

    const idIndex = args.findIndex((arg) => arg === '--id');
    if (idIndex !== -1 && args[idIndex + 1]) {
        return { all: false, issueId: args[idIndex + 1] };
    }

    return { all: false };
}

/**
 * Shows usage information
 */
function showUsage() {
    logger.info('Usage:');
    logger.info('  pnpm todo:clean --all           # Clean all orphaned IDs and reset tracking');
    logger.info('  pnpm todo:clean --id <ID>       # Clean specific issue ID');
    logger.info('\nExamples:');
    logger.info('  pnpm todo:clean --all');
    logger.info('  pnpm todo:clean --id abc-123-def-456');
}

/**
 * Cleans all orphaned IDs and resets tracking
 */
async function cleanAll(projectRoot: string) {
    logger.progress('🧹 Cleaning all TODO IDs and resetting tracking...');

    // Step 1: Delete tracking file
    const tracking = new TrackingManager(projectRoot);
    if (tracking.trackingFileExists()) {
        logger.info('📂 Deleting tracking file...');
        tracking.deleteTrackingFile();
        logger.success('✅ Tracking file deleted');
    } else {
        logger.info('📂 No tracking file found');
    }

    // Step 2: Find all files with TODO comments
    logger.progress('🔍 Scanning for TODO comments with IDs...');
    const files = await findAllSourceFiles(projectRoot);

    let totalCleaned = 0;
    const parser = new CommentParser(projectRoot);

    for (const file of files) {
        try {
            const comments = parser.parseFile(file);
            const commentsWithIds = comments.filter((c) => c.issueId);

            if (commentsWithIds.length > 0) {
                logger.info(`📝 Cleaning ${commentsWithIds.length} IDs from ${file}`);

                for (const comment of commentsWithIds) {
                    await parser.removeIssueIdFromFile(comment);
                    totalCleaned++;
                }
            }
        } catch (error) {
            logger.warn(`⚠️  Could not process file ${file}: ${error}`);
        }
    }

    logger.success(`✅ Cleaned ${totalCleaned} TODO IDs from ${files.length} files`);
}

/**
 * Cleans a specific issue ID
 */
async function cleanSpecificId(projectRoot: string, issueId: string) {
    logger.progress(`🧹 Cleaning specific issue ID: ${issueId}`);

    const tracking = new TrackingManager(projectRoot);

    // Step 1: Find the issue in tracking
    const trackedComment = tracking.findByLinearId(issueId);

    if (!trackedComment) {
        logger.error(`❌ Issue ID ${issueId} not found in tracking file`);
        process.exit(1);
    }

    logger.info(`📍 Found issue in tracking: ${trackedComment.filePath}:${trackedComment.line}`);

    // Step 2: Remove ID from code
    try {
        const parser = new CommentParser(projectRoot);
        const filePath = trackedComment.filePath.startsWith('/')
            ? trackedComment.filePath
            : `${projectRoot}/${trackedComment.filePath}`;

        // Parse the file to find the exact comment
        const comments = parser.parseFile(filePath);
        const targetComment = comments.find(
            (c) => c.line === trackedComment.line && c.issueId === issueId
        );

        if (targetComment) {
            await parser.removeIssueIdFromFile(targetComment);
            logger.success(`✅ Removed ID from ${trackedComment.filePath}:${trackedComment.line}`);
        } else {
            logger.warn(`⚠️  Could not find comment with ID ${issueId} at expected location`);
        }
    } catch (error) {
        logger.error(`❌ Failed to remove ID from code: ${error}`);
    }

    // Step 3: Remove from tracking
    const removed = tracking.removeTrackedComment(issueId);
    if (removed) {
        tracking.saveTrackingData();
        logger.success('✅ Removed from tracking file');
    } else {
        logger.warn('⚠️  Could not remove from tracking file');
    }
}

/**
 * Finds all source files in the project
 */
async function findAllSourceFiles(projectRoot: string): Promise<string[]> {
    const patterns = [
        '**/*.{ts,tsx,js,jsx,vue,svelte,py,rb,php,java,c,cpp,h,hpp,cs,go,rs,swift,kt}'
    ];

    const excludePatterns = [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.git/**',
        '**/coverage/**',
        '**/*.min.js',
        '**/*.bundle.js'
    ];

    const allFiles: Set<string> = new Set();

    for (const pattern of patterns) {
        try {
            const files = await glob(pattern, {
                cwd: projectRoot,
                ignore: excludePatterns,
                absolute: true,
                nodir: true
            });
            for (const file of files) {
                allFiles.add(file);
            }
        } catch (error) {
            logger.warn(`Warning: Failed to scan pattern ${pattern}: ${error}`);
        }
    }

    return Array.from(allFiles).sort();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((error) => {
        logger.error('💥 Unhandled error:', error);
        process.exit(1);
    });
}
