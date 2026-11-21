/**
 * HOS-2410 web-ui §4 — the side index highlight.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { initHelpToc, markHelpTocCurrent } from '../../../src/lib/help/help-toc';

function mount(): HTMLElement[] {
    document.body.innerHTML = `
      <nav data-help-toc><a href="#a">A</a><a href="#b">B</a></nav>
      <nav data-help-toc><a href="#a">A</a><a href="#b">B</a></nav>
      <h2 id="a">A</h2><h2 id="b">B</h2>`;
    return [...document.querySelectorAll<HTMLElement>('[data-help-toc]')];
}

describe('help side index', () => {
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

    it('marks the topmost visible heading when the observer reports it', () => {
        // Arrange
        const navs = mount();
        let report: IntersectionObserverCallback = () => undefined;
        class FakeObserver {
            constructor(callback: IntersectionObserverCallback) {
                report = callback;
            }
            observe(): void {}
            disconnect(): void {}
        }

        // Act
        initHelpToc({ navs, Observer: FakeObserver as unknown as typeof IntersectionObserver });
        const target = document.getElementById('a') as HTMLElement;
        report(
            [{ isIntersecting: true, target } as unknown as IntersectionObserverEntry],
            {} as IntersectionObserver
        );

        // Assert
        expect(navs[0]?.querySelector('a[href="#a"]')?.getAttribute('aria-current')).toBe(
            'location'
        );
    });
});
