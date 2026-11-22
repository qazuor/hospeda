/**
 * HOS-2410 web-ui §2 (AC-3, AC-4) — the audience tabs enhancement.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    HELP_AUDIENCE_CHANGED_EVENT,
    HELP_SELECT_AUDIENCE_EVENT
} from '../../../src/lib/help/help-audience';
import {
    HELP_TABS_ENHANCED_CLASS,
    initHelpTabs,
    nextTabIndex,
    tabScrollLeft
} from '../../../src/lib/help/help-tabs';

const AUDIENCES = ['host', 'venue', 'partner'] as const;

function mount(selected: string): HTMLElement {
    document.body.innerHTML = `
      <div data-help-tabs data-selected="${selected}">
        <div role="tablist" hidden>
          ${AUDIENCES.map(
              (a) =>
                  `<button type="button" role="tab" id="tab-${a}" aria-controls="panel-${a}" data-audience="${a}" aria-selected="${a === selected}">${a}</button>`
          ).join('')}
        </div>
        ${AUDIENCES.map((a) => `<section id="panel-${a}"><h2>${a}</h2></section>`).join('')}
      </div>`;
    return document.querySelector<HTMLElement>('[data-help-tabs]') as HTMLElement;
}

const panel = (a: string) => document.getElementById(`panel-${a}`) as HTMLElement;
const tab = (a: string) => document.getElementById(`tab-${a}`) as HTMLButtonElement;

describe('initHelpTabs', () => {
    let cleanup: () => void = () => undefined;

    beforeEach(() => {
        window.history.replaceState(null, '', '/es/mi-cuenta/ayuda/');
    });

    afterEach(() => {
        cleanup();
        document.body.innerHTML = '';
    });

    it('leaves every panel visible before it runs (AC-4: no JS shows them all)', () => {
        mount('host');
        expect(AUDIENCES.every((a) => !panel(a).hidden)).toBe(true);
        expect(document.querySelector<HTMLElement>('[role="tablist"]')?.hidden).toBe(true);
    });

    it('keeps the server-selected tab and hides the other panels (AC-3)', () => {
        // Arrange
        const root = mount('partner');

        // Act
        cleanup = initHelpTabs({ root });

        // Assert
        expect(root.classList.contains(HELP_TABS_ENHANCED_CLASS)).toBe(true);
        expect(tab('partner').getAttribute('aria-selected')).toBe('true');
        expect(panel('partner').hidden).toBe(false);
        expect(panel('host').hidden).toBe(true);
        expect(panel('partner').getAttribute('role')).toBe('tabpanel');
        expect(window.location.search).toBe('');
    });

    it('selects on click, writes ?para= and announces the change', () => {
        // Arrange
        const root = mount('host');
        const changed = vi.fn();
        window.addEventListener(HELP_AUDIENCE_CHANGED_EVENT, changed);
        cleanup = initHelpTabs({ root });

        // Act
        tab('venue').click();

        // Assert
        expect(panel('venue').hidden).toBe(false);
        expect(panel('host').hidden).toBe(true);
        expect(new URL(window.location.href).searchParams.get('para')).toBe('venue');
        expect(changed).toHaveBeenLastCalledWith(
            expect.objectContaining({ detail: { audience: 'venue' } })
        );
        window.removeEventListener(HELP_AUDIENCE_CHANGED_EVENT, changed);
    });

    it('selects on a request event from the preselect island', () => {
        // Arrange
        const root = mount('host');
        cleanup = initHelpTabs({ root });

        // Act
        window.dispatchEvent(
            new CustomEvent(HELP_SELECT_AUDIENCE_EVENT, { detail: { audience: 'partner' } })
        );

        // Assert
        expect(tab('partner').getAttribute('aria-selected')).toBe('true');
        expect(tab('partner').tabIndex).toBe(0);
        expect(tab('host').tabIndex).toBe(-1);
    });

    it('moves with the arrow keys and wraps', () => {
        // Arrange
        const root = mount('host');
        cleanup = initHelpTabs({ root });

        // Act
        tab('host').dispatchEvent(
            new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })
        );

        // Assert
        expect(tab('partner').getAttribute('aria-selected')).toBe('true');
        expect(document.activeElement).toBe(tab('partner'));
    });
});

describe('nextTabIndex', () => {
    it('wraps arrows and jumps with Home and End', () => {
        expect(nextTabIndex({ key: 'ArrowRight', current: 2, count: 3 })).toBe(0);
        expect(nextTabIndex({ key: 'ArrowLeft', current: 0, count: 3 })).toBe(2);
        expect(nextTabIndex({ key: 'Home', current: 2, count: 3 })).toBe(0);
        expect(nextTabIndex({ key: 'End', current: 0, count: 3 })).toBe(2);
        expect(nextTabIndex({ key: 'a', current: 0, count: 3 })).toBeUndefined();
    });
});

describe('tabScrollLeft (one-row tablist on narrow screens, HOS-2552)', () => {
    it('keeps the scroll when the tab is already in view', () => {
        expect(tabScrollLeft({ tabStart: 40, tabWidth: 80, viewStart: 0, viewWidth: 300 })).toBe(0);
    });

    it('scrolls right just enough to show a tab cut on the right', () => {
        expect(tabScrollLeft({ tabStart: 280, tabWidth: 100, viewStart: 0, viewWidth: 300 })).toBe(
            80
        );
    });

    it('scrolls left to a tab hidden on the left', () => {
        expect(tabScrollLeft({ tabStart: 20, tabWidth: 100, viewStart: 150, viewWidth: 300 })).toBe(
            20
        );
    });

    it('aligns a tab wider than the view to its start', () => {
        expect(tabScrollLeft({ tabStart: 400, tabWidth: 500, viewStart: 0, viewWidth: 300 })).toBe(
            400
        );
    });
});
