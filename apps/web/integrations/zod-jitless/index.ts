/**
 * @file integrations/zod-jitless/index.ts
 * @description Turns Zod's `jitless` on in every BROWSER bundle of the web app,
 * inside Zod itself, before any schema can exist (HOS-2558).
 *
 * Zod 4 decides once per realm, the first time it builds an object schema,
 * whether it may compile validators with `new Function`. Under the site's CSP
 * (no `unsafe-eval`) that probe is reported as a `securitypolicyviolation`
 * even though Zod swallows the exception. `z.config({ jitless: true })` skips
 * the probe, but only if it runs BEFORE the first object schema; a config call
 * in `@repo/schemas` lost that race to every module that imports `zod`
 * directly and builds a schema at load (`listing-contact-price.ts`,
 * `@repo/analytics`' catalogs, ...).
 *
 * So the setting is not left to import order at all. Zod's core module reads
 * its config object from `globalThis.__zod_globalConfig`, and its eval probe
 * reads `jitless` lazily from that object. This plugin appends one statement to
 * that core module, in client bundles only, that sets `jitless` on it. Every
 * entry point (`zod`, `zod/v4`, `zod/mini`, a dependency's own import) goes
 * through that one module, so no import, wrapper or lint rule can be forgotten.
 *
 * - Server bundles (SSR) are untouched: they keep the compiled fast path, and
 *   the CSP is a browser concept. `apps/admin` and `apps/api` are untouched.
 * - Appending moves no existing code, so the module's source map stays valid
 *   (`map: null` tells the bundler to keep it).
 * - If a Zod upgrade stops reading `__zod_globalConfig`, the build FAILS here
 *   instead of shipping a silent no-op.
 *
 * Verified over the production output by `scripts/verify-zod-jitless-build.mjs`.
 */

/** Matches Zod 4's core module, wherever the package manager put it. */
const ZOD_CORE_MODULE = /[\\/]zod[\\/]v4[\\/]core[\\/]core\.js(?:\?|$)/;

/** The global Zod 4 reads its config object from. */
export const ZOD_GLOBAL_CONFIG_KEY = '__zod_globalConfig';

/** The statement appended to Zod's core module in client bundles. */
export const ZOD_JITLESS_STATEMENT = `\n;(globalThis.${ZOD_GLOBAL_CONFIG_KEY} ??= {}).jitless = true;\n`;

/** The bits of a Vite/Rolldown plugin context this plugin reads. */
interface TransformContext {
    readonly environment?: { readonly config?: { readonly consumer?: string } };
}

/** Structural Vite/Rolldown plugin shape, so the app needs no direct `vite` dependency. */
export interface ZodJitlessPlugin {
    readonly name: string;
    readonly enforce: 'pre';
    transform(
        this: TransformContext | undefined,
        code: string,
        id: string,
        options?: { readonly ssr?: boolean }
    ): { readonly code: string; readonly map: null } | null;
}

/**
 * Creates the plugin. Register it in `vite.plugins` (production build and dev
 * transforms) AND in `optimizeDeps.rolldownOptions.plugins` (the dev server's
 * pre-bundled copy of Zod, which never goes through `vite.plugins`).
 *
 * @returns A plugin object compatible with Vite and Rolldown.
 */
export function zodJitlessClientPlugin(): ZodJitlessPlugin {
    return {
        name: 'hospeda-zod-jitless-client',
        enforce: 'pre',
        transform(code, id, options) {
            if (!ZOD_CORE_MODULE.test(id)) return null;
            const isServer = this?.environment?.config?.consumer === 'server' || options?.ssr;
            if (isServer) return null;
            if (!code.includes(ZOD_GLOBAL_CONFIG_KEY)) {
                throw new Error(
                    `[hospeda-zod-jitless-client] ${id} no longer reads globalThis.${ZOD_GLOBAL_CONFIG_KEY}. ` +
                        'A Zod upgrade changed how its config is stored; update this plugin (HOS-2558) ' +
                        'or browser bundles will probe `new Function` under the CSP again.'
                );
            }
            return { code: `${code}${ZOD_JITLESS_STATEMENT}`, map: null };
        }
    };
}
