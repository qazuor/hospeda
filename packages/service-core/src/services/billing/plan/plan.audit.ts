/**
 * Plan Audit Helpers
 *
 * Utilities for emitting audit log entries and computing field-level diffs
 * for billing plan mutations (create, update, toggle, delete).
 *
 * @module services/billing/plan/plan.audit
 */

import { type DrizzleClient, billingAuditLogs } from '@repo/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Input for inserting a plan audit log entry.
 */
export interface InsertPlanAuditLogInput {
    /** The action performed (e.g. 'plan_created', 'plan_updated', 'plan_deleted') */
    readonly action: string;
    /** UUID of the billing plan */
    readonly planId: string;
    /** Optional actor performing the mutation (admin user id) */
    readonly actorId: string | null;
    /** Changed fields as a key–value snapshot */
    readonly changes: Record<string, unknown> | null;
    /** Previous field values before the mutation */
    readonly previousValues: Record<string, unknown> | null;
    /** Whether the record belongs to live mode */
    readonly livemode: boolean;
}

/**
 * A single changed field in a diff result.
 */
export interface DiffChangedField {
    /** Previous value of the field */
    readonly before: unknown;
    /** New value of the field */
    readonly after: unknown;
}

/**
 * Result of comparing two plan snapshots field by field.
 */
export interface PlanFieldDiff {
    /** Fields present in `after` but absent in `before` */
    readonly added: Record<string, unknown>;
    /** Fields present in `before` but absent in `after` */
    readonly removed: Record<string, unknown>;
    /** Fields present in both snapshots whose values differ */
    readonly changed: Record<string, DiffChangedField>;
}

// ---------------------------------------------------------------------------
// Audit log insert
// ---------------------------------------------------------------------------

/**
 * Inserts a single audit log entry for a billing plan mutation.
 *
 * Uses the provided Drizzle client (`db`) directly so callers can enlist
 * this insert in their existing transaction.
 *
 * @param db - Drizzle client (may be a transaction client)
 * @param input - Audit log data
 * @returns Promise that resolves when the insert is committed
 *
 * @example
 * ```ts
 * await insertPlanAuditLog(db, {
 *   action: 'plan_created',
 *   planId: plan.id,
 *   actorId: 'admin-uuid',
 *   changes: { name: 'owner-basico', active: true },
 *   previousValues: null,
 *   livemode: false,
 * });
 * ```
 */
export async function insertPlanAuditLog(
    db: DrizzleClient,
    input: InsertPlanAuditLogInput
): Promise<void> {
    await db.insert(billingAuditLogs).values({
        action: input.action,
        entityType: 'plan',
        entityId: input.planId,
        actorId: input.actorId,
        actorType: input.actorId ? 'admin' : 'system',
        changes: input.changes as unknown,
        previousValues: input.previousValues as unknown,
        livemode: input.livemode,
        ipAddress: null,
        userAgent: null
    });
}

// ---------------------------------------------------------------------------
// Field-level diff
// ---------------------------------------------------------------------------

/**
 * Computes a field-level diff between two plan snapshots.
 *
 * - Fields in `after` but not in `before` → `added`
 * - Fields in `before` but not in `after` → `removed`
 * - Fields in both with different values → `changed`
 * - Fields that are equal in both are omitted (no-op)
 *
 * Deep equality is determined via `JSON.stringify` for simplicity; callers
 * should normalise values (e.g. sort arrays) before calling if order matters.
 *
 * @param before - Snapshot of the record before the mutation (or null for create)
 * @param after - Snapshot of the record after the mutation (or null for delete)
 * @returns Field-level diff result
 *
 * @example
 * ```ts
 * const diff = diffPlanFields(
 *   { active: true, sortOrder: 1 },
 *   { active: false, sortOrder: 1, newField: 'x' }
 * );
 * // diff.changed = { active: { before: true, after: false } }
 * // diff.added   = { newField: 'x' }
 * // diff.removed = {}
 * ```
 */
export function diffPlanFields(
    before: Record<string, unknown>,
    after: Record<string, unknown>
): PlanFieldDiff {
    const added: Record<string, unknown> = {};
    const removed: Record<string, unknown> = {};
    const changed: Record<string, DiffChangedField> = {};

    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

    for (const key of allKeys) {
        const inBefore = Object.prototype.hasOwnProperty.call(before, key);
        const inAfter = Object.prototype.hasOwnProperty.call(after, key);

        if (!inBefore && inAfter) {
            added[key] = after[key];
        } else if (inBefore && !inAfter) {
            removed[key] = before[key];
        } else if (inBefore && inAfter) {
            // Use JSON.stringify for deep comparison of nested objects/arrays
            if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
                changed[key] = { before: before[key], after: after[key] };
            }
        }
    }

    return { added, removed, changed };
}
