/**
 * Eagerly links CommonJS -> ESM-only dependency bridges at server boot.
 *
 * ## The failure this prevents (HOS-370)
 *
 * When a CommonJS package `require()`s a dependency that ships ESM only
 * (`"type": "module"` with no CommonJS build), Node 22 handles it through the
 * `require(esm)` path: `loadESMFromCJS` must link that whole ESM subgraph
 * **synchronously**. If the same subgraph is concurrently being instantiated by
 * an `import()` from another lazily-loaded route chunk, the synchronous link
 * loses the race and throws:
 *
 * ```
 * Error: request for './<some-file>.js' is from a module not been linked
 * ```
 *
 * Node then caches the *rejected* module for that chunk, so every subsequent
 * request to the affected route serves a 500 until the process restarts. In
 * production this took every destination detail page down for roughly an hour
 * after a deploy, while the rest of the site kept serving 200s — the routes that
 * won the race were unaffected.
 *
 * ## Why importing here fixes it
 *
 * These are plain static imports, so the bundler hoists them into the server
 * **entry** chunk instead of leaving them inside a route chunk. Node therefore
 * links each subgraph during boot, which is single-threaded and happens before
 * the HTTP listener accepts any connection. With no concurrent `import()` in
 * flight there is no race left to lose, and every later import resolves from the
 * already-populated module cache.
 *
 * ## When to add an entry here
 *
 * `test/integration/cjs-esm-bridges.test.ts` scans the installed dependency tree
 * for CommonJS packages that depend on ESM-only packages and fails if one is
 * reachable from this app without being handled — either bundled via
 * `ssr.noExternal` in `astro.config.mjs` (preferred, it removes the
 * `require(esm)` call entirely) or warmed here (for packages that are impractical
 * to bundle). Read that test before adding to this list.
 *
 * @module warm-cjs-esm-bridges
 */

// `better-auth` reaches `@better-auth/utils` (CommonJS), which requires
// `@noble/hashes` (ESM-only). It is only imported from `src/lib/auth-client.ts`,
// which the bundler places in a lazily-loaded chunk, so without this import the
// bridge would be linked mid-traffic. Bundling `better-auth` instead was
// rejected: its conditional exports and plugin entry points make it a far
// riskier build-time change than sanitize-html was.
import 'better-auth';

/**
 * Marker used to keep this module in the server entry's static graph.
 *
 * The imports above are side-effectful, but a module with only side-effect
 * imports and no exports can be dropped by aggressive tree-shaking. Importing
 * and referencing this constant from `src/middleware.ts` guarantees the module
 * survives into the entry chunk.
 */
export const CJS_ESM_BRIDGES_WARMED = true as const;
