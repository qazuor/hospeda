/**
 * Validation schemas for tracking data
 *
 * This module provides Zod schemas for validating tracking records
 * and database structures.
 *
 * @module tracking/validation
 */

import { z } from 'zod';

/**
 * Schema for tracking source information
 */
export const trackingSourceSchema = z.object({
    sessionId: z.string().optional(),
    taskId: z.string().optional(),
    commentId: z.string().optional(),
    filePath: z.string().optional(),
    lineNumber: z.number().int().positive().optional()
});

/**
 * Schema for GitHub mapping information
 */
export const gitHubMappingSchema = z.object({
    issueNumber: z.number().int().positive(),
    issueUrl: z.string().url(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime()
});

/**
 * Schema for tracking record type
 */
export const trackingRecordTypeSchema = z.enum(['planning-task', 'code-comment']);

/**
 * Schema for sync status
 */
export const syncStatusSchema = z.enum(['pending', 'synced', 'updated', 'failed']);

/**
 * Schema for a complete tracking record
 */
export const trackingRecordSchema = z.object({
    id: z.string().min(1),
    type: trackingRecordTypeSchema,
    source: trackingSourceSchema,
    github: gitHubMappingSchema.optional(),
    status: syncStatusSchema,
    lastSyncedAt: z.string().datetime().optional(),
    syncAttempts: z.number().int().nonnegative(),
    lastError: z.string().optional(),
    createdAt: z.string().datetime(),
    modifiedAt: z.string().datetime()
});

/**
 * Schema for tracking metadata
 */
export const trackingMetadataSchema = z.object({
    lastSync: z.string().datetime(),
    totalRecords: z.number().int().nonnegative(),
    byStatus: z.object({
        pending: z.number().int().nonnegative(),
        synced: z.number().int().nonnegative(),
        updated: z.number().int().nonnegative(),
        failed: z.number().int().nonnegative()
    })
});

/**
 * Schema for the complete tracking database
 */
export const trackingDatabaseSchema = z.object({
    version: z.string(),
    records: z.array(trackingRecordSchema),
    metadata: trackingMetadataSchema
});

/**
 * Schema for creating a new tracking record
 */
export const createTrackingRecordSchema = trackingRecordSchema.omit({
    id: true,
    createdAt: true,
    modifiedAt: true
});

/**
 * Validate tracking database structure
 *
 * @param data - Data to validate
 * @returns Validated tracking database
 * @throws {z.ZodError} If validation fails
 */
export function validateTrackingDatabase(data: unknown): z.infer<typeof trackingDatabaseSchema> {
    return trackingDatabaseSchema.parse(data);
}

/**
 * Validate tracking record
 *
 * @param data - Data to validate
 * @returns Validated tracking record
 * @throws {z.ZodError} If validation fails
 */
export function validateTrackingRecord(data: unknown): z.infer<typeof trackingRecordSchema> {
    return trackingRecordSchema.parse(data);
}

/**
 * Safe validation that returns success/error result
 *
 * @param data - Data to validate
 * @returns Validation result
 */
export function safeValidateTrackingDatabase(data: unknown): {
    success: boolean;
    data?: z.infer<typeof trackingDatabaseSchema>;
    error?: z.ZodError;
} {
    const result = trackingDatabaseSchema.safeParse(data);

    if (result.success) {
        return { success: true, data: result.data };
    }

    return { success: false, error: result.error };
}
