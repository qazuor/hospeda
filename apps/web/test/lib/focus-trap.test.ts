/**
 * @file focus-trap.test.ts
 * @description Unit tests for the shared modal focus trap.
 *
 * The whole point of these tests is that they do NOT read
 * `document.activeElement` to decide whether the trap engaged. jsdom never
 * moves focus in response to a `keydown`, so "focus did not leave" is
 * indistinguishable from "nothing happened at all" — which is exactly how a
 * trap that only prevented Tab on its first/last element shipped green.
 *
 * The honest signal is `event.defaultPrevented` on a real, cancelable
 * `KeyboardEvent`: it is `true` only if the trap actually called
 * `preventDefault()`, and `false` means the browser would have moved focus
 * onward — out of the container and into the page behind the backdrop.
 *
 * @module test/lib/focus-trap
 */

import { afterEach, describe, expect, it } from 'vitest';
import { FOCUSABLE_SELECTORS, trapFocus } from '@/lib/focus-trap';

/** Builds a real cancelable Tab keydown, runs the trap, and hands it back. */
function tabThroughTrap(
    container: HTMLElement,
    options: { readonly shiftKey?: boolean; readonly key?: string } = {}
): KeyboardEvent {
    const event = new KeyboardEvent('keydown', {
        key: options.key ?? 'Tab',
        code: options.key ?? 'Tab',
        shiftKey: options.shiftKey ?? false,
        bubbles: true,
        cancelable: true
    });
    trapFocus(container, event);
    return event;
}

/** Mounts a container with `count` buttons plus one element outside it. */
function mountContainer(count: number): {
    readonly container: HTMLElement;
    readonly buttons: readonly HTMLButtonElement[];
    readonly outside: HTMLButtonElement;
} {
    const container = document.createElement('div');
    const buttons: HTMLButtonElement[] = [];
    for (let index = 0; index < count; index += 1) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = `inside-${index}`;
        container.appendChild(button);
        buttons.push(button);
    }
    const outside = document.createElement('button');
    outside.type = 'button';
    outside.textContent = 'outside';

    document.body.appendChild(container);
    document.body.appendChild(outside);
    return { container, buttons, outside };
}

afterEach(() => {
    document.body.innerHTML = '';
});

describe('FOCUSABLE_SELECTORS', () => {
    it('matches the standard focusable controls and skips disabled / tabindex="-1" ones', () => {
        const container = document.createElement('div');
        container.innerHTML = `
            <a href="/somewhere">link</a>
            <button type="button">enabled</button>
            <button type="button" disabled>disabled</button>
            <input type="text" />
            <input type="text" disabled />
            <textarea></textarea>
            <select><option>a</option></select>
            <div tabindex="0">programmatic</div>
            <div tabindex="-1">skipped</div>
        `;
        document.body.appendChild(container);

        const matched = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS));

        // link + enabled button + text input + textarea + select + tabindex="0".
        expect(matched).toHaveLength(6);
        expect(matched.some((el) => el.hasAttribute('disabled'))).toBe(false);
        expect(matched.some((el) => el.getAttribute('tabindex') === '-1')).toBe(false);
    });
});

describe('trapFocus', () => {
    it('recovers focus that was LOST while the surface was open (the trap that traps)', () => {
        // The regression this file exists for. A focused control that becomes
        // `disabled`, or a tap on a non-focusable panel background, leaves
        // `document.activeElement` on <body> — inside neither `first` nor
        // `last`. Left unprevented, the browser's next Tab walks into page
        // content hidden behind an opaque backdrop (WCAG 2.4.3).
        const { container, buttons } = mountContainer(3);
        const stepper = buttons[2] as HTMLButtonElement;
        stepper.focus();
        stepper.disabled = true;
        // jsdom does NOT run the HTML unfocusing steps when the focused element
        // becomes disabled — it leaves the disabled node parked as
        // `activeElement`, and `blur()` short-circuits on a non-focusable area.
        // Real browsers DO unfocus it (verified in Chrome for HOS-323), so
        // reproduce their end state: clear the flag, blur, restore it.
        stepper.disabled = false;
        stepper.blur();
        stepper.disabled = true;
        expect(document.activeElement).toBe(document.body);

        const event = tabThroughTrap(container);

        expect(event.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(buttons[0]);
    });

    it('does NOT steal focus from another element that legitimately holds it', () => {
        // The round-3 CRITICAL. Consumers register this on `document`, so
        // several traps can be live at once, and a global shortcut
        // (Ctrl+Shift+F opens the feedback modal from BaseLayout on every page)
        // can stack an overlay over any surface at any time. Treating "focus is
        // outside me" as "focus is up for grabs" made every live trap cancel
        // every Tab in the document and yank focus to its own first element —
        // the stacked overlay became unreachable by keyboard (WCAG 2.1.2),
        // strictly worse than the escape being prevented.
        const { container, outside } = mountContainer(3);
        outside.focus();
        expect(document.activeElement).toBe(outside);

        const event = tabThroughTrap(container);

        expect(event.defaultPrevented).toBe(false);
        expect(document.activeElement).toBe(outside);
    });

    it('leaves the other overlay alone when two traps are live at once', () => {
        // The concrete shape of the bug: two surfaces open, both listening on
        // `document`, so BOTH traps run on the same keydown. Only the one that
        // actually lost focus may act, otherwise they fight and pin focus.
        const { container: overlayA } = mountContainer(3);
        const overlayB = document.createElement('div');
        const inputB = document.createElement('input');
        inputB.type = 'text';
        overlayB.appendChild(inputB);
        document.body.appendChild(overlayB);

        inputB.focus();
        expect(document.activeElement).toBe(inputB);

        // Overlay A's trap sees a keydown for focus it does not own.
        const seenByA = tabThroughTrap(overlayA);
        expect(seenByA.defaultPrevented).toBe(false);
        expect(document.activeElement).toBe(inputB);

        // Overlay B's own trap still governs its single-element ring.
        const seenByB = tabThroughTrap(overlayB);
        expect(seenByB.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(inputB);
    });

    it('re-enters at the LAST focusable when lost focus is recovered by Shift+Tab', () => {
        // Direction of travel matters: Shift+Tab means "backwards", so dropping
        // the user on `first` sends them the way they did not ask to go.
        const { container, buttons } = mountContainer(3);
        const stepper = buttons[1] as HTMLButtonElement;
        stepper.focus();
        stepper.blur();
        expect(document.activeElement).toBe(document.body);

        const event = tabThroughTrap(container, { shiftKey: true });

        expect(event.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(buttons[buttons.length - 1]);
    });

    it('pulls focus back in from <body> specifically', () => {
        const { container, buttons, outside } = mountContainer(2);
        outside.focus();
        outside.blur();
        expect(document.activeElement).toBe(document.body);

        const event = tabThroughTrap(container);

        expect(event.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(buttons[0]);
    });

    it('wraps Tab from the last focusable back to the first', () => {
        const { container, buttons } = mountContainer(3);
        const last = buttons[buttons.length - 1] as HTMLButtonElement;
        last.focus();

        const event = tabThroughTrap(container);

        expect(event.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(buttons[0]);
    });

    it('wraps Shift+Tab from the first focusable back to the last', () => {
        const { container, buttons } = mountContainer(3);
        (buttons[0] as HTMLButtonElement).focus();

        const event = tabThroughTrap(container, { shiftKey: true });

        expect(event.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(buttons[buttons.length - 1]);
    });

    it('lets Tab through in the middle of the ring so the browser can advance normally', () => {
        // Not prevented on purpose: between first and last the native Tab order
        // is already correct and inside the container.
        const { container, buttons } = mountContainer(3);
        (buttons[1] as HTMLButtonElement).focus();

        const forward = tabThroughTrap(container);
        expect(forward.defaultPrevented).toBe(false);

        (buttons[1] as HTMLButtonElement).focus();
        const backward = tabThroughTrap(container, { shiftKey: true });
        expect(backward.defaultPrevented).toBe(false);
    });

    it('keeps focus on the only focusable when the container holds exactly one', () => {
        const { container, buttons } = mountContainer(1);
        const only = buttons[0] as HTMLButtonElement;
        only.focus();

        // Sole element is simultaneously first and last, so both directions wrap
        // onto itself rather than escaping.
        const forward = tabThroughTrap(container);
        expect(forward.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(only);

        const backward = tabThroughTrap(container, { shiftKey: true });
        expect(backward.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(only);
    });

    it('pulls focus onto the single focusable when focus was lost', () => {
        const { container, buttons, outside } = mountContainer(1);
        outside.focus();
        outside.blur();

        const event = tabThroughTrap(container);

        expect(event.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(buttons[0]);
    });

    it('does NOT prevent Tab when the container has no focusable descendants', () => {
        // Trapping with nowhere to send focus would be a real keyboard trap
        // (WCAG 2.1.2) — worse than the leak it would be closing.
        const { container, outside } = mountContainer(0);
        container.appendChild(document.createTextNode('nothing focusable here'));
        outside.focus();

        const event = tabThroughTrap(container);

        expect(event.defaultPrevented).toBe(false);
        expect(document.activeElement).toBe(outside);
    });

    it('ignores every key that is not Tab', () => {
        const { container, outside } = mountContainer(3);
        outside.focus();

        for (const key of ['Escape', 'Enter', 'ArrowDown', 'a']) {
            const event = tabThroughTrap(container, { key });
            expect(event.defaultPrevented).toBe(false);
            expect(document.activeElement).toBe(outside);
        }
    });

    it('skips disabled controls when picking the ring boundaries', () => {
        const { container, buttons, outside } = mountContainer(3);
        (buttons[0] as HTMLButtonElement).disabled = true;
        outside.focus();
        outside.blur();

        const event = tabThroughTrap(container);

        expect(event.defaultPrevented).toBe(true);
        // The disabled first button is not a valid target — focus lands on the
        // first ENABLED control instead.
        expect(document.activeElement).toBe(buttons[1]);
    });
});
