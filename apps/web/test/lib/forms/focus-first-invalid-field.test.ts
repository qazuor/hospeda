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

/**
 * The editor namespace under test. HOS-385 replaced the per-editor
 * `FieldInputIdMap` with derivation, so there is no table to fixture — ids are
 * `<prefix>-<zod key>`, built by the same `buildFieldId` the render site calls.
 */
const PREFIX = 'f';

/** One Zod key rendered as several controls — the only derivation exception. */
const SUFFIXES = { phone: 'number' } as const;

/** Renders inputs in the given DOM order. */
function renderInputs(ids: ReadonlyArray<string>): void {
    for (const id of ids) {
        const input = document.createElement('input');
        input.id = id;
        document.body.appendChild(input);
    }
}

describe('focusFirstInvalidField', () => {
    // jsdom does not implement scrollIntoView. Assigning it straight onto the
    // prototype leaks across files in the same worker — `vi.restoreAllMocks()`
    // does not undo a plain assignment — which is exactly how an earlier version
    // of this file hid a real `scrollIntoView is not a function` crash in the
    // editor tests until CI sharding changed the file order. Install and remove
    // it explicitly instead.
    const hadNative = 'scrollIntoView' in Element.prototype;
    let scrollSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        scrollSpy = vi.fn();
        Object.defineProperty(Element.prototype, 'scrollIntoView', {
            value: scrollSpy,
            configurable: true,
            writable: true
        });
    });

    afterEach(() => {
        if (hadNative) {
            Object.defineProperty(Element.prototype, 'scrollIntoView', {
                value: undefined,
                configurable: true,
                writable: true
            });
        } else {
            // biome-ignore lint/performance/noDelete: restoring the absent-in-jsdom original
            delete (Element.prototype as unknown as Record<string, unknown>).scrollIntoView;
        }
        document.body.replaceChildren();
        vi.restoreAllMocks();
    });

    it('should focus the mapped input for a single invalid field', () => {
        renderInputs(['f-name']);

        const focused = focusFirstInvalidField({ fieldNames: ['name'], prefix: PREFIX });

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
            prefix: PREFIX
        });

        expect(focused).toBe(true);
        expect(document.activeElement?.id).toBe('f-name');
    });

    it('should skip fields the editor does not render', () => {
        // Since HOS-385 every Zod key DERIVES an id, so "unmapped" is no longer
        // a state — a key the editor draws no control for simply resolves to
        // nothing, which is the same silent skip the table used to produce.
        renderInputs(['f-summary']);

        const focused = focusFirstInvalidField({
            fieldNames: ['fieldWithNoControl', 'summary'],
            prefix: PREFIX
        });

        expect(focused).toBe(true);
        expect(document.activeElement?.id).toBe('f-summary');
    });

    it('should skip fields whose element is not rendered', () => {
        // A section can be conditionally rendered — the id derives but is absent.
        renderInputs(['f-summary']);

        const focused = focusFirstInvalidField({
            fieldNames: ['name', 'summary'],
            prefix: PREFIX
        });

        expect(focused).toBe(true);
        expect(document.activeElement?.id).toBe('f-summary');
    });

    it('should target the suffixed sub-control for a grouped field', () => {
        // `phone` is ONE Zod key rendered as a country combobox plus a number
        // input. The suffix map is what sends focus to the number — and it is
        // the one place derivation does not fully determine the answer, so the
        // render site and this site must read the SAME constant.
        renderInputs(['f-phone-country', 'f-phone-number']);

        const focused = focusFirstInvalidField({
            fieldNames: ['phone'],
            prefix: PREFIX,
            suffixes: SUFFIXES
        });

        expect(focused).toBe(true);
        expect(document.activeElement?.id).toBe('f-phone-number');
    });

    it('should normalise a dotted Zod path to the rendered id', () => {
        // The commerce editor validates nested blocks, so its keys are dotted.
        // `buildFieldId` turns the dot into a hyphen; a raw `#a.b` selector
        // would read the dot as a class.
        renderInputs(['f-contactInfo-workEmail']);

        const focused = focusFirstInvalidField({
            fieldNames: ['contactInfo.workEmail'],
            prefix: PREFIX
        });

        expect(focused).toBe(true);
        expect(document.activeElement?.id).toBe('f-contactInfo-workEmail');
    });

    it('should report false when nothing resolves', () => {
        renderInputs(['f-name']);

        const focused = focusFirstInvalidField({
            fieldNames: ['fieldWithNoControl'],
            prefix: PREFIX
        });

        expect(focused).toBe(false);
    });

    it('should report false for an empty field list', () => {
        renderInputs(['f-name']);

        expect(focusFirstInvalidField({ fieldNames: [], prefix: PREFIX })).toBe(false);
    });

    it('should scroll the focused field into view', () => {
        renderInputs(['f-name']);

        focusFirstInvalidField({ fieldNames: ['name'], prefix: PREFIX });

        expect(scrollSpy).toHaveBeenCalledTimes(1);
    });

    it('should not animate the scroll when reduced motion is requested', () => {
        renderInputs(['f-name']);
        vi.stubGlobal(
            'matchMedia',
            vi.fn().mockReturnValue({ matches: true, media: '(prefers-reduced-motion: reduce)' })
        );

        focusFirstInvalidField({ fieldNames: ['name'], prefix: PREFIX });

        expect(scrollSpy).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }));
    });

    it('should still focus when scrollIntoView is unavailable', () => {
        // The real regression: jsdom has no scrollIntoView, and this runs inside
        // an event handler — an exception here surfaced as an unhandled
        // rejection that failed CI while every assertion passed.
        // biome-ignore lint/performance/noDelete: emulating an environment without it
        delete (Element.prototype as unknown as Record<string, unknown>).scrollIntoView;
        renderInputs(['f-name']);

        expect(() =>
            focusFirstInvalidField({ fieldNames: ['name'], prefix: PREFIX })
        ).not.toThrow();
        expect(document.activeElement?.id).toBe('f-name');
    });
});
