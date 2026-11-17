/**
 * @file response-budget.test.ts
 * @description Budget constants and helpers (HOS-2335 spec §5.3).
 */
import { describe, expect, it } from 'vitest';
import {
    excerptText,
    isWithinResultBudget,
    MCP_HANDLER_P95_TARGET_MS,
    MCP_LIST_MAX_PAGE_SIZE,
    MCP_RESULT_MAX_CHARS,
    MCP_TEXT_EXCERPT_CHARS,
    measureResultChars
} from '../../../src/mcp/tools/response-budget';

describe('response budget', () => {
    it('exposes the proposed constants', () => {
        expect(MCP_RESULT_MAX_CHARS).toBe(24_000);
        expect(MCP_TEXT_EXCERPT_CHARS).toBe(600);
        expect(MCP_LIST_MAX_PAGE_SIZE).toBe(20);
        expect(MCP_HANDLER_P95_TARGET_MS).toBe(3000);
    });

    describe('excerptText', () => {
        it('leaves short text untouched', () => {
            expect(excerptText({ text: 'hola' })).toEqual({ text: 'hola', truncated: false });
        });

        it('keeps text exactly at the limit', () => {
            const text = 'a'.repeat(MCP_TEXT_EXCERPT_CHARS);
            expect(excerptText({ text }).truncated).toBe(false);
        });

        it('truncates long text to the limit, ellipsis included', () => {
            const result = excerptText({ text: 'a'.repeat(MCP_TEXT_EXCERPT_CHARS + 1) });
            expect(result.truncated).toBe(true);
            expect(result.text).toHaveLength(MCP_TEXT_EXCERPT_CHARS);
            expect(result.text.endsWith('…')).toBe(true);
        });

        it('never splits a surrogate pair', () => {
            const result = excerptText({ text: `${'a'.repeat(8)}😀😀😀`, maxChars: 10 });
            expect(result.truncated).toBe(true);
            expect(result.text).toBe(`${'a'.repeat(8)}…`);
        });
    });

    describe('result size', () => {
        it('measures the serialized length', () => {
            expect(measureResultChars({ value: { a: 1 } })).toBe('{"a":1}'.length);
        });

        it('accepts a result at the limit and refuses one over it', () => {
            const at = 'x'.repeat(MCP_RESULT_MAX_CHARS - 2);
            expect(isWithinResultBudget({ value: at })).toBe(true);
            expect(isWithinResultBudget({ value: `${at}x` })).toBe(false);
        });
    });
});
