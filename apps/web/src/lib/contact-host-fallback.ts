/**
 * @file contact-host-fallback.ts
 * @description Hydration-failure detector for `ContactHostShell.astro` (HOS-2537).
 *
 * An Astro island keeps its `ssr` attribute until it hydrates. If it is still
 * there well after the page loaded, the form is visible but cannot be sent, so
 * the shell swaps it for the listing's public contact channels.
 */

/** How long after `load` an island may take to hydrate before it counts as failed. */
export const HYDRATION_GRACE_MS = 10_000;

interface RevealParams {
    readonly root: Document;
    /** Grace period override (tests). Defaults to {@link HYDRATION_GRACE_MS}. */
    readonly graceMs?: number;
}

/**
 * Hide each shell's form and show its fallback when its island never hydrated.
 *
 * @param params.root - Document to inspect.
 * @param params.graceMs - Time to wait after `load` before checking.
 * @returns Nothing; schedules the check.
 */
export function revealContactFallbackIfHydrationFailed({
    root,
    graceMs = HYDRATION_GRACE_MS
}: RevealParams): void {
    const check = (): void => {
        for (const shell of root.querySelectorAll<HTMLElement>('[data-contact-shell]')) {
            if (!shell.querySelector('astro-island[ssr]')) continue;
            const form = shell.querySelector<HTMLElement>('[data-contact-form]');
            const fallback = shell.querySelector<HTMLElement>('[data-contact-fallback]');
            if (form) form.hidden = true;
            if (fallback) fallback.hidden = false;
        }
    };
    const schedule = (): void => {
        setTimeout(check, graceMs);
    };
    if (root.readyState === 'complete') schedule();
    else window.addEventListener('load', schedule, { once: true });
}
