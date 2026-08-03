/**
 * @file focus-first-invalid-field.test.ts
 * @description Unit tests for the HOS-373 phase 2 focus helper.
 *
 * jsdom does implement `focus()`/`document.activeElement`, so these assert on
 * the real focus target. It does NOT implement `scrollIntoView`, which is
 * stubbed — the scroll is a UX nicety, the focus move is the contract.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { focusFirstInvalidField } from '@/lib/forms/focus-first-invalid-field';

const MAP = {
    name: 'f-name',
    summary: 'f-summary',
    youtube: 'f-youtube'
} as const;

/** Renders inputs in the given DOM order. */
function renderInputs(ids: ReadonlyArray<string>): void {
    for (const id of ids) {
        const input = document.createElement('input');
        input.id = id;
        document.body.appendChild(input);
    }
}

describe('focusFirstInvalidField', () => {
    beforeEach(() => {
        // jsdom has no layout engine, so scrollIntoView is not implemented.
        Element.prototype.scrollIntoView = vi.fn();
    });

    afterEach(() => {
        document.body.replaceChildren();
        vi.restoreAllMocks();
    });

    it('should focus the mapped input for a single invalid field', () => {
        renderInputs(['f-name']);

        const focused = focusFirstInvalidField({ fieldNames: ['name'], map: MAP });

        expect(focused).toBe(true);
        expect(document.activeElement?.id).toBe('f-name');
    });

    it('should focus the field that comes first in the DOM, not first in the list', () => {
        // This is the whole point of the helper: zod reports issues in schema
        // declaration order, which has nothing to do with page order. `youtube`
        // is passed first but renders last.
        renderInputs(['f-name', 'f-summary', 'f-youtube']);

        const focused = focusFirstInvalidField({
            fieldNames: ['youtube', 'summary', 'name'],
            map: MAP
        });

        expect(focused).toBe(true);
        expect(document.activeElement?.id).toBe('f-name');
    });

    it('should skip fields that are not in the map', () => {
        renderInputs(['f-summary']);

        const focused = focusFirstInvalidField({
            fieldNames: ['unmappedField', 'summary'],
            map: MAP
        });

        expect(focused).toBe(true);
        expect(document.activeElement?.id).toBe('f-summary');
    });

    it('should skip mapped fields whose element is not rendered', () => {
        // A section can be conditionally rendered — the id is mapped but absent.
        renderInputs(['f-summary']);

        const focused = focusFirstInvalidField({
            fieldNames: ['name', 'summary'],
            map: MAP
        });

        expect(focused).toBe(true);
        expect(document.activeElement?.id).toBe('f-summary');
    });

    it('should report false when nothing resolves', () => {
        renderInputs(['f-name']);

        const focused = focusFirstInvalidField({ fieldNames: ['unmapped'], map: MAP });

        expect(focused).toBe(false);
    });

    it('should report false for an empty field list', () => {
        renderInputs(['f-name']);

        expect(focusFirstInvalidField({ fieldNames: [], map: MAP })).toBe(false);
    });

    it('should scroll the focused field into view', () => {
        renderInputs(['f-name']);

        focusFirstInvalidField({ fieldNames: ['name'], map: MAP });

        expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
    });

    it('should not animate the scroll when reduced motion is requested', () => {
        renderInputs(['f-name']);
        vi.stubGlobal(
            'matchMedia',
            vi.fn().mockReturnValue({ matches: true, media: '(prefers-reduced-motion: reduce)' })
        );

        focusFirstInvalidField({ fieldNames: ['name'], map: MAP });

        expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith(
            expect.objectContaining({ behavior: 'auto' })
        );
    });
});
