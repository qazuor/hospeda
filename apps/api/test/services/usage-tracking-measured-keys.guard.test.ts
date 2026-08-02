/**
 * Guard: the usage-kind classification must match the counters
 * `getCurrentUsage` actually implements.
 *
 * `USAGE_KIND_BY_LIMIT_KEY` decides whether a limit's `currentUsage` is a real
 * measurement (`stock` / `monthly`) or a structural zero (`per_accommodation`,
 * `per_operation`, `unbuilt`). The web subscription page renders only the
 * measured ones, so that table is what stands between a user and a confidently
 * displayed fake number.
 *
 * The table and the `switch` are two independently maintained lists, and they
 * drift silently in both directions:
 * - a counter implemented but classified as unmeasured → the measurement stays
 *   hidden from the user forever, with nothing failing;
 * - a key classified as measured with no counter → its placeholder `0` is
 *   displayed as fact ("0 búsquedas con IA" to someone who ran 40), which is
 *   the exact bug this mechanism exists to prevent.
 *
 * Neither direction breaks a type or a unit test, so this parses the source of
 * the service and compares the two directly.
 *
 * A counter reaches `getCurrentUsage` by one of two routes, and BOTH count as
 * implemented: a dedicated `case` arm whose body is not a bare `return 0`, or
 * membership in `AI_FEATURE_BY_LIMIT_KEY` (the AI meters share one `default`
 * branch that resolves the feature and calls `getMonthlyCallCount`).
 *
 * @module test/services/usage-tracking-measured-keys.guard.test
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LimitKey } from '@repo/billing';
import { describe, expect, it } from 'vitest';

const SERVICE_PATH = resolve(__dirname, '../../src/services/usage-tracking.service.ts');
const SOURCE = readFileSync(SERVICE_PATH, 'utf8');

/** Usage kinds whose `currentUsage` is a genuine account-wide measurement. */
const MEASURED_KINDS = new Set(['UsageKind.STOCK', 'UsageKind.MONTHLY']);

/**
 * Resolves a `LimitKey.FOO` member name to its runtime string value, failing
 * loudly rather than silently dropping an entry the parser cannot resolve.
 *
 * @param member - Enum member name as written in the source.
 * @returns The enum's string value.
 */
function resolveLimitKey(member: string): string {
    const value = (LimitKey as unknown as Record<string, string>)[member];
    if (!value) {
        throw new Error(`Source references LimitKey.${member}, which does not exist.`);
    }
    return value;
}

/**
 * Extracts a brace-balanced block starting at the first `{` after `marker`.
 *
 * @param marker - Literal text that precedes the block.
 * @returns The block source, braces included.
 */
function extractBlock(marker: string): string {
    const markerStart = SOURCE.indexOf(marker);
    if (markerStart === -1) {
        throw new Error(`Could not find \`${marker}\` — this guard needs updating.`);
    }

    const openBrace = SOURCE.indexOf('{', markerStart);
    let depth = 0;

    for (let i = openBrace; i < SOURCE.length; i++) {
        if (SOURCE[i] === '{') depth++;
        if (SOURCE[i] === '}') {
            depth--;
            if (depth === 0) {
                return SOURCE.slice(openBrace, i + 1);
            }
        }
    }

    throw new Error(`Unbalanced braces while extracting the block after \`${marker}\`.`);
}

/**
 * Reads `USAGE_KIND_BY_LIMIT_KEY` and returns the keys classified as measured.
 *
 * @returns Enum string values whose kind is `stock` or `monthly`.
 */
function parseMeasuredClassification(): ReadonlySet<string> {
    const block = extractBlock('const USAGE_KIND_BY_LIMIT_KEY');
    const measured = new Set<string>();

    for (const entry of block.matchAll(/\[LimitKey\.([A-Z0-9_]+)\]:\s*(UsageKind\.[A-Z_]+)/g)) {
        const member = entry[1] as string;
        const kind = entry[2] as string;

        if (MEASURED_KINDS.has(kind)) {
            measured.add(resolveLimitKey(member));
        }
    }

    return measured;
}

/**
 * Reads `AI_FEATURE_BY_LIMIT_KEY` — every key there is counted through the
 * `switch`'s `default` branch via `getMonthlyCallCount`.
 *
 * @returns Enum string values that resolve to an `ai_usage` feature.
 */
function parseAiBackedKeys(): ReadonlySet<string> {
    const block = extractBlock('const AI_FEATURE_BY_LIMIT_KEY');
    const keys = new Set<string>();

    for (const entry of block.matchAll(/\[LimitKey\.([A-Z0-9_]+)\]:\s*'[a-z_]+'/g)) {
        keys.add(resolveLimitKey(entry[1] as string));
    }

    return keys;
}

/**
 * Finds keys whose dedicated `case` arm does real work — i.e. whose body is
 * anything other than a bare `return 0;` once comments are stripped.
 *
 * @returns Enum string values counted by an explicit `case` arm.
 */
function parseCaseArmCounters(): ReadonlySet<string> {
    const switchBody = extractBlock('switch (limitKey)');
    const implemented = new Set<string>();

    for (const arm of switchBody.matchAll(
        /case LimitKey\.([A-Z0-9_]+):\s*\{([\s\S]*?)\n {16}\}/g
    )) {
        const body = (arm[2] as string)
            .replace(/\/\/[^\n]*/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        if (body === 'return 0;') {
            continue;
        }

        implemented.add(resolveLimitKey(arm[1] as string));
    }

    return implemented;
}

describe('usage-kind classification guard', () => {
    const classifiedAsMeasured = parseMeasuredClassification();
    const aiBacked = parseAiBackedKeys();
    const caseArmCounters = parseCaseArmCounters();
    const implemented = new Set<string>([...caseArmCounters, ...aiBacked]);

    it('should parse a non-empty set from each side', () => {
        // Non-vacuity: a parser that silently matched nothing would make every
        // assertion below pass regardless of the source.
        expect(classifiedAsMeasured.size).toBeGreaterThan(0);
        expect(caseArmCounters.size).toBeGreaterThan(0);
        expect(aiBacked.size).toBeGreaterThan(0);
    });

    it('should classify as measured exactly the keys that have a counter', () => {
        expect([...classifiedAsMeasured].sort()).toEqual([...implemented].sort());
    });

    it('should not classify a key as measured when nothing counts it', () => {
        // Direction 1: measured without a counter → fake zero shown as fact.
        const measuredWithoutCounter = [...classifiedAsMeasured].filter(
            (key) => !implemented.has(key)
        );
        expect(measuredWithoutCounter).toEqual([]);
    });

    it('should not leave an implemented counter classified as unmeasured', () => {
        // Direction 2: a real counter hidden behind a non-measured kind.
        const counterNotMeasured = [...implemented].filter((key) => !classifiedAsMeasured.has(key));
        expect(counterNotMeasured).toEqual([]);
    });

    it('should treat a bare `return 0` arm as having no counter', () => {
        // Reversion check: proves the body classifier inspects the arm rather
        // than accepting every `case` it sees. These are hardcoded zeros today.
        expect(caseArmCounters.has(LimitKey.MAX_PHOTOS_PER_ACCOMMODATION)).toBe(false);
        expect(caseArmCounters.has(LimitKey.MAX_PROPERTIES)).toBe(false);
        expect(caseArmCounters.has(LimitKey.MAX_STAFF_ACCOUNTS)).toBe(false);
        expect(caseArmCounters.has(LimitKey.MAX_COMPARE_ITEMS)).toBe(false);
    });

    it('should count every AI limit through the ai_usage feature map', () => {
        // The AI meters have no `case` arm at all — if the default branch or
        // the feature map is dropped, they must stop being classified measured.
        expect(aiBacked.has(LimitKey.MAX_AI_SEARCH_PER_MONTH)).toBe(true);
        expect(aiBacked.has(LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH)).toBe(true);
        expect(aiBacked.has(LimitKey.MAX_AI_CHAT_CONSUMER_PER_MONTH)).toBe(true);
        expect(caseArmCounters.has(LimitKey.MAX_AI_SEARCH_PER_MONTH)).toBe(false);
    });

    it('should classify every LimitKey exactly once', () => {
        // A key missing from the table silently falls back to `unbuilt`, which
        // hides it from the page forever — the failure mode that looks like
        // "the feature just never shipped".
        const block = extractBlock('const USAGE_KIND_BY_LIMIT_KEY');
        const classified = [...block.matchAll(/\[LimitKey\.([A-Z0-9_]+)\]:/g)].map((m) =>
            resolveLimitKey(m[1] as string)
        );

        expect(new Set(classified).size).toBe(classified.length);
        expect(classified.sort()).toEqual([...Object.values(LimitKey)].sort());
    });
});
