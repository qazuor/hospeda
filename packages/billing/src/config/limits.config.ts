/**
 * Structural limit metadata for the Hospeda billing system.
 *
 * ---
 * STRUCTURAL DEFINITION — CODE-LEVEL ONLY (SPEC-192 T-030 / ADR-030)
 *
 * `LIMIT_METADATA` is NOT DB-backed and is intentionally NOT part of the
 * billing catalog that was migrated to the database in SPEC-168 / SPEC-192.
 *
 * It is tightly coupled to the `LimitKey` TypeScript enum. Each entry in
 * this `Record<LimitKey, ...>` is exhaustively type-checked against the enum
 * — a new limit key is a compilation error until its metadata is added here.
 *
 * Rationale:
 *   - Limit keys appear in plan entitlement checks, addon recalculation, and
 *     usage-tracking service display names. A DB-only registry would lose
 *     compile-time exhaustiveness.
 *   - Actual per-plan limit *values* live in `plans.config.ts` (code-level,
 *     seeded to DB). This file holds only human-readable metadata (name,
 *     description) for each key — the admin UI and usage service consume it.
 *   - The seeder (`packages/seed/src/required/billingLimits.seed.ts`) reads
 *     this record to populate the `billing_limits` lookup table, but that
 *     table reflects this file — not an independent source.
 *
 * Consumers:
 *   - Seed package (divergence-respecting, never overwrites runtime edits)
 *   - Admin UI (`PlanDialog.tsx` limit picker)
 *   - API usage-tracking service (display names in threshold notifications)
 *   - `plans.config.ts` (getDefaultEntitlements / getUnlimitedEntitlements helpers)
 * ---
 *
 * @module config/limits
 */

import { LimitKey } from '../types/plan.types.js';

/**
 * Human-readable metadata for each structural limit key.
 *
 * Exhaustively typed against `LimitKey` — see module JSDoc banner above.
 */
export const LIMIT_METADATA: Record<LimitKey, { name: string; description: string }> = {
    [LimitKey.MAX_ACCOMMODATIONS]: {
        name: 'Maximum accommodations',
        description: 'Maximum number of accommodations that can be published'
    },
    [LimitKey.MAX_PHOTOS_PER_ACCOMMODATION]: {
        name: 'Photos per accommodation',
        description: 'Maximum number of photos per accommodation'
    },
    [LimitKey.MAX_ACTIVE_PROMOTIONS]: {
        name: 'Active promotions',
        description: 'Maximum number of active promotions simultaneously'
    },
    [LimitKey.MAX_FAVORITES]: {
        name: 'Favorites',
        description: 'Maximum number of accommodations saved as favorites'
    },
    [LimitKey.MAX_PROPERTIES]: {
        name: 'Properties',
        description: 'Maximum number of properties in a complex'
    },
    [LimitKey.MAX_STAFF_ACCOUNTS]: {
        name: 'Staff accounts',
        description: 'Maximum number of staff accounts per complex'
    },
    [LimitKey.MAX_ACTIVE_ALERTS]: {
        name: 'Active price alerts',
        description: 'Maximum number of active price-alert subscriptions'
    },
    [LimitKey.MAX_COMPARE_ITEMS]: {
        name: 'Compare items',
        description: 'Maximum number of accommodations that can be compared simultaneously'
    },
    // AI usage limits (SPEC-173)
    [LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH]: {
        name: 'AI text improvements per month',
        description: 'Maximum number of AI text improvement requests allowed per calendar month'
    },
    [LimitKey.MAX_AI_CHAT_PER_MONTH]: {
        name: 'AI chat interactions per month',
        description: 'Maximum number of AI chat assistant interactions allowed per calendar month'
    },
    [LimitKey.MAX_AI_SEARCH_PER_MONTH]: {
        name: 'AI search queries per month',
        description: 'Maximum number of AI-powered search queries allowed per calendar month'
    },
    [LimitKey.MAX_AI_SUPPORT_PER_MONTH]: {
        name: 'AI support interactions per month',
        description:
            'Maximum number of AI support assistant interactions allowed per calendar month'
    },
    [LimitKey.MAX_AI_TRANSLATE_PER_MONTH]: {
        name: 'AI translations per month',
        description:
            'Maximum number of AI content translation requests allowed per calendar month'
    }
};
