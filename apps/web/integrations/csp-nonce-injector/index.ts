/**
 * @file index.ts
 * @description Astro integration that stamps the per-request CSP nonce onto
 * inline <style> and <script> tags Astro emits without one. Skeleton only —
 * the HTML walker lands in T-002 and the hook wiring in T-003.
 *
 * Architecture: Path A2 from
 * `.claude/specs/SPEC-046-csp-post-deploy-verification/research/astro-csp-options.md`.
 * Keep middleware as the single CSP source, transform rendered HTML post-render
 * to inject the nonce already present in `context.locals.cspNonce`.
 */

import type { AstroIntegration } from 'astro';

/**
 * Creates the csp-nonce-injector Astro integration.
 *
 * Hooks registered here are placeholders for T-002 / T-003:
 * - `astro:server:setup` will eventually attach the dev-mode middleware that
 *   rewrites response bodies to stamp the request nonce.
 * - `astro:build:done` is kept as a no-op anchor for any build-time work the
 *   integration might need (currently none — the rewrite is per-request).
 *
 * @returns An AstroIntegration with name 'csp-nonce-injector'.
 */
export function cspNonceInjector(): AstroIntegration {
    return {
        name: 'csp-nonce-injector',
        hooks: {
            'astro:server:setup': () => {
                // Placeholder. T-003 will register the dev middleware here.
            },
            'astro:build:done': () => {
                // Placeholder. No build-time work today; kept as anchor.
            }
        }
    };
}

export default cspNonceInjector;
