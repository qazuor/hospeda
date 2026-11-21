/**
 * AC-C49 and AC-C48 (spec HOS-2335 §6.9, HOS-2348) — the assistant history
 * never shows a raw tool name or error code.
 *
 * Every tool in `MCP_TOOL_DEFINITIONS` and every error code a tool call can be
 * recorded with has a label under `account.aiAssistants.activity` in es, and
 * the same key in en and pt. The test iterates the registry and the code
 * enum, so a new tool or a new code fails here until it is labelled.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { MCP_TOOL_DEFINITIONS } from '../../../src/mcp/tools/registry';
import type { ToolFailure } from '../../../src/mcp/tools/tool-errors';

const LOCALES = ['es', 'en', 'pt'] as const;

/**
 * The codes of `ToolFailure.code` that are not a `ServiceErrorCode`. A
 * `Record` over the exact difference, so a literal added to the failure type
 * without an entry here stops the typecheck.
 */
const NON_SERVICE_CODES: Readonly<Record<Exclude<ToolFailure['code'], ServiceErrorCode>, true>> = {
    RATE_LIMIT_EXCEEDED: true,
    UNEXPECTED: true,
    USER_CANCELLED: true,
    USER_DECLINED: true
};

/**
 * Every code a recorded failure can carry: the binder writes
 * `ToolFailure.code` as the row's `errorCode`. A new `ServiceErrorCode` is
 * picked up by `Object.values`.
 */
const RECORDED_ERROR_CODES: readonly string[] = [
    ...Object.values(ServiceErrorCode),
    ...Object.keys(NON_SERVICE_CODES)
];

type ActivityCopy = {
    readonly tools: Readonly<Record<string, unknown>>;
    readonly errorCodes: Readonly<Record<string, unknown>>;
};

/** The `account.aiAssistants.activity` block of one locale. */
function activityCopy(locale: (typeof LOCALES)[number]): ActivityCopy {
    const path = resolve(
        __dirname,
        `../../../../../packages/i18n/src/locales/${locale}/account.json`
    );
    const account: { aiAssistants: { activity: ActivityCopy } } = JSON.parse(
        readFileSync(path, 'utf8')
    );
    return account.aiAssistants.activity;
}

/** Keys of `group` whose value is missing or not a non-empty string. */
function unlabelled(input: {
    readonly group: Readonly<Record<string, unknown>>;
    readonly keys: readonly string[];
}): readonly string[] {
    return input.keys.filter((key) => {
        const value = input.group[key];
        return typeof value !== 'string' || value.trim() === '';
    });
}

describe('assistant history labels (AC-C49, AC-C48)', () => {
    const toolNames = MCP_TOOL_DEFINITIONS.map((definition) => definition.name);

    it.each(LOCALES)('%s labels every registered tool', (locale) => {
        expect(unlabelled({ group: activityCopy(locale).tools, keys: toolNames })).toEqual([]);
    });

    it.each(LOCALES)('%s labels every error code a tool call can record', (locale) => {
        expect(
            unlabelled({ group: activityCopy(locale).errorCodes, keys: RECORDED_ERROR_CODES })
        ).toEqual([]);
    });

    it('is not vacuous: it reads the registry and a missing label is reported', () => {
        expect(toolNames.length).toBeGreaterThan(0);
        expect(unlabelled({ group: { a: 'Ver' }, keys: ['a', 'b'] })).toEqual(['b']);
        expect(unlabelled({ group: { a: ' ' }, keys: ['a'] })).toEqual(['a']);
    });
});
