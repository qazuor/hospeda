/** Initialize measured overflow affordances, including resized and navigated tables. */
export function initComparisonScroll(): void {
    for (const root of document.querySelectorAll<HTMLElement>('[data-comparison-scroll]')) {
        if (root.dataset.scrollReady) continue;
        const viewport = root.querySelector<HTMLElement>('[data-comparison-viewport]');
        if (!viewport) continue;
        root.dataset.scrollReady = 'true';
        const update = () => {
            root.dataset.scrollable = String(viewport.scrollWidth > viewport.clientWidth + 1);
            root.dataset.atEnd = String(
                viewport.scrollLeft + viewport.clientWidth >= viewport.scrollWidth - 1
            );
        };
        viewport.addEventListener('scroll', update, { passive: true });
        const observer = new ResizeObserver(update);
        observer.observe(viewport);
        const table = viewport.querySelector('table');
        if (table) observer.observe(table);
        document.addEventListener(
            'astro:before-swap',
            () => {
                observer.disconnect();
                viewport.removeEventListener('scroll', update);
            },
            { once: true }
        );
        update();
    }
}
