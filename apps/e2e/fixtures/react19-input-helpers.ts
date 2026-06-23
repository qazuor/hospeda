/**
 * @file react19-input-helpers.ts
 * @description Browser-side helpers for reliably triggering React 19 controlled
 * input/textarea/select onChange in Playwright (SPEC-253 T-028..T-030).
 *
 * Root cause (React 19 dirty-tracking bug):
 *   React 19 controlled inputs only fire `onChange` when the DOM receives an
 *   `InputEvent` whose `inputType` property is non-null. Playwright's `fill()`
 *   and `pressSequentially()` dispatch `new Event('input')` (no `inputType`),
 *   which React 19 silently ignores. The component's `markDirty()` is never
 *   called → `dirty.size === 0` → Save button stays disabled → no PATCH.
 *
 * Fix strategy (TEST-SIDE ONLY, zero production risk):
 *   Use `locator.evaluate()` to run code inside the browser process, where we
 *   can call the native prototype setter (the one React patches) and dispatch a
 *   proper `InputEvent` with `inputType:'insertText'`. React's synthetic
 *   `onChange` fires and `markDirty()` is called correctly.
 *
 * For `<select>` elements: React listens for the native `change` event (not
 *   `input`), so we use a plain `new Event('change', { bubbles: true })` after
 *   the prototype setter on HTMLSelectElement.
 *
 * For checkboxes (`<input type="checkbox">`): native Playwright `.check()` /
 *   `.uncheck()` dispatches real pointer events that React tracks correctly. No
 *   helper needed.
 *
 * @see apps/web/src/components/commerce/CommerceListingEditor.client.tsx
 * @see SPEC-253 T-028, T-030
 */

import type { Locator } from '@playwright/test';

/**
 * Sets the value of a React 19 controlled `<input>` or `<textarea>` element
 * and fires a bubbling `InputEvent` with `inputType:'insertText'` so that
 * React's synthetic `onChange` handler is triggered and the component marks
 * the field dirty.
 *
 * Works for both `HTMLInputElement` and `HTMLTextAreaElement`. The correct
 * prototype is selected inside the browser by checking `instanceof
 * HTMLTextAreaElement`.
 *
 * @param locator - Playwright locator pointing to the input or textarea.
 * @param value   - New string value to set.
 *
 * @example
 * ```ts
 * import { setReactInputValue } from '../fixtures/react19-input-helpers.ts';
 * await setReactInputValue(page.locator('#ce-summary'), 'New summary text');
 * ```
 */
export async function setReactInputValue(locator: Locator, value: string): Promise<void> {
    await locator.evaluate((el: HTMLInputElement | HTMLTextAreaElement, newValue: string) => {
        // Pick the correct prototype depending on element type.
        const proto =
            el instanceof HTMLTextAreaElement
                ? window.HTMLTextAreaElement.prototype
                : window.HTMLInputElement.prototype;

        const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
        if (descriptor?.set) {
            descriptor.set.call(el, newValue);
        } else {
            // Fallback: direct assignment (less reliable with React 19 but avoids
            // a silent no-op if the descriptor is absent for any reason).
            el.value = newValue;
        }

        // React 19 controlled inputs require an InputEvent with a non-null
        // inputType. A plain Event('input') is silently ignored by React's
        // internal event tracking, which means onChange never fires and
        // markDirty() is never called.
        el.dispatchEvent(
            new InputEvent('input', {
                bubbles: true,
                cancelable: true,
                inputType: 'insertText',
                data: newValue
            })
        );
    }, value);
}

/**
 * Sets the selected option of a React 19 controlled `<select>` element and
 * fires a bubbling `change` event so that React's synthetic `onChange` handler
 * is triggered.
 *
 * Note: `<select>` elements fire `change` (not `input`) in the browser, and
 * React listens for the `change` event. A plain `new Event('change')` (without
 * `inputType`) is correct here — unlike for text inputs.
 *
 * @param locator - Playwright locator pointing to the select element.
 * @param value   - The `value` attribute of the `<option>` to select.
 *
 * @example
 * ```ts
 * import { setReactSelectValue } from '../fixtures/react19-input-helpers.ts';
 * await setReactSelectValue(page.locator('#ce-type'), 'RESTAURANT');
 * ```
 */
export async function setReactSelectValue(locator: Locator, value: string): Promise<void> {
    await locator.evaluate((el: HTMLSelectElement, newValue: string) => {
        const descriptor = Object.getOwnPropertyDescriptor(
            window.HTMLSelectElement.prototype,
            'value'
        );
        if (descriptor?.set) {
            descriptor.set.call(el, newValue);
        } else {
            el.value = newValue;
        }

        // Selects fire 'change', NOT 'input'. React listens for 'change'.
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
}
