/**
 * Low-level file operations for tracking data
 *
 * This module provides atomic file read/write operations with
 * backup support and directory creation.
 *
 * @module tracking/file-operations
 */

import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { logger } from '@repo/logger';
import type { TrackingDatabase } from './types';
import { validateTrackingDatabase } from './validation';

/**
 * Error thrown when file operations fail
 */
export class FileOperationError extends Error {
    constructor(
        message: string,
        public readonly operation: string,
        public readonly filePath: string,
        public readonly cause?: Error
    ) {
        super(message);
        this.name = 'FileOperationError';
    }
}

/**
 * Create an empty tracking database
 *
 * @returns Empty tracking database with default values
 */
export function createEmptyDatabase(): TrackingDatabase {
    return {
        version: '1.0.0',
        records: [],
        metadata: {
            lastSync: new Date().toISOString(),
            totalRecords: 0,
            byStatus: {
                pending: 0,
                synced: 0,
                updated: 0,
                failed: 0
            }
        }
    };
}

/**
 * Read and parse tracking file
 *
 * @param filePath - Path to tracking file
 * @returns Parsed tracking database
 * @throws {FileOperationError} If file cannot be read or parsed
 */
export async function readTrackingFile(filePath: string): Promise<TrackingDatabase> {
    try {
        // Check if file exists
        const exists = await access(filePath)
            .then(() => true)
            .catch(() => false);

        if (!exists) {
            logger.info(`Tracking file does not exist, returning empty database: ${filePath}`);
            return createEmptyDatabase();
        }

        // Read file content
        const content = await readFile(filePath, 'utf-8');

        // Parse JSON
        let data: unknown;
        try {
            data = JSON.parse(content);
        } catch (parseError) {
            throw new FileOperationError(
                'Failed to parse JSON',
                'read',
                filePath,
                parseError as Error
            );
        }

        // Validate schema
        try {
            const validated = validateTrackingDatabase(data);
            logger.debug(
                `Successfully read tracking file: ${filePath} (${validated.records.length} records)`
            );
            return validated;
        } catch (validationError) {
            throw new FileOperationError(
                'Invalid tracking database schema',
                'read',
                filePath,
                validationError as Error
            );
        }
    } catch (error) {
        if (error instanceof FileOperationError) {
            throw error;
        }

        throw new FileOperationError(
            `Failed to read tracking file: ${(error as Error).message}`,
            'read',
            filePath,
            error as Error
        );
    }
}

/**
 * Write tracking database to file
 *
 * @param filePath - Path to tracking file
 * @param data - Tracking database to write
 * @throws {FileOperationError} If file cannot be written
 */
export async function writeTrackingFile(filePath: string, data: TrackingDatabase): Promise<void> {
    try {
        // Ensure directory exists
        await ensureDirectory(dirname(filePath));

        // Validate data before writing
        validateTrackingDatabase(data);

        // Format JSON with indentation
        const content = JSON.stringify(data, null, 2);

        // Write to file
        await writeFile(filePath, content, 'utf-8');

        logger.debug(
            `Successfully wrote tracking file: ${filePath} (${data.records.length} records)`
        );
    } catch (error) {
        throw new FileOperationError(
            `Failed to write tracking file: ${(error as Error).message}`,
            'write',
            filePath,
            error as Error
        );
    }
}

/**
 * Create backup of tracking file
 *
 * @param filePath - Path to tracking file
 * @returns Path to backup file, or null if file doesn't exist
 * @throws {FileOperationError} If backup creation fails
 */
export async function createBackup(filePath: string): Promise<string | null> {
    try {
        // Check if file exists
        const exists = await access(filePath)
            .then(() => true)
            .catch(() => false);

        if (!exists) {
            logger.debug(`Skipping backup, file does not exist: ${filePath}`);
            return null;
        }

        const backupPath = `${filePath}.bak`;

        // Copy file to backup
        await copyFile(filePath, backupPath);

        logger.debug(`Created backup file: ${filePath} -> ${backupPath}`);

        return backupPath;
    } catch (error) {
        throw new FileOperationError(
            `Failed to create backup: ${(error as Error).message}`,
            'backup',
            filePath,
            error as Error
        );
    }
}

/**
 * Ensure directory exists, create if it doesn't
 *
 * @param dirPath - Path to directory
 * @throws {FileOperationError} If directory cannot be created
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
    try {
        await mkdir(dirPath, { recursive: true });
    } catch (error) {
        throw new FileOperationError(
            `Failed to create directory: ${(error as Error).message}`,
            'mkdir',
            dirPath,
            error as Error
        );
    }
}
