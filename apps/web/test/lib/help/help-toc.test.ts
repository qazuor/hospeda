/**
 * HOS-2410 web-ui §4 — the side index highlight; HOS-2552 — the chosen
 * section is the one highlighted, not the short one above it.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    HELP_TOC_TOLERANCE_PX,
    initHelpToc,
    markHelpTocCurrent,
    pickHelpTocCurrent
} from '../../../src/lib/help/help-toc';

function mount(): HTMLElement[] {
    document.body.innerHTML = `
      <nav data-help-toc><a href="#a">A</a><a href="#b">B</a><a href="#c">C</a></nav>
      <nav data-help-toc><a href="#a">A</a><a href="#b">B</a><a href="#c">C</a></nav>
      <h2 id="a">A</h2><h2 id="b">B</h2><h2 id="c">C</h2>`;
    return [...document.querySelectorAll<HTMLElement>('[data-help-toc]')];
}

/** Puts each heading's top at the given viewport offset. */
function placeHeadings(tops: Readonly<Record<string, number>>): void {
    for (const [id, top] of Object.entries(tops)) {
        const element = document.getElementById(id) as HTMLElement;
        element.getBoundingClientRect = () => ({ top }) as DOMRect;
    }
}

const currentHref = (nav: HTMLElement | undefined) =>
    nav?.querySelector('a[aria-current="location"]')?.getAttribute('href');

describe('markHelpTocCurrent', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('marks one section current in every index', () => {
        // Arrange
        const navs = mount();

        // Act
        markHelpTocCurrent({ navs, id: 'b' });

        // Assert
        const current = document.querySelectorAll('a[aria-current="location"]');
        expect(current).toHaveLength(2);
        expect([...current].every((link) => link.getAttribute('href') === '#b')).toBe(true);
    });
});

describe('pickHelpTocCurrent', () => {
    const line = 88;

    it('picks the heading that sits on the landing line, not the short section above it', () => {
        // Arrange: «Qué NO esperar» is short, so its heading is still on screen
        // above the chosen «Problemas comunes», which landed on the line.
        const headings = [
            { id: 'que-no-esperar', top: 10, landingLine: line },
            { id: 'problemas-comunes', top: line, landingLine: line },
            { id: 'relacionados', top: 700, landingLine: line }
        ];

        // Act + Assert
        expect(pickHelpTocCurrent({ headings })).toBe('problemas-comunes');
    });

    it('counts a heading within the tolerance below the line', () => {
        const headings = [
            { id: 'a', top: -400, landingLine: line },
            { id: 'b', top: line + HELP_TOC_TOLERANCE_PX, landingLine: line }
        ];
        expect(pickHelpTocCurrent({ headings })).toBe('b');
    });

    it('falls back to the first heading before any reached the line', () => {
        const headings = [
            { id: 'a', top: 300, landingLine: line },
            { id: 'b', top: 900, landingLine: line }
        ];
        expect(pickHelpTocCurrent({ headings })).toBe('a');
    });

    it('picks nothing without headings', () => {
        expect(pickHelpTocCurrent({ headings: [] })).toBeUndefined();
    });
});

describe('initHelpToc', () => {
    let cleanup: () => void = () => undefined;
    let frames: FrameRequestCallback[] = [];

    /** Dispatches a scroll and runs the animation frame it requested. */
    const scroll = (): void => {
        window.dispatchEvent(new Event('scroll'));
        const pending = frames;
        frames = [];
        for (const callback of pending) callback(0);
    };

    beforeEach(() => {
        frames = [];
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
            frames.push(callback);
            return frames.length;
        });
    });

    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
        document.body.innerHTML = '';
    });

    it('marks the section under the navbar on start and follows the scroll', () => {
        // Arrange
        const navs = mount();
        placeHeadings({ a: 0, b: 400, c: 900 });

        // Act
        cleanup = initHelpToc({ navs });
        const first = currentHref(navs[0]);
        placeHeadings({ a: -800, b: -300, c: 5 });
        scroll();

        // Assert
        expect(first).toBe('#a');
        expect(currentHref(navs[0])).toBe('#c');
        expect(currentHref(navs[1])).toBe('#c');
    });

    it('marks a clicked entry at once and keeps it until the reader scrolls', () => {
        // Arrange
        const navs = mount();
        placeHeadings({ a: -800, b: 0, c: 300 });
        cleanup = initHelpToc({ navs });

        // Act: «C» is the last section; the page cannot scroll it to the line
        navs[0]?.querySelector<HTMLAnchorElement>('a[href="#c"]')?.click();
        scroll();
        const afterJump = currentHref(navs[0]);
        window.dispatchEvent(new Event('wheel'));
        scroll();

        // Assert
        expect(afterJump).toBe('#c');
        expect(currentHref(navs[0])).toBe('#b');
    });

    it('releases the pin on any pointer press (scrollbar drag, middle-click autoscroll)', () => {
        // Arrange
        const navs = mount();
        placeHeadings({ a: -800, b: 0, c: 300 });
        cleanup = initHelpToc({ navs });
        navs[0]?.querySelector<HTMLAnchorElement>('a[href="#c"]')?.click();

        // Act
        document.documentElement.dispatchEvent(new Event('pointerdown'));
        scroll();

        // Assert
        expect(currentHref(navs[0])).toBe('#b');
    });

    it('starts pinned to the section the URL hash names', () => {
        // Arrange: «C» is a late section that never reaches the line
        window.history.replaceState(null, '', '/es/mi-cuenta/ayuda/photos/#c');
        const navs = mount();
        placeHeadings({ a: -800, b: 0, c: 300 });

        // Act
        cleanup = initHelpToc({ navs });
        scroll();

        // Assert
        expect(currentHref(navs[0])).toBe('#c');
        window.history.replaceState(null, '', '/es/mi-cuenta/ayuda/photos/');
    });

    it('ignores a hash that names no section of the index', () => {
        window.history.replaceState(null, '', '/es/mi-cuenta/ayuda/photos/#nope');
        const navs = mount();
        placeHeadings({ a: -800, b: 0, c: 300 });
        cleanup = initHelpToc({ navs });
        expect(currentHref(navs[0])).toBe('#b');
        window.history.replaceState(null, '', '/es/mi-cuenta/ayuda/photos/');
    });
});
