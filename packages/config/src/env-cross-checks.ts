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
    },
    {
        id: 'internal-request-secret-api-web-match',
        description:
            'HOSPEDA_INTERNAL_REQUEST_SECRET must hold the SAME value in both apps/api and ' +
            'apps/web — web sends it as the X-Internal-Request header on SSR fetches and api ' +
            'exempts matching requests from the public rate limit. A mismatch silently breaks ' +
            'the exemption: SSR traffic is rate-limited again and the public tier re-exhausts, ' +
            'with no error surfaced anywhere (HOS-103). Empty on both sides is a valid ' +
            '"feature disabled" state, so this is only enforced when both are set (partial = pass).',
        appliesTo: ['local', 'coolify'],
        comparator: 'equals',
        compare: [
            { app: 'api', key: 'HOSPEDA_INTERNAL_REQUEST_SECRET' },
            { app: 'web', key: 'HOSPEDA_INTERNAL_REQUEST_SECRET' }
        ]
    },
    {
        /*
         * HOS-1153 — a SECOND rule, deliberately NOT a third side on the rule
         * above.
         *
         * `evaluateCrossCheckRule` short-circuits to `partial` ("not a
         * failure") the moment ANY referenced side is unset. Adding admin to
         * the api/web rule would therefore have switched that rule OFF for as
         * long as the admin's value is missing — which is exactly the
         * post-merge window HOS-1153 opens, before an operator sets the var in
         * Coolify. An api/web rotation mismatch landing in that window is the
         * HOS-155 incident (2026-07-13), and it would have gone green.
         *
         * Split in two, each pair is judged on its own: api↔web keeps failing
         * on a divergence no matter what admin holds, and api↔admin reports
         * `partial` until the admin side exists. Equality is transitive, so
         * api==web plus api==admin still gives web==admin — no coverage is lost
         * by not comparing those two directly.
         *
         * Pinned by `scripts/__tests__/check-env-rules.test.ts`.
         */
        id: 'internal-request-secret-api-admin-match',
        description:
            'HOSPEDA_INTERNAL_REQUEST_SECRET must hold the SAME value in apps/api and apps/admin ' +
            '(HOS-1153) — the admin sends it as the X-Internal-Request header on the two session ' +
            'reads its _authed beforeLoad makes server-side, and api exempts matching requests ' +
            'from the rate limiter. A mismatch silently breaks the exemption and every operator ' +
            'collapses back onto one proxy:<container-ip> bucket. Kept SEPARATE from the api/web ' +
            'rule on purpose, so an unset admin side cannot disable that one. Unset on either ' +
            'side is a valid "feature disabled" state (partial = pass).',
        appliesTo: ['local', 'coolify'],
        comparator: 'equals',
        compare: [
            { app: 'api', key: 'HOSPEDA_INTERNAL_REQUEST_SECRET' },
            { app: 'admin', key: 'HOSPEDA_INTERNAL_REQUEST_SECRET' }
        ]
    },
    {
        id: 'sentry-environment-all-apps-match',
        description:
            'The Sentry environment tag must hold the SAME value across api, web and admin on a ' +
            'given deployment target — the three report into ONE shared Sentry project, so this ' +
            'tag is the only field separating a production error from a staging one. H-16 (August ' +
            '2026 smoke): hospeda.com.ar shipped PUBLIC_SENTRY_ENVIRONMENT=staging while api and ' +
            'admin correctly said production, so every real production error from the web app was ' +
            'filed as staging and could not be filtered, alerted on or prioritised by environment. ' +
            'The three keys differ in NAME only because each app exposes env vars under its own ' +
            'framework prefix (HOSPEDA_ / PUBLIC_ / VITE_); their VALUES must agree. Coolify-only: ' +
            'the failure mode is a per-resource misconfiguration, and one app left unset in a ' +
            "developer's .env.local is not a defect worth failing on.",
        appliesTo: ['coolify'],
        comparator: 'equals',
        compare: [
            { app: 'api', key: 'HOSPEDA_SENTRY_ENVIRONMENT' },
            { app: 'web', key: 'PUBLIC_SENTRY_ENVIRONMENT' },
            { app: 'admin', key: 'VITE_SENTRY_ENVIRONMENT' }
        ]
    }
];
