/**
 * Guard: `MEASURED_LIMIT_KEYS` must match the counters `getCurrentUsage`
 * actually implements.
 *
 * Only a handful of `LimitKey`s have a real usage counter. Every other key
 * returns a hardcoded `0`, which is indistinguishable from a genuine zero once
 * it leaves the service. `MEASURED_LIMIT_KEYS` is what lets a consumer tell
 * the two apart, and the web subscription page filters on the `isMeasured`
 * flag derived from it.
 *
 * That set and the `switch` are two independently maintained lists, so they
 * can drift silently in both directions:
 * - implement a counter, forget the set → a working measurement stays hidden
 *   from the user forever, with nothing failing;
 * - add a key to the set with no counter → the fake `0` is displayed as fact
 *   ("0 búsquedas con IA" to someone who ran 40), which is the exact bug this
 *   mechanism exists to prevent.
 *
 * Neither direction breaks a type or a unit test, so this parses the source of
 * `getCurrentUsage` and compares the two directly.
 *
 * @module test/services/usage-tracking-measured-keys.guard.test
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LimitKey } from '@repo/billing';
import { describe, expect, it } from 'vitest';

const SERVICE_PATH = resolve(__dirname, '../../src/services/usage-tracking.service.ts');
const SOURCE = readFileSync(SERVICE_PATH, 'utf8');

/**
 * Extracts the body of `getCurrentUsage`'s `switch (limitKey)` block by
 * brace-matching from the `switch` keyword, so the guard does not depend on
 * where the method sits in the file.
 *
 * @returns The switch body source, braces included
 */
function extractSwitchBody(): string {
    const switchStart = SOURCE.indexOf('switch (limitKey) {');
    if (switchStart === -1) {
        throw new Error(
            'Could not find `switch (limitKey) {` in usage-tracking.service.ts — this guard needs updating.'
        );
    }

    const openBrace = SOURCE.indexOf('{', switchStart);
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

    throw new Error('Unbalanced braces while extracting the `switch (limitKey)` body.');
}

/**
 * Reads the `MEASURED_LIMIT_KEYS` declaration and resolves each
 * `LimitKey.FOO` member reference to its runtime string value.
 *
 * @returns The declared measured keys, as their enum string values
 */
function parseDeclaredMeasuredKeys(): ReadonlySet<string> {
    const match = SOURCE.match(
        /const MEASURED_LIMIT_KEYS[^=]*=\s*new Set<string>\(\[([\s\S]*?)\]\)/
    );
    if (!match?.[1]) {
        throw new Error(
            'Could not parse the `MEASURED_LIMIT_KEYS` declaration — this guard needs updating.'
        );
    }

    const members = [...match[1].matchAll(/LimitKey\.([A-Z0-9_]+)/g)].map((m) => m[1] as string);

    return new Set(
        members.map((member) => {
            const value = (LimitKey as unknown as Record<string, string>)[member];
            if (!value) {
                throw new Error(
                    `MEASURED_LIMIT_KEYS references LimitKey.${member}, which does not exist.`
                );
            }
            return value;
        })
    );
}

/**
 * Finds the keys whose `case` arm does real work, i.e. whose body is anything
 * other than a bare `return 0;` (comments ignored).
 *
 * @param switchBody - Source of the `switch (limitKey)` block
 * @returns Enum string values of the keys that are genuinely counted
 */
function parseImplementedCounters(switchBody: string): ReadonlySet<string> {
    const implemented = new Set<string>();

    // Each arm looks like: `case LimitKey.FOO: { ...body... }`
    const armPattern = /case LimitKey\.([A-Z0-9_]+):\s*\{([\s\S]*?)\n {16}\}/g;

    for (const arm of switchBody.matchAll(armPattern)) {
        const member = arm[1] as string;
        const body = arm[2] as string;

        // Strip line comments, then whitespace, and see what is left.
        const meaningful = body
            .replace(/\/\/[^\n]*/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        if (meaningful === 'return 0;') {
            continue;
        }

        const value = (LimitKey as unknown as Record<string, string>)[member];
        if (!value) {
            throw new Error(`getCurrentUsage handles LimitKey.${member}, which does not exist.`);
        }
        implemented.add(value);
    }

    return implemented;
}

describe('MEASURED_LIMIT_KEYS guard', () => {
    const switchBody = extractSwitchBody();
    const declared = parseDeclaredMeasuredKeys();
    const implemented = parseImplementedCounters(switchBody);

    it('should parse a non-empty set from each side', () => {
        // Non-vacuity: a parser that silently matched nothing would make every
        // assertion below pass regardless of the source.
        expect(declared.size).toBeGreaterThan(0);
        expect(implemented.size).toBeGreaterThan(0);
    });

    it('should declare exactly the keys that have a real counter', () => {
        expect([...declared].sort()).toEqual([...implemented].sort());
    });

    it('should not declare a key whose case arm is a hardcoded zero', () => {
        // Direction 1: a key in the set with no counter → fake zero shown as fact.
        const declaredWithoutCounter = [...declared].filter((key) => !implemented.has(key));
        expect(declaredWithoutCounter).toEqual([]);
    });

    it('should not leave an implemented counter out of the set', () => {
        // Direction 2: a real counter missing from the set → measurement hidden.
        const counterNotDeclared = [...implemented].filter((key) => !declared.has(key));
        expect(counterNotDeclared).toEqual([]);
    });

    it('should treat a bare `return 0` arm as unmeasured', () => {
        // Reversion check: proves the body classifier actually inspects the
        // arm rather than accepting every `case` it sees. These three are
        // hardcoded zeros in the source today.
        expect(implemented.has(LimitKey.MAX_PHOTOS_PER_ACCOMMODATION)).toBe(false);
        expect(implemented.has(LimitKey.MAX_PROPERTIES)).toBe(false);
        expect(implemented.has(LimitKey.MAX_STAFF_ACCOUNTS)).toBe(false);
    });

    it('should treat keys handled only by the switch default as unmeasured', () => {
        // The AI meters, search history and collections never get a `case` arm
        // at all — they fall through `default: return 0`. If a counter is ever
        // added for one, it gets a `case` arm and this expectation is the
        // reminder to update the set.
        expect(implemented.has(LimitKey.MAX_AI_SEARCH_PER_MONTH)).toBe(false);
        expect(implemented.has(LimitKey.MAX_COLLECTIONS)).toBe(false);
        expect(declared.has(LimitKey.MAX_AI_SEARCH_PER_MONTH)).toBe(false);
    });
});
