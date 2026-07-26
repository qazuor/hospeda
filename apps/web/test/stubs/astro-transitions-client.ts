/**
 * Stub for `astro:transitions/client` used in Vitest.
 *
 * The real virtual module is provided by Astro's vite plugins at build/SSR
 * time; tests running React islands in jsdom never traverse that pipeline,
 * so we provide a minimal no-op stand-in to satisfy the imports.
 *
 * `vitest.config.ts` maps the virtual specifier here through a resolve alias,
 * which `vi.mock('astro:transitions/client')` does NOT intercept. A test that
 * needs real router behaviour therefore injects it with `__setNavigateImpl`
 * rather than mocking the module — see `test/lib/dialog-history.test.ts`.
 */

type NavigateImpl = (href: string, options?: unknown) => void | Promise<void>;

let navigateImpl: NavigateImpl | null = null;

/**
 * Installs a stand-in for `navigate` for the duration of a test. Pass `null`
 * to restore the default no-op.
 *
 * @internal test-only
 */
export function __setNavigateImpl(impl: NavigateImpl | null): void {
    navigateImpl = impl;
}

export function navigate(href: string, options?: unknown): void | Promise<void> {
    // no-op in test environment unless a test injected an implementation
    return navigateImpl?.(href, options);
}

export function transitionEnabledOnThisPage(): boolean {
    return false;
}

export function getFallback(): string {
    return 'animate';
}

export function supportsViewTransitions(): boolean {
    return false;
}
