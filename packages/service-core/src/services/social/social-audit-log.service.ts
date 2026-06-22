/**
 * @file social-audit-log.service.ts
 *
 * Append-only audit logging service for the social publishing pipeline.
 *
 * This service writes rows to `social_audit_log` and is designed to
 * NEVER throw or propagate errors to the caller — audit logging must
 * never break a state-transition flow.
 *
 * @see SPEC-254 T-032
 */

import type { SocialAuditLogModel as SocialAuditLogModelType } from '@repo/db';
import { SocialAuditLogModel } from '@repo/db';
import type { ServiceConfig } from '../../types';
import { serviceLogger } from '../../utils/service-logger';
import type { ServiceLogger } from '../../utils/service-logger';

// ---------------------------------------------------------------------------
// Audit event constants
// ---------------------------------------------------------------------------

/**
 * Enumeration of all semantic audit event types for the social publishing
 * pipeline. Consumed by `SocialAuditLogService.log()` and by every service
 * that performs state transitions (T-033, T-034, T-035, T-036).
 *
 * Keys are ordered by lifecycle phase:
 *   ingestion → review → schedule → publish → recurrence → platform config → settings
 */
export const SocialAuditEvent = {
    // ---- Ingestion -----------------------------------------------------------
    /** A GPT draft was ingested and a `social_posts` row was created. */
    POST_INGESTED: 'POST_INGESTED',

    // ---- Editorial review ----------------------------------------------------
    /** A post was approved: status → APPROVED, approvalStatus → APPROVED. */
    POST_APPROVED: 'POST_APPROVED',
    /** A post was rejected: approvalStatus → REJECTED. */
    POST_REJECTED: 'POST_REJECTED',
    /** Admin requested changes on a post: approvalStatus → CHANGES_REQUESTED. */
    POST_CHANGES_REQUESTED: 'POST_CHANGES_REQUESTED',

    // ---- Scheduling ----------------------------------------------------------
    /** A post was scheduled for a future date-time: status → SCHEDULED. */
    POST_SCHEDULED: 'POST_SCHEDULED',
    /** A previously-scheduled post had its scheduled_at changed. */
    POST_RESCHEDULED: 'POST_RESCHEDULED',
    /** An approved post was marked ready for immediate dispatch: status → READY_TO_PUBLISH. */
    POST_MARKED_READY: 'POST_MARKED_READY',

    // ---- Pause / unpause -----------------------------------------------------
    /** A post was paused: paused → true. */
    POST_PAUSED: 'POST_PAUSED',
    /** A post was unpaused: paused → false. */
    POST_UNPAUSED: 'POST_UNPAUSED',

    // ---- Archive -------------------------------------------------------------
    /** A post was archived: status → ARCHIVED, deleted_at set. */
    POST_ARCHIVED: 'POST_ARCHIVED',

    // ---- Dispatch / publish --------------------------------------------------
    /**
     * A target reached its retry limit (retry_count >= 3) after a dispatch
     * failure: target status → FAILED.
     */
    TARGET_DISPATCH_FAILED_EXHAUSTED: 'TARGET_DISPATCH_FAILED_EXHAUSTED',
    /** Make.com reported a successful publish for a target: status → PUBLISHED. */
    TARGET_PUBLISHED: 'TARGET_PUBLISHED',
    /** Make.com reported a failed publish for a target. */
    TARGET_PUBLISH_FAILED: 'TARGET_PUBLISH_FAILED',

    // ---- Recurrence ----------------------------------------------------------
    /**
     * The recurrence engine rearmed a post after all targets completed,
     * resetting targets to APPROVED and computing next_run_at.
     */
    POST_RECURRENCE_REARMED: 'POST_RECURRENCE_REARMED',

    // ---- Hashtag management --------------------------------------------------
    /**
     * A hashtag was promoted from a draft/suggestion to the active catalog.
     */
    HASHTAG_PROMOTED: 'HASHTAG_PROMOTED',

    // ---- Platform format configuration ---------------------------------------
    /**
     * A `social_platform_formats` row was updated (caption length, channel key,
     * enabled flag, etc.).
     */
    PLATFORM_FORMAT_UPDATED: 'PLATFORM_FORMAT_UPDATED',

    // ---- Settings ------------------------------------------------------------
    /** A `social_settings` key-value pair was updated. */
    SETTING_UPDATED: 'SETTING_UPDATED'
} as const;

/**
 * Union type of all valid audit event string values.
 *
 * @example
 * ```ts
 * const event: SocialAuditEventType = SocialAuditEvent.POST_APPROVED;
 * ```
 */
export type SocialAuditEventType = (typeof SocialAuditEvent)[keyof typeof SocialAuditEvent];

// ---------------------------------------------------------------------------
// Input / output types
// ---------------------------------------------------------------------------

/**
 * Input for {@link SocialAuditLogService.log}.
 */
export interface SocialAuditLogInput {
    /**
     * UUID of the acting user. Pass `null` (or omit) for system / cron events
     * that have no human actor.
     */
    readonly actorId?: string | null;
    /** Semantic event type — use a value from {@link SocialAuditEvent}. */
    readonly eventType: SocialAuditEventType;
    /**
     * The kind of entity being audited (e.g. `"social_post"`,
     * `"social_post_target"`, `"social_hashtag"`).
     */
    readonly entityType: string;
    /** UUID (or other stable identifier) of the entity being audited. */
    readonly entityId: string;
    /** Entity state before the transition. Omit / pass `null` for creation events. */
    readonly oldValue?: Record<string, unknown> | null;
    /** Entity state after the transition. */
    readonly newValue?: Record<string, unknown> | null;
    /** Extra context (reason, feedback, warnings, etc.). */
    readonly metadata?: Record<string, unknown> | null;
}

/**
 * Return value of {@link SocialAuditLogService.log}.
 *
 * - `logged: true` — the row was inserted successfully.
 * - `logged: false` — the insert failed; the error was swallowed so the
 *   calling flow continues uninterrupted.
 */
export interface SocialAuditLogResult {
    readonly logged: boolean;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Append-only audit logging service for the social publishing pipeline.
 *
 * ## Behavior contract
 * - `log()` NEVER throws. All DB errors are caught, logged at `warn` level,
 *   and swallowed. The calling state-transition service must not be broken
 *   by an audit-log failure.
 * - Rows are insert-only. There is no update/delete API.
 * - `actorId` defaults to `null` when omitted — used for cron/system events.
 *
 * ## Usage
 * ```ts
 * const auditLog = new SocialAuditLogService({});
 *
 * // In an approval handler:
 * await auditLog.log({
 *   actorId: admin.id,
 *   eventType: SocialAuditEvent.POST_APPROVED,
 *   entityType: 'social_post',
 *   entityId: post.id,
 *   oldValue: { status: 'NEEDS_REVIEW', approvalStatus: 'PENDING' },
 *   newValue: { status: 'APPROVED', approvalStatus: 'APPROVED' },
 * });
 * ```
 *
 * SPEC-254 T-032.
 */
export class SocialAuditLogService {
    private readonly model: SocialAuditLogModelType;
    private readonly logger: ServiceLogger;

    constructor(_config: ServiceConfig, model?: SocialAuditLogModelType) {
        this.model = model ?? new SocialAuditLogModel();
        this.logger = serviceLogger;
    }

    // ---------------------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------------------

    /**
     * Writes an append-only audit event row to `social_audit_log`.
     *
     * This method NEVER throws. On any DB error it logs a warning and returns
     * `{ logged: false }` so that the calling flow is not interrupted.
     *
     * @param input - Audit event details (actor, event type, entity, old/new state).
     * @returns `{ logged: true }` on success, `{ logged: false }` on failure.
     *
     * @example
     * ```ts
     * const result = await service.log({
     *   actorId: 'user-uuid',
     *   eventType: SocialAuditEvent.POST_REJECTED,
     *   entityType: 'social_post',
     *   entityId: 'post-uuid',
     *   metadata: { reason: 'Off-brand content' },
     * });
     * // result.logged === true on success; false if DB is temporarily unavailable
     * ```
     */
    public async log(input: SocialAuditLogInput): Promise<SocialAuditLogResult> {
        const { actorId, eventType, entityType, entityId, oldValue, newValue, metadata } = input;

        try {
            await this.model.create({
                actorId: actorId ?? null,
                eventType,
                entityType,
                entityId,
                oldValueJson: oldValue ?? undefined,
                newValueJson: newValue ?? undefined,
                metadataJson: metadata ?? undefined
            });
            return { logged: true };
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.warn(
                { error: message, eventType, entityId },
                'SocialAuditLogService.log: failed to write audit row; swallowing error'
            );
            return { logged: false };
        }
    }
}
