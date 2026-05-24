import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import node from '@astrojs/node';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import sentry from '@sentry/astro';
import { defineConfig } from 'astro/config';
import { validateWebEnv } from './src/env.ts';
import { ALLOWED_REMOTE_HOSTS } from './src/lib/media.ts';
import { SITEMAP_EXCLUDED_PATHS } from './src/lib/seo-config.ts';

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
            filter: (page) =>
                !SITEMAP_EXCLUDED_PATHS.some((pattern) => page.includes(pattern)),
            // Inject hreflang alternates for each entry so search engines know
            // the three locales (es/en/pt) are translations of the same page.
            // Improves international SEO for the Argentina-Litoral market.
            // Skips XML paths (e.g. customPages-injected sitemap-of-sitemaps)
            // since hreflang on a sitemap file is not meaningful.
            serialize(item) {
                const siteUrl = HOSPEDA_SITE_URL.replace(/\/$/, '');
                const url = new URL(item.url);
                if (url.pathname.endsWith('.xml')) {
                    return item;
                }
                const localeMatch = url.pathname.match(/^\/(en|pt)(\/|$)/);
                const pathWithoutLocale = localeMatch
                    ? url.pathname.replace(/^\/(en|pt)/, '')
                    : url.pathname;
                const normalizedPath = pathWithoutLocale === '' ? '/' : pathWithoutLocale;
                const links = [
                    { lang: 'es', url: `${siteUrl}${normalizedPath}` },
                    {
                        lang: 'en',
                        url: `${siteUrl}/en${normalizedPath === '/' ? '/' : normalizedPath}`
                    },
                    {
                        lang: 'pt',
                        url: `${siteUrl}/pt${normalizedPath === '/' ? '/' : normalizedPath}`
                    },
                    { lang: 'x-default', url: `${siteUrl}${normalizedPath}` }
                ];
                return { ...item, links };
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
            }
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
        }
    }
});
