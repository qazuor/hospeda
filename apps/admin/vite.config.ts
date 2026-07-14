import { resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { nitro } from 'nitro/vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, loadEnv } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { z } from 'zod';
import { resolveSourcemapSetting } from './src/lib/sentry/sourcemap-config.ts';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Load .env, .env.local, .env.[mode], .env.[mode].local from the admin app
// directory.  loadEnv() reads the files synchronously so we can validate
// before defineConfig() is evaluated.  The empty-string prefix loads ALL
// variables regardless of prefix (VITE_*, HOSPEDA_*, etc.).
// Platform/CI env vars are already in process.env and take precedence
// because we only set keys that are not already defined.
const rawEnv = loadEnv(process.env.NODE_ENV ?? 'development', __dirname, '');
for (const [key, value] of Object.entries(rawEnv)) {
    if (!process.env[key]) {
        process.env[key] = value;
    }
}

// Map shared HOSPEDA_* names onto the VITE_* names this app expects when
// only the HOSPEDA_* versions are present. The rest of the monorepo
// (api, web, scripts) consumes the HOSPEDA_* aliases from a single
// `.env.local`, and the CI workflow already mirrors the values into
// VITE_* via job-level `env:`. This block reproduces that mapping for
// local builds so a freshly-cloned dev environment does not need to
// duplicate the same URL under two different keys.
process.env.VITE_API_URL ??= process.env.HOSPEDA_API_URL;
process.env.VITE_SITE_URL ??= process.env.HOSPEDA_SITE_URL;
process.env.VITE_BETTER_AUTH_URL ??=
    process.env.HOSPEDA_BETTER_AUTH_URL ??
    (process.env.HOSPEDA_API_URL ? `${process.env.HOSPEDA_API_URL}/api/auth` : undefined);

// SPEC-219: CI runs without repository secrets (most visibly Dependabot PRs)
// fall back to placeholder `.invalid` URLs so this build-time validation — which
// only needs syntactically-valid URLs — passes. A placeholder must NEVER reach a
// real/deploy build, so it is rejected here unless `ALLOW_PLACEHOLDER_ENV_URLS`
// is explicitly set, which ONLY the CI Build step does. This is the BUILD-TIME
// half of the placeholder guard (it runs as `vite build` loads this config and
// `process.exit(1)`s on failure). The RUNTIME half lives in `src/env.ts`
// (`validateAdminEnv`), which additionally covers `VITE_ADMIN_URL` — validated
// only at runtime, not here. Keep the two halves in sync.
const allowPlaceholderUrls = process.env.ALLOW_PLACEHOLDER_ENV_URLS === 'true';
const isPlaceholderUrl = (value: string): boolean => {
    try {
        const { hostname } = new URL(value);
        return hostname === 'invalid' || hostname.endsWith('.invalid');
    } catch {
        return false;
    }
};
const requiredUrl = (message: string) =>
    z
        .string()
        .url(message)
        .refine((value) => allowPlaceholderUrls || !isPlaceholderUrl(value), {
            message: `${message} (placeholder .invalid URL is rejected outside CI builds)`
        });

// Validate required environment variables for the Admin App.
const AdminViteEnvSchema = z.object({
    VITE_API_URL: requiredUrl('Must be a valid API URL'),
    VITE_SITE_URL: requiredUrl('Must be a valid site URL'),
    HOSPEDA_API_URL: requiredUrl('Must be a valid API URL for server-side requests'),
    VITE_BETTER_AUTH_URL: z.string().min(1, 'Must be a non-empty Better Auth URL')
});

try {
    AdminViteEnvSchema.parse(process.env);
} catch (error) {
    console.error('Admin App environment validation FAILED');

    if (error instanceof z.ZodError && error.issues && Array.isArray(error.issues)) {
        const errorMessages = error.issues
            .map((err: z.ZodIssue) => `  - ${err.path.join('.')}: ${err.message}`)
            .join('\n');
        console.error(`Environment validation failed for Admin App:\n${errorMessages}`);
        process.exit(1);
    }
    console.error('Unexpected error during Admin App environment validation:', error);
    process.exit(1);
}

// HOS-33 T-010: see the long comment above `rolldownOptions.output.codeSplitting`
// for why this exists -- matches the SolidJS-based devtools stack so it can be
// excluded from every manual vendor group and left to Rolldown's default chunking.
function isDevtoolsOrSolidJs(id: string): boolean {
    return (
        id.includes('/@tanstack/devtools') ||
        id.includes('/@tanstack/react-devtools') ||
        id.includes('/@tanstack/react-router-devtools') ||
        id.includes('/@tanstack/router-devtools-core') ||
        id.includes('/@solid-primitives/') ||
        id.includes('/solid-js/') ||
        id.includes('/goober/')
    );
}

export default defineConfig({
    // Load .env files from the admin app directory, not the monorepo root.
    // Vite will auto-load: .env, .env.local, .env.[mode], .env.[mode].local
    envDir: __dirname,
    plugins: [
        tsconfigPaths({ projects: ['./tsconfig.json'] }),
        tailwindcss(),
        tanstackStart(),
        // HOS-33 T-014: TanStack Start >= 1.132 no longer bundles Nitro inside
        // tanstackStart() -- it moved to a separate opt-in plugin. Without this,
        // `vite build` falls back to a plain SSR build (hashed asset filenames
        // under dist/server/assets/, no .output/ directory at all), breaking
        // apps/admin/package.json's `start` script and the Dockerfile, which
        // both expect the Nitro-produced `.output/server/index.mjs` entry.
        // Default preset targets Node.js, matching our Docker deployment; no
        // preset override needed (see the Bun-specific example in TanStack
        // Start's hosting docs for how that would differ).
        nitro(),
        // HOS-33 T-002 correction (found via a real `pnpm dev` smoke test, not
        // just a production build): removing @vitejs/plugin-react entirely broke
        // dev-mode Fast Refresh -- `pnpm dev` 500s on every request with
        // "TanStack Start React dev mode requires the React Refresh runtime,
        // but /@react-refresh could not be resolved". Production builds worked
        // fine without it (tanstackStart() covers the JSX transform at build
        // time), but dev-mode HMR needs the actual React Refresh runtime, which
        // only @vitejs/plugin-react provides. TanStack Start's own current
        // hosting docs (fetched via Context7) confirm the recommended pattern is
        // `[tanstackStart(), nitro(), viteReact()]` -- all three together, no
        // `customViteReactPlugin` flag needed (that flag was the 1.131.26-era
        // opt-in mechanism T-002 correctly removed).
        react(),
        // Fix better-auth esbuild conflict: "entry point cannot be marked as external".
        // crawlFrameworkPkgs marks better-auth as both ssr.noExternal (framework pkg)
        // AND optimizeDeps.exclude, causing esbuild to receive it as both entry point
        // and external simultaneously. Fix by removing it from optimizeDeps.exclude.
        // See: https://github.com/better-auth/better-auth/issues/7386
        {
            name: 'fix-better-auth-ssr-optimize',
            enforce: 'post' as const,
            configResolved(config) {
                // Remove better-auth from optimizeDeps.exclude in all environments
                const envs = (config as Record<string, unknown>).environments as
                    | Record<string, Record<string, unknown>>
                    | undefined;
                if (envs) {
                    for (const env of Object.values(envs)) {
                        const exclude = (env?.optimizeDeps as Record<string, unknown>)?.exclude as
                            | string[]
                            | undefined;
                        if (Array.isArray(exclude)) {
                            const idx = exclude.indexOf('better-auth');
                            if (idx !== -1) {
                                exclude.splice(idx, 1);
                            }
                        }
                    }
                }
                // Also check top-level optimizeDeps
                const topExclude = (
                    (config as Record<string, unknown>).optimizeDeps as Record<string, unknown>
                )?.exclude as string[] | undefined;
                if (Array.isArray(topExclude)) {
                    const idx = topExclude.indexOf('better-auth');
                    if (idx !== -1) {
                        topExclude.splice(idx, 1);
                    }
                }
            }
        },
        // Environment variable mapping plugin.
        // Explicitly injects process.env values into import.meta.env so that
        // server-side (HOSPEDA_*) vars and VITE_* vars are all available
        // consistently in both SSR and client builds.
        {
            name: 'hospeda-env-mapping',
            config() {
                return {
                    define: {
                        'import.meta.env.VITE_API_URL': JSON.stringify(
                            process.env.VITE_API_URL || ''
                        ),
                        'import.meta.env.VITE_SITE_URL': JSON.stringify(
                            process.env.VITE_SITE_URL || ''
                        ),
                        'import.meta.env.HOSPEDA_API_URL': JSON.stringify(
                            process.env.HOSPEDA_API_URL || ''
                        ),
                        'import.meta.env.VITE_BETTER_AUTH_URL': JSON.stringify(
                            process.env.VITE_BETTER_AUTH_URL || ''
                        ),
                        'import.meta.env.VITE_DEBUG_ACTOR_ID': JSON.stringify(
                            process.env.VITE_DEBUG_ACTOR_ID || ''
                        ),
                        'import.meta.env.VITE_SUPPORTED_LOCALES': JSON.stringify(
                            process.env.VITE_SUPPORTED_LOCALES || 'es,en'
                        ),
                        'import.meta.env.VITE_DEFAULT_LOCALE': JSON.stringify(
                            process.env.VITE_DEFAULT_LOCALE || 'es'
                        ),
                        'import.meta.env.VITE_SENTRY_RELEASE': JSON.stringify(
                            process.env.HOSPEDA_GIT_SHA || process.env.VITE_SENTRY_RELEASE || ''
                        )
                    }
                };
            }
        },
        // Sentry source maps upload (build-time only).
        // Gated on SENTRY_AUTH_TOKEN so local dev builds and builds without
        // the token still work — the plugin only registers when the token
        // is present. Org/project are hardcoded; the Sentry CLI auth token
        // is org-scoped (shared across hospeda-web/hospeda-admin/hospeda-api).
        ...(process.env.SENTRY_AUTH_TOKEN
            ? [
                  sentryVitePlugin({
                      org: 'qazuor',
                      project: process.env.VITE_SENTRY_PROJECT || 'hospeda-admin',
                      authToken: process.env.SENTRY_AUTH_TOKEN,
                      // BETA-66: delete the generated `.map` files from the
                      // output directory once they have been uploaded to
                      // Sentry, so they never ship to the client/CDN.
                      sourcemaps: {
                          filesToDeleteAfterUpload: ['**/*.map']
                      }
                  })
              ]
            : []),
        // Bundle analysis — only when ANALYZE=1 (pnpm build:analyze)
        ...(process.env.ANALYZE
            ? [
                  visualizer({
                      open: false,
                      filename: 'stats.html',
                      gzipSize: true
                  })
              ]
            : [])
    ],
    resolve: {
        alias: [
            // Exact-match shim for `kysely` (NOT `kysely/migration`, NOT `kysely/dist/...`).
            // better-auth 1.4.18 imports DEFAULT_MIGRATION_TABLE / DEFAULT_MIGRATION_LOCK_TABLE
            // from "kysely" but kysely 0.29 only exports those from "kysely/migration" now,
            // which crashes optimizeDeps. The shim re-exports the package + adds the constants.
            { find: /^kysely$/, replacement: resolve(__dirname, './src/lib/kysely-shim.mjs') },
            { find: '@', replacement: resolve(__dirname, './src') },
            {
                find: '@repo/schemas',
                replacement: resolve(__dirname, '../../packages/schemas/src')
            },
            { find: '@repo/db', replacement: resolve(__dirname, '../../packages/db/src') },
            { find: '@repo/logger', replacement: resolve(__dirname, '../../packages/logger/src') },
            { find: '@repo/utils', replacement: resolve(__dirname, '../../packages/utils/src') },
            { find: '@repo/config', replacement: resolve(__dirname, '../../packages/config/src') },
            {
                find: '@repo/service-core',
                replacement: resolve(__dirname, '../../packages/service-core/src')
            },
            { find: '@repo/icons', replacement: resolve(__dirname, '../../packages/icons/src') },
            { find: '@repo/i18n', replacement: resolve(__dirname, '../../packages/i18n/src') }
        ],
        dedupe: ['react', 'react-dom']
    },
    optimizeDeps: {
        force: true,
        include: ['react/jsx-runtime', 'react/jsx-dev-runtime', '@phosphor-icons/react'],
        // `cloudinary` and `image-size` are Node-only deps transitively reachable
        // through `@repo/media/server`. Excluding them from optimize + leaving
        // them unresolvable at browser build time mirrors the tsup `external`
        // contract in packages/media and prevents Vite from attempting to pull
        // the Cloudinary SDK into an admin chunk. Admin source code MUST NOT
        // import `@repo/media/server` (enforced by Biome `noRestrictedImports`).
        exclude: [
            '@repo/schemas',
            '@repo/db',
            '@repo/logger',
            '@repo/utils',
            '@repo/config',
            '@repo/service-core',
            '@repo/icons',
            '@repo/i18n',
            'cloudinary',
            'image-size'
        ]
    },
    server: {
        watch: {
            ignored: ['!**/node_modules/**', '!**/dist/**']
        },
        fs: {
            allow: ['../..']
        }
    },
    build: {
        // Enable minification for production
        minify: process.env.NODE_ENV === 'production' ? 'esbuild' : false,
        // Target modern browsers for smaller bundles
        target: 'es2020',
        // HOS-33 T-009: Vite 8's Rolldown bundler removed the object form of
        // `rollupOptions.output.manualChunks` and ignores the (deprecated)
        // function form entirely whenever `rolldownOptions.output.codeSplitting`
        // is set (which one of our plugins -- tanstackStart()/nitro() -- sets by
        // default). Confirmed via the build warning "manualChunks option is
        // ignored because the codeSplitting option is specified" and via
        // Rolldown's own CodeSplittingGroup type (`name`/`test` both accept a
        // function, not just a static string/RegExp), which is what lets this
        // preserve the original per-feature dynamic chunk naming. Groups are
        // evaluated by `priority` (higher first); without an explicit priority
        // Rolldown's default ordering is not guaranteed to match array order,
        // so every group below is given one to keep vendor sub-splits taking
        // precedence over their broader catch-alls.
        //
        // HOS-33 T-010 fix: @tanstack/react-devtools and @tanstack/react-router-devtools
        // pull in a SolidJS-based UI (@tanstack/devtools, @tanstack/devtools-ui,
        // @solid-primitives/*, solid-js, goober) that has module-scope,
        // window-dependent side effects. __root.tsx statically imports
        // TanstackDevtools (only the RENDER is env.NODE_ENV-gated, per
        // apps/admin/CLAUDE.md's "Accepted dev-only console noise" -- the import
        // itself always ships), so this code was always part of the root's eager
        // module graph. Before this file wired manual codeSplitting groups,
        // Rolldown's automatic (default) chunking happened to isolate it in a way
        // that never got eagerly evaluated by the server entry. Grouping ANY
        // @tanstack/* (or generic node_modules) match forced this into an eager
        // vendor chunk instead, crashing the production server at startup with
        // "Client-only API called on the server side" (solid-js's SSR stub
        // throwing from module-scope code, not from a request handler). Excluded
        // here so it falls through to Rolldown's own default splitting, matching
        // the pre-existing (accidentally correct) behavior.
        rolldownOptions: {
            output: {
                codeSplitting: {
                    groups: [
                        {
                            name: 'vendor-react',
                            test: /node_modules\/(react|react-dom|scheduler)\//,
                            priority: 100
                        },
                        {
                            name: 'vendor-tanstack-router',
                            test: (id: string) =>
                                /node_modules\/@tanstack\/[^/]*(router|start)/.test(id) &&
                                !isDevtoolsOrSolidJs(id),
                            priority: 90
                        },
                        {
                            name: 'vendor-tanstack-query',
                            test: (id: string) =>
                                /node_modules\/@tanstack\/[^/]*query/.test(id) &&
                                !isDevtoolsOrSolidJs(id),
                            priority: 90
                        },
                        {
                            name: 'vendor-tanstack-table',
                            test: (id: string) =>
                                /node_modules\/@tanstack\/[^/]*(table|virtual)/.test(id) &&
                                !isDevtoolsOrSolidJs(id),
                            priority: 90
                        },
                        {
                            name: 'vendor-tanstack-form',
                            test: (id: string) =>
                                /node_modules\/@tanstack\/[^/]*form/.test(id) &&
                                !isDevtoolsOrSolidJs(id),
                            priority: 90
                        },
                        {
                            name: 'vendor-tanstack-other',
                            test: (id: string) =>
                                /node_modules\/@tanstack\//.test(id) && !isDevtoolsOrSolidJs(id),
                            priority: 80
                        },
                        { name: 'vendor-radix', test: /node_modules\/@radix-ui\//, priority: 90 },
                        { name: 'vendor-zod', test: /node_modules\/zod\//, priority: 90 },
                        {
                            name: 'vendor',
                            test: (id: string) =>
                                /node_modules/.test(id) && !isDevtoolsOrSolidJs(id),
                            priority: 10
                        },
                        {
                            // Feature chunks from src/features/<slug>/ -- one dynamic
                            // chunk per feature, same as the original manualChunks logic.
                            name: (id: string) => {
                                const match = id.match(/\/features\/([^/]+)\//);
                                return match?.[1] ? `feature-${match[1]}` : 'features-other';
                            },
                            test: /\/features\//,
                            priority: 70
                        },
                        {
                            name: 'components-entity-list',
                            test: /\/components\/entity-list\//,
                            priority: 70
                        },
                        // Heavy fields (tiptap, leaflet, upload) are lazy-loaded via
                        // React.lazy -- excluded here so Rolldown creates async chunks
                        // for them automatically instead of bundling into
                        // components-entity-form.
                        {
                            name: 'components-entity-form',
                            test: (id: string) =>
                                id.includes('/components/entity-form/') &&
                                !id.includes('/components/entity-form/fields/'),
                            priority: 70
                        },
                        {
                            name: 'components-entity-pages',
                            test: /\/components\/entity-pages\//,
                            priority: 70
                        },
                        { name: 'components-table', test: /\/components\/table\//, priority: 70 },
                        { name: 'components-ui', test: /\/components\/ui\//, priority: 70 },
                        {
                            name: 'lib-utils',
                            test: (id: string) => id.includes('/lib/') || id.includes('/utils/'),
                            priority: 60
                        }
                    ]
                }
            }
        },
        rollupOptions: {
            output: {
                // Force ESM execution order. Without this, Rolldown 1.0.0-rc.17
                // reorders side-effect imports inside the flattened SSR bundle
                // (Nitro `node-server` preset), causing routeTree.gen.ts to
                // call `Route$N.update(...)` before `var Route$N = createFileRoute(...)`
                // is assigned, producing `Cannot read properties of undefined (reading 'update')`
                // at runtime. See https://github.com/rolldown/rolldown/issues/8812
                strictExecutionOrder: true,
                // Chunk file naming
                chunkFileNames: (chunkInfo) => {
                    const name = chunkInfo.name || 'chunk';
                    return `assets/${name}-[hash].js`;
                },
                // Entry file naming
                entryFileNames: 'assets/[name]-[hash].js',
                // Asset file naming
                assetFileNames: 'assets/[name]-[hash][extname]'
            }
        },
        // Chunk size warnings
        chunkSizeWarningLimit: 500, // 500 KB warning threshold
        commonjsOptions: {
            include: [/node_modules/, /packages\/.*/],
            transformMixedEsModules: true,
            requireReturnsDefault: 'auto'
        },
        // Source maps for production debugging. BETA-66: see
        // resolveSourcemapSetting() for the gating rationale (tested in
        // test/lib/sentry/sourcemap-config.test.ts) — in production this
        // only generates 'hidden' maps when SENTRY_AUTH_TOKEN is present
        // (so sentryVitePlugin can upload+delete them); without a token,
        // no maps are generated at all (fail-safe, no leak).
        sourcemap: resolveSourcemapSetting({
            authToken: process.env.SENTRY_AUTH_TOKEN,
            isProduction: process.env.NODE_ENV === 'production'
        })
    },
    define: {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
    }
});
