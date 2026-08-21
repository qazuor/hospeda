/**
 * @file billing-limit-key-i18n-coverage.guard.test.ts
 * @description Static guard for HOS-690 AC-23: every `LimitKey` must ship with
 * dedicated i18n coverage, not just a TypeScript metadata entry.
 *
 * ## The gap this closes
 *
 * `packages/billing/test/limits.test.ts` enforces that `LIMIT_METADATA` is
 * exhaustive over `LimitKey` — but that record holds English strings compiled
 * into the bundle, not locale files, so it is satisfied the moment a key has
 * ANY name/description, translated or not.
 *
 * `packages/i18n/test/key-coverage.test.ts` enforces es↔en↔pt parity — it
 * catches a key added to one locale and forgotten in the others, but it never
 * opens `plan.types.ts` and has no notion of `LimitKey` at all. A limit key
 * that was never given ANY `billing.limit.<key>.*` entry, in any locale,
 * passes both existing guards while degrading silently to
 * `billing.limit.generic.*` in production (see
 * `apps/web/src/lib/billing-limit-error.ts`).
 *
 * This guard is the missing link: for every `LimitKey`, in the `es` baseline
 * locale (the cross-locale guard above covers `en`/`pt` for free once `es`
 * exists):
 *
 *   1. `billing.limit.<key>.title` exists.
 *   2. `billing.comparison.limitLabel.<key>` exists.
 *   3. `key` is a member of `KNOWN_LIMIT_KEYS`
 *      (`apps/web/src/lib/billing-limit-error.ts`) — the hand-written
 *      allowlist that gates whether `buildLimitReachedPayload` ever resolves
 *      the dedicated copy instead of falling through to `billing.limit.generic.*`.
 *
 * All three predicates are exactly what the issue's AC-23 states — no more,
 * no less: this guard does not require `atLimitPanel` (that block is scoped
 * to `max_accommodations` alone, consumed by a single publish-precheck panel
 * with no equivalent surface for every limit key) and does not require
 * `message_one`/`message_other` (a separate, already-covered concern once
 * `title` exists, per the plural-parity guard).
 */

import { readFileSync } from 'node:fs';
import { join, resolve as resolvePath } from 'node:path';
import { LimitKey } from '@repo/billing';
import { describe, expect, it } from 'vitest';
import { KNOWN_LIMIT_KEYS } from '@/lib/billing-limit-error';

const REPO_ROOT = resolvePath(__dirname, '../../../..');
const ES_BILLING_JSON_PATH = join(REPO_ROOT, 'packages/i18n/src/locales/es/billing.json');

/** Resolve a dot-notation key against a nested JSON object. */
function resolveKey({ obj, key }: { readonly obj: unknown; readonly key: string }): unknown {
    return key.split('.').reduce<unknown>((current, part) => {
        if (current && typeof current === 'object' && !Array.isArray(current)) {
            return (current as Record<string, unknown>)[part];
        }
        return undefined;
    }, obj);
}

function readEsBilling(): Record<string, unknown> {
    return JSON.parse(readFileSync(ES_BILLING_JSON_PATH, 'utf8')) as Record<string, unknown>;
}

describe('HOS-690 AC-23 — every LimitKey has dedicated i18n coverage', () => {
    const allLimitKeys = Object.values(LimitKey);

    it('has limit keys to check at all', () => {
        // Non-vacuity: an empty LimitKey enum would satisfy every assertion below.
        expect(allLimitKeys.length).toBeGreaterThan(0);
    });

    it('every LimitKey has billing.limit.<key>.title in es', () => {
        const esBilling = readEsBilling();
        const missing = allLimitKeys.filter((key) => {
            const value = resolveKey({ obj: esBilling, key: `limit.${key}.title` });
            return typeof value !== 'string' || value.length === 0;
        });

        expect(
            missing,
            `Missing billing.limit.<key>.title (es) for: ${missing.join(', ')}`
        ).toEqual([]);
    });

    it('every LimitKey has billing.comparison.limitLabel.<key> in es', () => {
        const esBilling = readEsBilling();
        const missing = allLimitKeys.filter((key) => {
            const value = resolveKey({ obj: esBilling, key: `comparison.limitLabel.${key}` });
            return typeof value !== 'string' || value.length === 0;
        });

        expect(
            missing,
            `Missing billing.comparison.limitLabel.<key> (es) for: ${missing.join(', ')}`
        ).toEqual([]);
    });

    it('every LimitKey is registered in KNOWN_LIMIT_KEYS', () => {
        const missing = allLimitKeys.filter((key) => !KNOWN_LIMIT_KEYS.has(key));

        expect(
            missing,
            `LimitKey(s) missing from KNOWN_LIMIT_KEYS — they will silently render ` +
                `billing.limit.generic.* instead of their own copy: ${missing.join(', ')}`
        ).toEqual([]);
    });
});
