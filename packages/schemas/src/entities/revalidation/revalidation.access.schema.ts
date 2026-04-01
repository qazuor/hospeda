import type { z } from 'zod';
import { RevalidationConfigSchema } from './revalidation-config.schema.js';
import { RevalidationLogSchema } from './revalidation-log.schema.js';

// ============================================================================
// REVALIDATION LOG ACCESS SCHEMAS
// ============================================================================

/**
 * PUBLIC ACCESS SCHEMA — RevalidationLog
 *
 * Contains only the minimum data safe to expose to unauthenticated users.
 * Revalidation logs are operational records; public exposure is limited to
 * structural identification and outcome status — useful for status pages
 * or health dashboards that surface ISR freshness information.
 *
 * Internal trigger sources, user identifiers, and error details are withheld.
 */
export const RevalidationLogPublicSchema = RevalidationLogSchema.pick({
    // Identification
    id: true,

    // What was revalidated
    path: true,
    entityType: true,

    // Outcome
    status: true,

    // When it happened
    createdAt: true
});

export type RevalidationLogPublic = z.infer<typeof RevalidationLogPublicSchema>;

/**
 * PROTECTED ACCESS SCHEMA — RevalidationLog
 *
 * Contains data for authenticated users (e.g., contributors or editors) who
 * need to understand what triggered a revalidation and its performance.
 * Error messages and arbitrary metadata remain admin-only.
 *
 * Extends public fields with trigger context, entity ID, and duration.
 */
export const RevalidationLogProtectedSchema = RevalidationLogSchema.pick({
    // All public fields
    id: true,
    path: true,
    entityType: true,
    status: true,
    createdAt: true,

    // Trigger context (useful for contributors to understand what caused it)
    trigger: true,
    triggeredBy: true,
    entityId: true,

    // Performance metric
    durationMs: true
});

export type RevalidationLogProtected = z.infer<typeof RevalidationLogProtectedSchema>;

/**
 * ADMIN ACCESS SCHEMA — RevalidationLog
 *
 * Contains ALL fields including error messages and arbitrary metadata.
 * Used for admin dashboard, debugging, and monitoring revalidation health.
 *
 * This is essentially the full schema.
 */
export const RevalidationLogAdminSchema = RevalidationLogSchema;

export type RevalidationLogAdmin = z.infer<typeof RevalidationLogAdminSchema>;

// ============================================================================
// REVALIDATION CONFIG ACCESS SCHEMAS
// ============================================================================

/**
 * PUBLIC ACCESS SCHEMA — RevalidationConfig
 *
 * Exposes only whether revalidation is enabled for a given entity type.
 * Scheduling intervals and debounce settings are operational details
 * that are not relevant to public consumers.
 */
export const RevalidationConfigPublicSchema = RevalidationConfigSchema.pick({
    // Identification
    id: true,

    // Entity type this config applies to
    entityType: true,

    // Whether revalidation is active (useful for status pages)
    enabled: true
});

export type RevalidationConfigPublic = z.infer<typeof RevalidationConfigPublicSchema>;

/**
 * PROTECTED ACCESS SCHEMA — RevalidationConfig
 *
 * Contains data for authenticated users who need to understand the cron
 * schedule (e.g., to estimate content freshness). Debounce settings and
 * the auto-revalidate flag remain admin-only operational details.
 *
 * Extends public fields with scheduling information and timestamps.
 */
export const RevalidationConfigProtectedSchema = RevalidationConfigSchema.pick({
    // All public fields
    id: true,
    entityType: true,
    enabled: true,

    // Scheduling info useful for authenticated users to understand freshness
    cronIntervalMinutes: true,

    // Audit timestamps
    createdAt: true,
    updatedAt: true
});

export type RevalidationConfigProtected = z.infer<typeof RevalidationConfigProtectedSchema>;

/**
 * ADMIN ACCESS SCHEMA — RevalidationConfig
 *
 * Contains ALL configuration fields including debounce settings and the
 * auto-revalidate toggle. Used for admin management of ISR revalidation.
 *
 * This is essentially the full schema.
 */
export const RevalidationConfigAdminSchema = RevalidationConfigSchema;

export type RevalidationConfigAdmin = z.infer<typeof RevalidationConfigAdminSchema>;
