import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import node from '@astrojs/node';
import react from '@astrojs/react';
import sentry from '@sentry/astro';
import { defineConfig } from 'astro/config';
import { visualizer } from 'rollup-plugin-visualizer';
import { validateWebEnv } from './src/env.ts';
import { ALLOWED_REMOTE_HOSTS } from './src/lib/media.ts';
import {
    resolveSentrySourcemapsOption,
    resolveSourcemapSetting
} from './src/lib/sourcemap-config.ts';

const rootDir = resolve(new URL('.', import.meta.url).pathname, '../../');
const appDir = resolve(new URL('.', import.meta.url).pathname);

// Load apps/web/.env.local into process.env before validateWebEnv() runs.
try {
    const envContent = readFileSync(resolve(appDir, '.env.local'), 'utf8');
    const lines = envContent.split('\n').filter((line) => line.trim() && !line.startsWith('#'));
    for (const line of lines) {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length) {
            let value = valueParts.join('=').trim();
            const commentIndex = value.indexOf('#');
            if (commentIndex !== -1) {
                value = value.substring(0, commentIndex).trim();
            }
            if (!process.env[key.trim()]) {
                process.env[key.trim()] = value;
            }
        }
    }
} catch {}

// Validate environment variables at startup
try {
    validateWebEnv();
} catch (error) {
    console.warn(
        '[env] Web app environment validation warning:',
        error instanceof Error ? error.message : String(error)
    );
}

const HOSPEDA_API_URL = process.env.HOSPEDA_API_URL || process.env.PUBLIC_API_URL;
const HOSPEDA_SITE_URL = process.env.HOSPEDA_SITE_URL || process.env.PUBLIC_SITE_URL;

if (!HOSPEDA_API_URL || !HOSPEDA_SITE_URL) {
    console.error(
        '[env] Missing required URL env vars. Set HOSPEDA_API_URL/PUBLIC_API_URL and HOSPEDA_SITE_URL/PUBLIC_SITE_URL.'
    );
    process.exit(1);
}

const apiHostname = (() => {
    try {
        return new URL(HOSPEDA_API_URL).hostname;
    } catch {
        return null;
    }
})();

export default defineConfig({
    site: HOSPEDA_SITE_URL,
    output: 'server',
    trailingSlash: 'always',
    // Astro 7 changed the default from `true` (HTML-aware compression,
    // preserves a single space between inline elements) to `'jsx'` (strips
    // whitespace between inline elements unless explicit). Pinning `true`
    // keeps the pre-v7 rendering behavior unchanged across the HOS-76
    // migration instead of risking a silent whitespace regression across
    // every inline icon+text pairing in the site.
    compressHTML: true,
    adapter: node({
        mode: 'standalone',
        // Astro 7 + @astrojs/node 11: serve response headers (including any
        // attached by middleware) for prerendered pages too. Pays off once
        // CSP migrates from middleware response.headers.set() to native
        // security.csp (follow-up SPEC).
        staticHeaders: true
    }),

    prefetch: {
        // 'tap' (not 'hover'): prefetching an SSR page re-runs its full
        // frontmatter (detail pages fire 9-12 API calls each). With 'hover',
        // merely moving the mouse over listing cards fired hundreds of API
        // calls and tripped the rate limiter for a single normal user. 'tap'
        // prefetches on pointerdown — navigation still feels instant without
        // amplifying SSR/API load.
        defaultStrategy: 'tap'
    },

    server: {
        port: Number(process.env.PORT) || 4321,
        host: process.env.HOST || undefined
    },
    build: {
        // GAP-30-01 root cause: Astro's default 'auto' inlines small
        // component stylesheets as <style nonce="..."> in the HTML. The
        // nonce is generated per-request, but `<ClientRouter />` soft
        // navigation swaps the DOM without a real top-level navigation, so
        // the browser's already-active CSP (pinned to the nonce from the
        // ORIGINAL page load) rejects every inlined <style> the swap-in
        // page carries. Forcing all stylesheets to external hashed files
        // routes them through `style-src 'self'` instead of the nonce
        // source, which is unaffected by the frozen-nonce/soft-nav gap.
        inlineStylesheets: 'never'
    },
    image: {
        // Built from ALLOWED_REMOTE_HOSTS (single source of truth shared with
        // the runtime SSRF guard `isAllowedRemoteHost()` in src/lib/media.ts).
        // `localhost` is HTTP for dev; the rest are HTTPS public CDNs.
        // The `*.vercel.app` wildcard (preview deploys) and the dynamic
        // `apiHostname` are appended separately because they are not part of
        // the runtime allowlist (wildcards / env-derived).
        remotePatterns: [
            ...ALLOWED_REMOTE_HOSTS.map((hostname) =>
                hostname === 'localhost' ? { hostname } : { protocol: 'https', hostname }
            ),
            ...(apiHostname && apiHostname !== 'localhost' ? [{ hostname: apiHostname }] : [])
        ]
    },
    integrations: [
        // Sentry runtime config lives in `sentry.client.config.ts` and
        // `sentry.server.config.ts` (auto-discovered by @sentry/astro). The
        // integration MUST run unconditionally: activating it is what injects
        // that browser/server instrumentation into the build. `dsn` is
        // intentionally NOT passed here (deprecated path in @sentry/astro >= 10;
        // would warn at every build) — the DSN is read at runtime by those
        // config files from PUBLIC_SENTRY_DSN.
        //
        // DECOUPLED GATE: only source-map UPLOAD depends on SENTRY_AUTH_TOKEN,
        // because uploading is the only step that needs the token. The previous
        // version gated the ENTIRE integration on the token, so when the token
        // was not forwarded as a build arg (it is a Coolify secret), the client
        // instrumentation was never injected and browser error tracking was
        // silently dead in production. `resolveSentrySourcemapsOption` disables
        // source-map functionality when the token is absent (suppressing the
        // Vite plugin's "no auth token" warning, BETA-66) and, when present,
        // deletes the generated `.map` files after upload so they never ship to
        // the CDN — paired with `vite.build.sourcemap: 'hidden'` below.
        sentry({
            org: 'qazuor',
            project: 'hospeda-web',
            authToken: process.env.SENTRY_AUTH_TOKEN,
            sourcemaps: resolveSentrySourcemapsOption({
                authToken: process.env.SENTRY_AUTH_TOKEN
            })
        }),
        react()
        // NO `@astrojs/sitemap` here, deliberately. It only enumerates routes
        // rendered to static HTML at build time, and this app prerenders none
        // (zero `prerender = true` pages), so it emitted a `<urlset>` with no
        // pages in it. Its `customPages` option could not fix that either: it
        // appends to the `<urlset>`, so `/sitemap-dynamic.xml` was advertised
        // as a crawlable page instead of being registered as a sitemap, and the
        // entity URLs were never submitted. All three sitemaps are SSR
        // endpoints under `src/pages` now — see `src/lib/seo/sitemap-xml.ts`.
    ],
    vite: {
        plugins: [
            {
                name: 'fix-astro-image-trailing-slash',
                configureServer(server) {
                    server.middlewares.use((req, _res, next) => {
                        if (req.url?.startsWith('/_image') && !req.url.startsWith('/_image/')) {
                            req.url = req.url.replace('/_image', '/_image/');
                        }
                        next();
                    });
                }
            },
            // Force `@repo/icons` to resolve to its package SOURCE (per-file
            // icon wrappers under packages/icons/src), NOT the prebuilt
            // `dist/index.js` tsup barrel.
            //
            // WHY: `@repo/icons` ships a `dist/index.js` that is a single
            // pre-concatenated barrel. Astro's build resolves the bare
            // specifier through the package `exports` map (-> dist) BEFORE the
            // `resolve.alias` above can redirect it, so the alias was a no-op
            // for the build. A pre-bundled barrel cannot be tree-shaken per
            // export, so EVERY island that imported a single icon dragged all
            // ~247 wrappers into one shared, eager chunk loaded on the home.
            // Resolving to source (per-file modules with `sideEffects: false`)
            // lets Rollup tree-shake per icon: a page bundles only the icons it
            // renders. `enforce: 'pre'` runs this before exports resolution.
            // Web-only — admin already aliases @repo/icons to src in its own
            // vite config, so this does not touch the shared package. (SPEC-269)
            {
                name: 'hospeda-icons-source-resolver',
                enforce: 'pre',
                resolveId(source) {
                    if (source === '@repo/icons') {
                        return resolve(rootDir, 'packages/icons/src/index.ts');
                    }
                    if (source === '@repo/icons/resolver') {
                        return resolve(rootDir, 'packages/icons/src/resolver.ts');
                    }
                    return null;
                }
            },
            // Bundle analysis — only when ANALYZE=1 (pnpm build:analyze).
            // Emits a treemap of the client bundle to apps/web/stats.html so we
            // can see which islands/deps land in the large chunks (SPEC-269 T-269-02a).
            ...(process.env.ANALYZE
                ? [
                      visualizer({
                          open: false,
                          filename: 'stats.html',
                          gzipSize: true,
                          brotliSize: true
                      })
                  ]
                : [])
        ],
        envDir: appDir,
        resolve: {
            alias: {
                '@repo/config': resolve(rootDir, 'packages/config/src'),
                '@repo/icons': resolve(rootDir, 'packages/icons/src'),
                '@repo/db': resolve(rootDir, 'packages/db/src'),
                '@repo/utils': resolve(rootDir, 'packages/utils/src'),
                '@repo/logger': resolve(rootDir, 'packages/logger/src'),
                '@repo/i18n': resolve(rootDir, 'packages/i18n/src'),
                '@repo/schemas': resolve(rootDir, 'packages/schemas/src'),
                '@repo/service-core': resolve(rootDir, 'packages/service-core/src')
            }
        },
        // `cloudinary` and `image-size` are Node-only transitively reachable
        // through `@repo/media/server`. Excluding them from optimize keeps
        // browser bundles free of the Cloudinary SDK. Web source must not
        // import `@repo/media/server` (enforced by Biome `noRestrictedImports`).
        optimizeDeps: {
            exclude: ['cloudinary', 'image-size'],
            // Workspace packages are linked and resolved (via the aliases above)
            // to their `src/`, i.e. OUTSIDE node_modules. Vite treats linked
            // packages as source and does NOT pre-bundle them, so in dev it
            // serves every file of these barrels as its own HTTP request —
            // measured at 1360 (schemas) + 926 (icons) + 324 (i18n) of 3128
            // requests for a single listing → detail soft-navigation, because
            // the ClientRouter's client:only iframe walks the tree once and the
            // swapped document walks it again. Forcing them into the pre-bundle
            // collapses each barrel into a handful of cached chunks.
            //
            // Dev-only by construction: pre-bundling is a dev-server concern
            // (`vite build` runs Rollup over the real module graph and
            // tree-shakes these barrels away — verified against the deployed
            // prod chunk, which contains no schemas/zod code at all). Adding a
            // package here can only change how dev serves it, never what ships.
            // `@repo/i18n/web` is listed by its SUBPATH, not as `@repo/i18n`:
            // the web app imports only that entry point, and an include entry
            // matches the specifier as written, so the bare package name leaves
            // every `/web` import unbundled (measured: it stayed at ~485
            // requests until the subpath was listed here).
            include: ['@repo/schemas', '@repo/icons', '@repo/i18n/web']
        },
        ssr: {
            // `sanitize-html` is CommonJS but depends on `htmlparser2@12`, which is
            // ESM-only (`type: module`, no CommonJS build). Left external, its
            // `require('htmlparser2')` falls into Node's `require(esm)` path
            // (`loadESMFromCJS`), which must link the whole ESM graph
            // synchronously — htmlparser2 -> `entities/decode` -> `decode-codepoint.js`.
            // Under concurrent warm-up traffic that synchronous link races against
            // an `import()` of the same graph from another route chunk and throws
            // `request for './decode-codepoint.js' is from a module not been linked`.
            // Node then caches the rejected chunk, so the losing route serves 500s
            // until the process restarts (HOS-370: destination detail pages were
            // down for ~1h in production after a deploy).
            //
            // Bundling it resolves the CommonJS -> ESM interop at build time, so no
            // `require(esm)` exists at runtime and the race cannot happen.
            // `test/integration/cjs-esm-bridges.test.ts` fails if a new
            // CommonJS -> ESM-only dependency edge appears without being handled here.
            // `recharts` is the same shape: CommonJS, and it pulls `victory-vendor`
            // (also CommonJS), whose `d3-*` subpath modules each `require()` an
            // ESM-only `d3-*` package. It is imported from a lazily-loaded server
            // chunk (the host dashboard), so it is linked mid-traffic exactly like
            // sanitize-html was. Bundling is preferred over warming it at boot
            // because `victory-vendor` exposes no root entry point — warming it
            // would mean importing every `d3-*` subpath by hand.
            noExternal: ['sanitize-html', 'recharts'],
            external: ['cloudinary', 'image-size']
        },
        define: {
            'import.meta.env.PUBLIC_API_URL': JSON.stringify(HOSPEDA_API_URL),
            'import.meta.env.PUBLIC_SITE_URL': JSON.stringify(HOSPEDA_SITE_URL),
            'import.meta.env.PUBLIC_SENTRY_RELEASE': JSON.stringify(
                process.env.HOSPEDA_COMMIT_SHA ||
                    process.env.HOSPEDA_GIT_SHA ||
                    process.env.PUBLIC_SENTRY_RELEASE ||
                    ''
            )
        },
        build: {
            // BETA-66: source maps hardening. See resolveSourcemapSetting()
            // for the gating rationale (tested in
            // test/lib/sourcemap-config.test.ts). Matches the admin app's
            // Vite `build.sourcemap` config (apps/admin/vite.config.ts).
            sourcemap: resolveSourcemapSetting({ authToken: process.env.SENTRY_AUTH_TOKEN })
        }
    }
});
