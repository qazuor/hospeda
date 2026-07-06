/**
 * @file env-cross-checks.ts
 * @description Hand-authored cross-app environment variable consistency rules
 * (HOS-79 — Env Var Management Hardening, gap G-3). A cross-check rule
 * declares that two (or more) `(app, key)` pairs MUST hold the SAME value
 * wherever the rule `appliesTo`.
 *
 * Rules are evaluated by:
 *   - `pnpm env:check:rules` (`scripts/check-env-rules.ts`) — each app's local
 *     `.env.local` values, filtered to rules whose `appliesTo` includes `'local'`.
 *   - `hops env-check-rules` (VPS `scripts/server-tools`) — live Coolify env
 *     vars for a given target, filtered to rules whose `appliesTo` includes
 *     `'coolify'`. Reads this module's rules via the committed
 *     `packages/config/generated/env-registry.json` bridge, not a direct
 *     import (that bun-standalone package cannot depend on `@repo/config`).
 *
 * Evaluation MUST always produce a three-state result — `'pass' | 'fail' |
 * 'partial'`, never a boolean (Risk R-2 / AC-3). `'partial'` (at least one
 * referenced side unset) is non-failing everywhere, including Coolify+prod:
 * presence gaps are `env:check:local` / `hops env-reconcile`'s job, not this
 * check's.
 *
 * Add new rules to {@link CROSS_CHECK_RULES} below. Never generate rules from
 * the registry — cross-app consistency is a human judgment call about which
 * vars must match, not something derivable from per-var registry metadata.
 *
 * @module env-cross-checks
 */

import type { AppId } from './env-registry-types.js';

/**
 * One side of a cross-check comparison: a specific env var name as read by a
 * specific app.
 */
export interface CrossCheckCompareTarget {
    /** App that reads this value. */
    readonly app: AppId;
    /** Env var name, as registered in `ENV_REGISTRY`. */
    readonly key: string;
}

/**
 * A single cross-app environment variable consistency rule.
 *
 * @example
 * ```ts
 * const rule: CrossCheckRule = {
 *   id: 'revalidation-secret-api-web-match',
 *   description: 'HOSPEDA_REVALIDATION_SECRET must match between api and web.',
 *   appliesTo: ['local', 'coolify'],
 *   comparator: 'equals',
 *   compare: [
 *     { app: 'api', key: 'HOSPEDA_REVALIDATION_SECRET' },
 *     { app: 'web', key: 'HOSPEDA_REVALIDATION_SECRET' }
 *   ]
 * };
 * ```
 */
export interface CrossCheckRule {
    /** Stable, unique, kebab-case identifier for this rule. */
    readonly id: string;
    /** Human-readable explanation of what this rule verifies and why it matters. */
    readonly description: string;
    /**
     * Which execution context(s) this rule is evaluated in:
     * - `'local'`   — each app's `.env.local`, via `pnpm env:check:rules`.
     * - `'coolify'` — live Coolify env vars for a target, via `hops env-check-rules`.
     */
    readonly appliesTo: readonly ('local' | 'coolify')[];
    /**
     * How the referenced values are compared. Only `'equals'` exists today.
     * Declared as an explicit string literal (rather than left implicit)
     * because the bun-standalone `hops` consumer reads this shape as plain
     * JSON data with no TypeScript types/comments to fall back on.
     */
    readonly comparator: 'equals';
    /** The `(app, key)` pairs whose values must satisfy `comparator`. */
    readonly compare: readonly CrossCheckCompareTarget[];
}

/**
 * All hand-authored cross-check rules. Evaluated by `pnpm env:check:rules`
 * (local, `appliesTo: ['local']`) and `hops env-check-rules` (Coolify,
 * `appliesTo: ['coolify']`).
 *
 * Seeded with the one rule motivated by spec HOS-79 §2 item 2:
 * `HOSPEDA_REVALIDATION_SECRET` must be identical between `apps/api` (which
 * signs the ISR revalidation webhook request) and `apps/web` (which verifies
 * the signature) — a mismatch silently breaks Cloudflare cache revalidation
 * with no error surfaced anywhere today.
 */
export const CROSS_CHECK_RULES: readonly CrossCheckRule[] = [
    {
        id: 'revalidation-secret-api-web-match',
        description:
            'HOSPEDA_REVALIDATION_SECRET must hold the SAME value in both apps/api and ' +
            'apps/web — api signs the ISR revalidation webhook request with this secret ' +
            'and web verifies the signature with it. A mismatch silently breaks Cloudflare ' +
            'cache revalidation with no error surfaced anywhere today (HOS-79 spec §2, item 2).',
        appliesTo: ['local', 'coolify'],
        comparator: 'equals',
        compare: [
            { app: 'api', key: 'HOSPEDA_REVALIDATION_SECRET' },
            { app: 'web', key: 'HOSPEDA_REVALIDATION_SECRET' }
        ]
    }
];
