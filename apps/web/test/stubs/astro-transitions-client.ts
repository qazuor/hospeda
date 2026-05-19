/**
 * Stub for `astro:transitions/client` used in Vitest.
 *
 * The real virtual module is provided by Astro's vite plugins at build/SSR
 * time; tests running React islands in jsdom never traverse that pipeline,
 * so we provide a minimal no-op stand-in to satisfy the imports.
 */

export function navigate(_href: string, _options?: unknown): void {
    // no-op in test environment
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
