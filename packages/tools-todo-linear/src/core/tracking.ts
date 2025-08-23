/**
 * Filesystem-based tracking system for TODO comments
 */

import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CommentKey, ParsedComment, TrackedComment, TrackingData } from '../types/index.js';
import logger from '../utils/logger.js';

/**
 * Manages the tracking file for TODO comments
 */
export class TrackingManager {
    private readonly trackingFilePath: string;
    private trackingData: TrackingData;

    constructor(projectRoot: string) {
        this.trackingFilePath = resolve(projectRoot, '.todo-linear-tracking.json');
        this.trackingData = this.loadTrackingData();
    }

    /**
     * Loads tracking data from filesystem or creates empty structure
     */
    private loadTrackingData(): TrackingData {
        if (!existsSync(this.trackingFilePath)) {
            return {
                comments: [],
                lastSync: new Date().toISOString()
            };
        }

        try {
            const content = readFileSync(this.trackingFilePath, 'utf-8');
            return JSON.parse(content) as TrackingData;
        } catch (error) {
            logger.warn(`Warning: Could not parse tracking file, starting fresh: ${error}`);
            return {
                comments: [],
                lastSync: new Date().toISOString()
            };
        }
    }

    /**
     * Saves tracking data to filesystem
     */
    saveTrackingData(): void {
        try {
            const content = JSON.stringify(this.trackingData, null, 4);
            writeFileSync(this.trackingFilePath, content, 'utf-8');
        } catch (error) {
            throw new Error(`Failed to save tracking file: ${error}`);
        }
    }

    /**
     * Gets all tracked comments
     */
    getAllTrackedComments(): TrackedComment[] {
        return this.trackingData.comments;
    }

    /**
     * Finds a tracked comment by Linear issue ID
     */
    findByLinearId(linearId: string): TrackedComment | undefined {
        return this.trackingData.comments.find((comment) => comment.linearId === linearId);
    }

    /**
     * Finds a tracked comment by file path, line, and title
     */
    findByLocation(filePath: string, line: number, title: string): TrackedComment | undefined {
        const normalizedTitle = title.toLowerCase().trim();
        return this.trackingData.comments.find(
            (comment) =>
                comment.filePath === filePath &&
                comment.line === line &&
                comment.title.toLowerCase().trim() === normalizedTitle
        );
    }

    /**
     * Finds tracked comments by title (case-insensitive)
     */
    findByTitle(title: string): TrackedComment[] {
        const normalizedTitle = title.toLowerCase().trim();
        return this.trackingData.comments.filter(
            (comment) => comment.title.toLowerCase().trim() === normalizedTitle
        );
    }

    /**
     * Adds a new tracked comment
     */
    addTrackedComment(comment: TrackedComment): void {
        this.trackingData.comments.push(comment);
    }

    /**
     * Updates an existing tracked comment
     */
    updateTrackedComment(linearId: string, updates: Partial<TrackedComment>): boolean {
        const index = this.trackingData.comments.findIndex(
            (comment) => comment.linearId === linearId
        );
        if (index === -1) {
            return false;
        }

        const existingComment = this.trackingData.comments[index];
        this.trackingData.comments[index] = {
            ...existingComment,
            ...updates,
            // Ensure required fields are not undefined
            linearId: updates.linearId ?? existingComment?.linearId ?? '',
            type: updates.type ?? existingComment?.type ?? 'todo',
            filePath: updates.filePath ?? existingComment?.filePath ?? '',
            line: updates.line ?? existingComment?.line ?? 0,
            title: updates.title ?? existingComment?.title ?? '',
            createdAt: updates.createdAt ?? existingComment?.createdAt ?? '',
            isOrphan: updates.isOrphan ?? existingComment?.isOrphan ?? false,
            updatedAt: new Date().toISOString()
        };
        return true;
    }

    /**
     * Removes a tracked comment by Linear issue ID
     */
    removeTrackedComment(linearId: string): boolean {
        const index = this.trackingData.comments.findIndex(
            (comment) => comment.linearId === linearId
        );
        if (index === -1) {
            return false;
        }

        this.trackingData.comments.splice(index, 1);
        return true;
    }

    /**
     * Removes tracked comments by file path and line
     */
    removeByLocation(filePath: string, line: number): TrackedComment[] {
        const removed: TrackedComment[] = [];
        this.trackingData.comments = this.trackingData.comments.filter((comment) => {
            if (comment.filePath === filePath && comment.line === line) {
                removed.push(comment);
                return false;
            }
            return true;
        });
        return removed;
    }

    /**
     * Marks comments as orphaned
     */
    markAsOrphan(linearId: string): boolean {
        return this.updateTrackedComment(linearId, { isOrphan: true });
    }

    /**
     * Gets all orphaned comments
     */
    getOrphanedComments(): TrackedComment[] {
        return this.trackingData.comments.filter((comment) => comment.isOrphan);
    }

    /**
     * Updates the last sync timestamp
     */
    updateLastSync(): void {
        this.trackingData.lastSync = new Date().toISOString();
    }

    /**
     * Gets the last sync timestamp
     */
    getLastSync(): string {
        return this.trackingData.lastSync;
    }

    /**
     * Clears all tracking data
     */
    clearAll(): void {
        this.trackingData = {
            comments: [],
            lastSync: new Date().toISOString()
        };
    }

    /**
     * Gets tracking file path
     */
    getTrackingFilePath(): string {
        return this.trackingFilePath;
    }

    /**
     * Checks if tracking file exists
     */
    trackingFileExists(): boolean {
        return existsSync(this.trackingFilePath);
    }

    /**
     * Deletes the tracking file from filesystem
     */
    deleteTrackingFile(): void {
        if (existsSync(this.trackingFilePath)) {
            try {
                unlinkSync(this.trackingFilePath);
            } catch (error) {
                throw new Error(`Failed to delete tracking file: ${error}`);
            }
        }
    }

    /**
     * Creates a unique key for a comment
     */
    static createCommentKey(filePath: string, line: number, title: string): CommentKey {
        const normalizedTitle = title.toLowerCase().trim();
        return `${filePath}:${line}:${normalizedTitle}`;
    }

    /**
     * Creates a TrackedComment from a ParsedComment
     */
    static createTrackedComment(comment: ParsedComment, linearId: string): TrackedComment {
        const now = new Date().toISOString();
        return {
            linearId,
            type: comment.type,
            filePath: comment.filePath,
            line: comment.line,
            title: comment.title,
            createdAt: now,
            updatedAt: now,
            isOrphan: false
        };
    }
}
