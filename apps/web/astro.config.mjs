import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import node from '@astrojs/node';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import sentry from '@sentry/astro';
import { defineConfig } from 'astro/config';
import { visualizer } from 'rollup-plugin-visualizer';
import { validateWebEnv } from './src/env.ts';
import { ALLOWED_REMOTE_HOSTS } from './src/lib/media.ts';
import { buildSitemapAlternateLinks, isExcludedSitemapPage } from './src/lib/seo-config.ts';

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
    adapter: node({
        mode: 'standalone',
        // Astro 6 + @astrojs/node 10: serve response headers (including any
        // attached by middleware) for prerendered pages too. Pays off once
        // CSP migrates from middleware response.headers.set() to native
        // security.csp (follow-up SPEC).
        staticHeaders: true
    }),

    prefetch: {
        defaultStrategy: 'hover'
    },

    server: {
        port: Number(process.env.PORT) || 4321,
        host: process.env.HOST || undefined
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
        // `sentry.server.config.ts` (auto-discovered by @sentry/astro).
        // Here we only configure build-time concerns: which org/project the
        // source maps belong to, and the auth token used to upload them.
        // `dsn` is intentionally NOT passed here (deprecated path in
        // @sentry/astro >= 10; would warn at every build).
        ...(process.env.PUBLIC_SENTRY_DSN
            ? [
                  sentry({
                      org: 'qazuor',
                      project: 'hospeda-web',
                      authToken: process.env.SENTRY_AUTH_TOKEN
                  })
              ]
            : []),
        react(),
        sitemap({
            // Exclude private/redirecting pages. The bare root `/` 301-redirects
            // to `/es/` (listed separately), so it is excluded here too — keeping
            // redirecting URLs out of the sitemap preserves crawl budget/trust
            // (same rationale as the dynamic sitemap, SPEC-157 REQ-2).
            filter: (page) => !isExcludedSitemapPage(new URL(page).pathname),
            // Inject hreflang alternates for each entry so search engines know
            // the three locales (es/en/pt) are translations of the same page.
            // Improves international SEO for the Argentina-Litoral market.
            // Skips XML paths (e.g. customPages-injected sitemap-of-sitemaps)
            // since hreflang on a sitemap file is not meaningful. The alternate
            // set is built by a tested pure helper that mirrors the dynamic
            // sitemap strategy (es carries /es, x-default -> /es, no doubled
            // prefixes). SPEC-157 REQ-2/REQ-12.
            serialize(item) {
                const url = new URL(item.url);
                if (url.pathname.endsWith('.xml')) {
                    return item;
                }
                return {
                    ...item,
                    links: buildSitemapAlternateLinks({
                        pathname: url.pathname,
                        siteUrl: HOSPEDA_SITE_URL
                    })
                };
            },
            // Include the dynamic sitemap (published entities × 3 locales) so
            // sitemap-index.xml lists it alongside the statically-generated sitemap.
            customPages: [`${HOSPEDA_SITE_URL.replace(/\/$/, '')}/sitemap-dynamic.xml`]
        })
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
            exclude: ['cloudinary', 'image-size']
        },
        ssr: {
            noExternal: [],
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
            rollupOptions: {
                output: {
                    // ---------------------------------------------------------------------------
                    // Stable vendor chunks for long-term HTTP caching (SPEC-269 T-269-02b).
                    //
                    // Goals:
                    //   - react / react-dom / scheduler change only on React upgrades → long TTL.
                    //   - @sentry/* loaded broadly across pages → benefits from a stable chunk.
                    //
                    // Intentionally NOT forced into chunks:
                    //   - leaflet / react-leaflet / react-leaflet-cluster — already lazy via
                    //     Part A; Vite will place them in their own async chunk automatically.
                    //   - tiptap / recharts — route-lazy islands; Vite handles them well.
                    //   - @repo/i18n web.* locale bundles (~989 KB) — irreducible per-locale
                    //     split deferred to a dedicated spec.
                    // ---------------------------------------------------------------------------
                    manualChunks(id) {
                        // React runtime — changes only on React version bumps.
                        if (
                            id.includes('/node_modules/react/') ||
                            id.includes('/node_modules/react-dom/') ||
                            id.includes('/node_modules/scheduler/')
                        ) {
                            return 'vendor-react';
                        }
                        // Sentry SDK — loaded broadly; isolating prevents it from
                        // busting unrelated vendor caches on every SDK update.
                        if (id.includes('/node_modules/@sentry/')) {
                            return 'vendor-sentry';
                        }
                        // All other node_modules fall through to Vite's default
                        // chunking strategy (returns undefined → no forced chunk).
                        return undefined;
                    }
                }
            }
        }
    }
});
