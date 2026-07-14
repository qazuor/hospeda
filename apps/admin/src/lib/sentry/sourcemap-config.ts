/**
 * @fileoverview
 * Pure resolver for the admin app's Vite `build.sourcemap` setting.
 *
 * Extracted out of `vite.config.ts` (which Vitest cannot import/exercise
 * directly) so the BETA-66 source-map gating logic has a regression test.
 *
 * BETA-66: in production, source maps must only ever be generated when
 * `SENTRY_AUTH_TOKEN` is present, because the Sentry upload+delete step
 * (`sourcemaps.filesToDeleteAfterUpload` in `sentryVitePlugin`) only runs
 * inside that same token-gated plugin registration. Generating `'hidden'`
 * source maps unconditionally in production would leak them to the CDN
 * whenever the token is missing, since nothing would delete the `.map`
 * files afterward. In non-production builds, source maps are always
 * generated (`true`) for local debugging — they are served by the dev
 * server, not shipped to any CDN, so there is no leak risk.
 */

/** Inputs needed to resolve the admin app's build-time sourcemap setting. */
export type ResolveSourcemapSettingParams = {
    /** Value of `process.env.SENTRY_AUTH_TOKEN` at build time (may be unset). */
    readonly authToken: string | undefined;
    /** Whether this is a production build (`process.env.NODE_ENV === 'production'`). */
    readonly isProduction: boolean;
};

/**
 * Resolves the Vite `build.sourcemap` value for the admin app.
 *
 * - Production + Sentry auth token: `'hidden'` — maps are generated on disk
 *   for the Sentry upload step, but never referenced via a
 *   `//# sourceMappingURL=` comment, and `sentryVitePlugin` deletes them
 *   from the output directory after upload.
 * - Production, no token: `false` — no maps are generated at all
 *   (fail-safe; no token means nothing will delete them, so they must
 *   never exist in the shipped output).
 * - Non-production: `true` — full source maps for local debugging, served
 *   directly by the dev server, never shipped to a CDN.
 *
 * @param params - See {@link ResolveSourcemapSettingParams}.
 * @returns `'hidden'`, `false`, or `true` depending on environment and token presence.
 */
export const resolveSourcemapSetting = ({
    authToken,
    isProduction
}: ResolveSourcemapSettingParams): 'hidden' | false | true => {
    if (!isProduction) {
        return true;
    }
    return authToken ? 'hidden' : false;
};
