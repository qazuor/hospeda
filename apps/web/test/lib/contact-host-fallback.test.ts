// @vitest-environment jsdom
/**
 * @file contact-host-fallback.test.ts
 * @description HOS-2537: the shell swaps an unhydrated form for public channels.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { revealContactFallbackIfHydrationFailed } from '@/lib/contact-host-fallback';

function mount({ ssr }: { readonly ssr: boolean }): { form: HTMLElement; fallback: HTMLElement } {
    document.body.innerHTML = `
        <div data-contact-shell>
            <div data-contact-form><astro-island ${ssr ? 'ssr' : ''}></astro-island></div>
            <div data-contact-fallback hidden></div>
        </div>`;
    return {
        form: document.querySelector<HTMLElement>('[data-contact-form]') as HTMLElement,
        fallback: document.querySelector<HTMLElement>('[data-contact-fallback]') as HTMLElement
    };
}

describe('revealContactFallbackIfHydrationFailed', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('reveals the fallback and hides the form when the island never hydrated', () => {
        const { form, fallback } = mount({ ssr: true });
        revealContactFallbackIfHydrationFailed({ root: document, graceMs: 100 });
        vi.advanceTimersByTime(100);
        expect(form.hidden).toBe(true);
        expect(fallback.hidden).toBe(false);
    });

    it('leaves the form alone when the island hydrated', () => {
        const { form, fallback } = mount({ ssr: false });
        revealContactFallbackIfHydrationFailed({ root: document, graceMs: 100 });
        vi.advanceTimersByTime(100);
        expect(form.hidden).toBe(false);
        expect(fallback.hidden).toBe(true);
    });

    it('does nothing before the grace period ends', () => {
        const { fallback } = mount({ ssr: true });
        revealContactFallbackIfHydrationFailed({ root: document, graceMs: 100 });
        vi.advanceTimersByTime(50);
        expect(fallback.hidden).toBe(true);
    });

    it('restores the form and hides the fallback when the island hydrates late', async () => {
        const { form, fallback } = mount({ ssr: true });
        revealContactFallbackIfHydrationFailed({ root: document, graceMs: 100 });
        vi.advanceTimersByTime(100);
        expect(fallback.hidden).toBe(false);

        document.querySelector('astro-island')?.removeAttribute('ssr');
        await Promise.resolve();

        expect(form.hidden).toBe(false);
        expect(fallback.hidden).toBe(true);
    });

    describe('client:media islands', () => {
        function mountMedia({ query }: { readonly query: string }): HTMLElement {
            document.body.innerHTML = `
                <div data-contact-shell>
                    <div data-contact-form>
                        <astro-island ssr client="media" opts='${JSON.stringify({ name: 'Card', value: query })}'></astro-island>
                    </div>
                    <div data-contact-fallback hidden></div>
                </div>`;
            return document.querySelector<HTMLElement>('[data-contact-fallback]') as HTMLElement;
        }

        afterEach(() => vi.unstubAllGlobals());

        it('does not treat a dormant media island (desktop card on mobile) as a failed hydration', () => {
            vi.stubGlobal('matchMedia', () => ({ matches: false }));
            const fallback = mountMedia({ query: '(min-width: 768px)' });
            revealContactFallbackIfHydrationFailed({ root: document, graceMs: 100 });
            vi.advanceTimersByTime(100);
            expect(fallback.hidden).toBe(true);
        });

        it('still reveals the fallback when the media query matches and the island never hydrated', () => {
            vi.stubGlobal('matchMedia', () => ({ matches: true }));
            const fallback = mountMedia({ query: '(min-width: 768px)' });
            revealContactFallbackIfHydrationFailed({ root: document, graceMs: 100 });
            vi.advanceTimersByTime(100);
            expect(fallback.hidden).toBe(false);
        });
    });
});
