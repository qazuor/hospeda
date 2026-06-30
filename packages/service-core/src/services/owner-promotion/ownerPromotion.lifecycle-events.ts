/**
 * Owner promotion lifecycle event emitter.
 *
 * Centralises `created` and `activated` lifecycle transitions for the
 * owner-promotion domain. Current implementation: structured logging via @repo/logger.
 *
 * SPEC-286 consumers (alerts / notifications) MUST subscribe via the
 * `// TODO(SPEC-286)` stub below — no other call site should be added.
 *
 * @module services/ownerPromotion-lifecycle-events
 */

import { createLogger } from '@repo/logger';

// ─── Event type constants ─────────────────────────────────────────────────────

/**
 * Discriminant string values for every owner-promotion lifecycle transition.
 *
 * Using a `const` object (not an `enum`) keeps values tree-shakeable and lets
 * callers narrow on `event.type` with a strict string literal union.
 */
export const OwnerPromotionLifecycleEventType = {
    CREATED: 'owner_promotion.created',
    ACTIVATED: 'owner_promotion.activated'
} as const;

/** Union of every possible lifecycle event type string. */
export type OwnerPromotionLifecycleEventType =
    (typeof OwnerPromotionLifecycleEventType)[keyof typeof OwnerPromotionLifecycleEventType];

// ─── Event payload interfaces ─────────────────────────────────────────────────

/**
 * Fields shared by every owner-promotion lifecycle event.
 */
interface BaseOwnerPromotionLifecycleEvent {
    /** The specific lifecycle transition that occurred. */
    readonly type: OwnerPromotionLifecycleEventType;
    /** UUID of the affected owner promotion. */
    readonly promotionId: string;
    /** UUID of the promotion owner (user). */
    readonly ownerId: string;
    /** When the event occurred. */
    readonly timestamp: Date;
    /** Optional free-form context for debugging. */
    readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Emitted when a new owner promotion is successfully persisted in the database.
 * Fired from `OwnerPromotionService._afterCreate()`.
 */
export interface OwnerPromotionCreatedEvent extends BaseOwnerPromotionLifecycleEvent {
    readonly type: typeof OwnerPromotionLifecycleEventType.CREATED;
    /** Slug of the newly created promotion. */
    readonly slug: string;
    /** UUID of the accommodation this promotion targets, or null for owner-wide. */
    readonly accommodationId: string | null;
}

/**
 * Emitted when a promotion's `lifecycleState` transitions from a non-ACTIVE
 * state (DRAFT / INACTIVE / ARCHIVED) to ACTIVE.
 *
 * NOT emitted on create-as-ACTIVE (see `OwnerPromotionCreatedEvent`) or on
 * updates that do not change the lifecycle state.
 *
 * Fired from `OwnerPromotionService._afterUpdate()`.
 */
export interface OwnerPromotionActivatedEvent extends BaseOwnerPromotionLifecycleEvent {
    readonly type: typeof OwnerPromotionLifecycleEventType.ACTIVATED;
    /** The lifecycle state the promotion was in BEFORE activation. */
    readonly previousState: string;
}

// ─── Discriminated union ──────────────────────────────────────────────────────

/**
 * Discriminated union of all owner-promotion lifecycle events.
 * Narrow on `event.type` to access event-specific fields.
 */
export type OwnerPromotionLifecycleEvent =
    | OwnerPromotionCreatedEvent
    | OwnerPromotionActivatedEvent;

// ─── Module-level logger ──────────────────────────────────────────────────────

/**
 * Default logger used when no custom logger is injected.
 * Module-scoped so it is only instantiated once.
 */
const defaultLogger = createLogger('owner-promotion-lifecycle');

// ─── Logger interface (minimal surface for testability) ───────────────────────

/**
 * Minimal logger interface accepted by `emitOwnerPromotionLifecycleEvent`.
 *
 * Accepting a narrow interface instead of the full ILogger lets tests pass
 * a no-op stub without depending on `@repo/logger` internals.
 * The signature mirrors `ILogger.info(value, label?)` from `@repo/logger`.
 */
export interface OwnerPromotionLifecycleLogger {
    /** Log a structured value at info level, with an optional label. */
    info(value: unknown, label?: string): void;
}

// ─── Emitter ─────────────────────────────────────────────────────────────────

/**
 * Emits an owner-promotion lifecycle event.
 *
 * Current side-effects:
 * 1. Structured log entry (INFO level) via `@repo/logger` for observability.
 *
 * Future side-effects — add implementation inside the `TODO` blocks:
 * 2. SPEC-286 alert/notification dispatch.
 *
 * Callers MUST NOT handle logging or side-effects themselves. All dispatch
 * is centralised here so adding new channels never requires touching `OwnerPromotionService`.
 *
 * @param event - A fully-typed owner-promotion lifecycle event.
 * @param logger - Optional logger override (useful for testing). Defaults to
 *   the module-level `@repo/logger` instance.
 * @returns Resolves when all dispatch steps have completed.
 *
 * @example
 * ```ts
 * await emitOwnerPromotionLifecycleEvent({
 *   type: OwnerPromotionLifecycleEventType.CREATED,
 *   promotionId: 'promo-uuid',
 *   ownerId: 'owner-uuid',
 *   slug: 'summer-20-off',
 *   accommodationId: null,
 *   timestamp: new Date(),
 * });
 * ```
 */
export async function emitOwnerPromotionLifecycleEvent(
    event: OwnerPromotionLifecycleEvent,
    logger: OwnerPromotionLifecycleLogger = defaultLogger
): Promise<void> {
    const { type, promotionId, ownerId, timestamp } = event;

    // ── 1. Structured logging ────────────────────────────────────────────────
    // Emit a structured log entry so the event is visible in application logs.
    // In production, this feeds into log aggregators (Sentry, Loki, etc.) via
    // the @repo/logger pipeline, consistent with all other service-core events.
    const logData: Record<string, unknown> = {
        event: type,
        promotionId,
        ownerId,
        timestamp: timestamp.toISOString(),
        ...(event.type === OwnerPromotionLifecycleEventType.CREATED
            ? { slug: event.slug, accommodationId: event.accommodationId }
            : { previousState: event.previousState })
    };
    // ILogger convention: logger.info(value, label?) — value is the structured
    // data object, label is the human-readable prefix shown in log output.
    logger.info(logData, '[owner-promotion lifecycle]');

    // ── 2. Alert / notification dispatch (future) ────────────────────────────
    // TODO(SPEC-286): dispatch to alert/notification consumers based on event.type.
    //
    // Example implementation (once SPEC-286 ships):
    //   if (type === OwnerPromotionLifecycleEventType.CREATED) {
    //     await notificationService.send({
    //       type: NotificationType.OWNER_PROMOTION_CREATED,
    //       payload: { promotionId, ownerId, slug: event.slug },
    //     });
    //   } else if (type === OwnerPromotionLifecycleEventType.ACTIVATED) {
    //     await alertService.trigger({
    //       type: AlertType.OWNER_PROMOTION_ACTIVATED,
    //       payload: { promotionId, ownerId, previousState: event.previousState },
    //     });
    //   }
}
