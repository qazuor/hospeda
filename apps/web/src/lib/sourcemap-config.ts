/**
 * @fileoverview
 * Pure resolver for the web app's Vite `build.sourcemap` setting.
 *
 * Extracted out of `astro.config.mjs` (which Vitest cannot import/exercise
 * directly) so the BETA-66 source-map gating logic has a regression test.
 *
 * BETA-66: source maps must only ever be generated when `SENTRY_AUTH_TOKEN`
 * is present, because the Sentry upload+delete step
 * (`sourcemaps.filesToDeleteAfterUpload` in the `sentry()` integration) only
 * runs inside that same token-gated branch. Generating `'hidden'` source
 * maps unconditionally would leak them to the CDN whenever the token is
 * missing, since nothing would delete the `.map` files afterward.
 */

/** Inputs needed to resolve the web app's build-time sourcemap setting. */
export type ResolveSourcemapSettingParams = {
    /** Value of `process.env.SENTRY_AUTH_TOKEN` at build time (may be unset). */
    readonly authToken: string | undefined;
};

/**
 * Resolves the Vite `build.sourcemap` value for the web app.
 *
 * - With a Sentry auth token: `'hidden'` — maps are generated on disk for
 *   the Sentry upload step, but never referenced via a
 *   `//# sourceMappingURL=` comment, and the `sentry()` integration deletes
 *   them from the output directory after upload.
 * - Without a token: `false` — no maps are generated at all (fail-safe; no
 *   token means nothing will delete them, so they must never exist in the
 *   shipped output).
 *
 * @param params - See {@link ResolveSourcemapSettingParams}.
 * @returns `'hidden'` when a Sentry auth token is present, otherwise `false`.
 */
export const resolveSourcemapSetting = ({
    authToken
}: ResolveSourcemapSettingParams): 'hidden' | false => {
    return authToken ? 'hidden' : false;
};

/**
 * The `sourcemaps` option passed to the `@sentry/astro` integration.
 *
 * - With a token: keep the upload path and delete the generated `.map` files
 *   from the output directory afterwards so they never ship to the CDN.
 * - Without a token: explicitly disable all source-map functionality so the
 *   Sentry Vite plugin does not emit its "no auth token, skipping source map
 *   upload" warning at every tokenless build.
 */
export type SentrySourcemapsOption =
    | { readonly disable: true }
    | { readonly filesToDeleteAfterUpload: readonly string[] };

/**
 * Resolves the `sourcemaps` sub-option for the `@sentry/astro` integration.
 *
 * This is DECOUPLED from whether the integration itself runs: the integration
 * must always be active so it injects the client/server runtime
 * instrumentation (`sentry.client.config.ts` / `sentry.server.config.ts`).
 * Only source-map UPLOAD depends on `SENTRY_AUTH_TOKEN`, because uploading is
 * the only step that needs the token. Gating the whole integration on the
 * token (the previous behavior) silently disabled browser error tracking in
 * every build where the token was not forwarded as a build arg.
 *
 * @param params - See {@link ResolveSourcemapSettingParams}.
 * @returns `{ disable: true }` when no token is present, otherwise
 *   `{ filesToDeleteAfterUpload: ['**\/*.map'] }`.
 */
export const resolveSentrySourcemapsOption = ({
    authToken
}: ResolveSourcemapSettingParams): SentrySourcemapsOption => {
    return authToken ? { filesToDeleteAfterUpload: ['**/*.map'] } : { disable: true };
};
