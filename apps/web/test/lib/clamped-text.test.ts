// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { initClampedText } from '@/lib/clamped-text';

function mount({ scrollHeight, clientHeight }: { scrollHeight: number; clientHeight: number }) {
    document.body.innerHTML = `
        <div data-clamped-text>
            <div data-clamped-body>Full text stays in the DOM</div>
            <button type="button" aria-expanded="false" hidden data-clamped-toggle
                data-label-more="Leer más" data-label-less="Leer menos">Leer más</button>
        </div>`;
    const body = document.querySelector<HTMLElement>('[data-clamped-body]') as HTMLElement;
    Object.defineProperty(body, 'scrollHeight', { value: scrollHeight, configurable: true });
    Object.defineProperty(body, 'clientHeight', { value: clientHeight, configurable: true });
    initClampedText({ root: document });
    return {
        body,
        toggle: document.querySelector<HTMLButtonElement>(
            '[data-clamped-toggle]'
        ) as HTMLButtonElement,
        block: document.querySelector<HTMLElement>('[data-clamped-text]') as HTMLElement
    };
}

describe('initClampedText', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('keeps the toggle hidden when the text fits (AC-2.4)', () => {
        const { toggle, body } = mount({ scrollHeight: 100, clientHeight: 100 });
        expect(toggle.hidden).toBe(true);
        expect(body.textContent).toContain('Full text stays in the DOM');
    });

    it('shows the toggle when the text overflows', () => {
        const { toggle } = mount({ scrollHeight: 300, clientHeight: 100 });
        expect(toggle.hidden).toBe(false);
    });

    it('flips aria-expanded and the label on click, and back', () => {
        const { toggle, block } = mount({ scrollHeight: 300, clientHeight: 100 });
        toggle.click();
        expect(toggle.getAttribute('aria-expanded')).toBe('true');
        expect(block.dataset.expanded).toBe('true');
        expect(toggle.textContent).toBe('Leer menos');
        toggle.click();
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        expect(toggle.textContent).toBe('Leer más');
    });

    it('initialises a block only once', () => {
        const { toggle } = mount({ scrollHeight: 300, clientHeight: 100 });
        initClampedText({ root: document });
        toggle.click();
        expect(toggle.getAttribute('aria-expanded')).toBe('true');
    });
});
