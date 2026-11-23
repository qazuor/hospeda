/**
 * Client behaviour of `ClampedText.astro`: reveals the «Leer más» toggle only when the
 * clamped body overflows, and keeps `aria-expanded` and the label in sync.
 */

/**
 * Wires every not-yet-initialised `[data-clamped-text]` block under `root`.
 * Idempotent: a block is initialised once.
 */
export function initClampedText({ root }: { readonly root: ParentNode }): void {
    for (const block of root.querySelectorAll<HTMLElement>('[data-clamped-text]')) {
        if (block.dataset.clampedInit === 'true') continue;
        block.dataset.clampedInit = 'true';
        const body = block.querySelector<HTMLElement>('[data-clamped-body]');
        const toggle = block.querySelector<HTMLButtonElement>('[data-clamped-toggle]');
        if (!body || !toggle) continue;

        const measure = (): void => {
            if (block.dataset.expanded === 'true') return;
            toggle.hidden = body.scrollHeight <= body.clientHeight + 1;
        };

        toggle.addEventListener('click', () => {
            const expanded = toggle.getAttribute('aria-expanded') !== 'true';
            toggle.setAttribute('aria-expanded', String(expanded));
            block.dataset.expanded = String(expanded);
            toggle.textContent =
                (expanded ? toggle.dataset.labelLess : toggle.dataset.labelMore) ?? '';
            if (!expanded) measure();
        });

        measure();
        window.addEventListener('resize', measure);
        if (typeof ResizeObserver !== 'undefined') new ResizeObserver(measure).observe(body);
    }
}
