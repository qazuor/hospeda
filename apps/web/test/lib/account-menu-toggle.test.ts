/**
 * Regression tests for the account header's hamburger (HOS-2550): before the
 * fix nothing listened to its click on account pages, so `aria-expanded` never
 * changed and the site menu stayed off screen.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    MOBILE_MENU_OPEN_ATTRIBUTE,
    MOBILE_MENU_TOGGLE_EVENT,
    syncAccountMenuExpanded,
    wireAccountMenuToggle
} from '../../src/lib/account-menu-toggle';

/** A fresh document, so the per-document wiring starts clean in each test. */
function freshDocument(): Document {
    const doc = document.implementation.createHTMLDocument('account');
    doc.body.innerHTML = `
        <header>
            <button type="button" data-account-mobile-toggle aria-expanded="false">
                <span data-icon>menu</span>
            </button>
            <button type="button" data-mobile-toggle>site</button>
        </header>`;
    return doc;
}

afterEach(() => {
    document.documentElement.removeAttribute(MOBILE_MENU_OPEN_ATTRIBUTE);
    document.body.innerHTML = '';
});

describe('wireAccountMenuToggle', () => {
    it('dispatches the menu event when the hamburger (or its icon) is clicked', () => {
        // Arrange: the live document, the one the island listens on.
        document.body.innerHTML =
            '<button type="button" data-account-mobile-toggle aria-expanded="false"><span data-icon>menu</span></button>';
        const listener = vi.fn();
        window.addEventListener(MOBILE_MENU_TOGGLE_EVENT, listener);
        wireAccountMenuToggle({ doc: document });

        // Act
        (document.querySelector('[data-icon]') as HTMLElement).click();

        // Assert
        expect(listener).toHaveBeenCalledTimes(1);
        window.removeEventListener(MOBILE_MENU_TOGGLE_EVENT, listener);
    });

    it('ignores the site header hamburger, which has its own listener', () => {
        // A detached document has no window, so this runs on the live one.
        document.body.innerHTML = freshDocument().body.innerHTML;
        const listener = vi.fn();
        window.addEventListener(MOBILE_MENU_TOGGLE_EVENT, listener);
        wireAccountMenuToggle({ doc: document });

        (document.querySelector('[data-mobile-toggle]') as HTMLElement).click();
        expect(listener).not.toHaveBeenCalled();

        (document.querySelector('[data-account-mobile-toggle]') as HTMLElement).click();
        expect(listener).toHaveBeenCalledTimes(1);
        window.removeEventListener(MOBILE_MENU_TOGGLE_EVENT, listener);
    });

    it('wires a document once, so one click never toggles twice', () => {
        document.body.innerHTML =
            '<button type="button" data-account-mobile-toggle aria-expanded="false"></button>';
        const listener = vi.fn();
        window.addEventListener(MOBILE_MENU_TOGGLE_EVENT, listener);

        // The live document is already wired by the tests above (module state).
        wireAccountMenuToggle({ doc: document });
        const second = wireAccountMenuToggle({ doc: document });
        (document.querySelector('[data-account-mobile-toggle]') as HTMLElement).click();

        expect(second).toBe(false);
        expect(listener).toHaveBeenCalledTimes(1);
        window.removeEventListener(MOBILE_MENU_TOGGLE_EVENT, listener);
    });

    it('mirrors the menu state onto aria-expanded as the menu opens and closes', async () => {
        document.body.innerHTML =
            '<button type="button" data-account-mobile-toggle aria-expanded="false"></button>';
        wireAccountMenuToggle({ doc: document });
        const button = document.querySelector('[data-account-mobile-toggle]') as HTMLElement;

        document.documentElement.setAttribute(MOBILE_MENU_OPEN_ATTRIBUTE, '');
        await Promise.resolve();
        expect(button).toHaveAttribute('aria-expanded', 'true');

        document.documentElement.removeAttribute(MOBILE_MENU_OPEN_ATTRIBUTE);
        await Promise.resolve();
        expect(button).toHaveAttribute('aria-expanded', 'false');
    });
});

describe('wireAccountMenuToggle on a new document', () => {
    it('wires it the first time and refuses the second', () => {
        const doc = freshDocument();
        expect(wireAccountMenuToggle({ doc })).toBe(true);
        expect(wireAccountMenuToggle({ doc })).toBe(false);
    });
});

describe('syncAccountMenuExpanded', () => {
    it('sets aria-expanded from the <html> open attribute', () => {
        // A detached document: jest-dom matchers reject its elements (other
        // realm), so the attribute is read directly.
        const doc = freshDocument();
        const button = doc.querySelector('[data-account-mobile-toggle]') as HTMLElement;

        doc.documentElement.setAttribute(MOBILE_MENU_OPEN_ATTRIBUTE, '');
        syncAccountMenuExpanded({ doc });
        expect(button.getAttribute('aria-expanded')).toBe('true');

        doc.documentElement.removeAttribute(MOBILE_MENU_OPEN_ATTRIBUTE);
        syncAccountMenuExpanded({ doc });
        expect(button.getAttribute('aria-expanded')).toBe('false');
    });
});
