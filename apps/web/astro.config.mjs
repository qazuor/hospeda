import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import node from '@astrojs/node';
import sentry from '@sentry/astro';
import { defineConfig } from 'astro/config';
import { validateWebEnv } from './src/env.ts';
import { ALLOWED_REMOTE_HOSTS } from './src/lib/media.ts';

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
        mode: 'standalone'
    }),

    prefetch: {
        defaultStrategy: 'hover'
    },

    server: {
        port: 4321
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
        ...(process.env.PUBLIC_SENTRY_DSN
            ? [
                  sentry({
                      dsn: process.env.PUBLIC_SENTRY_DSN,
                      sourceMapsUploadOptions: {
                          enabled: Boolean(process.env.SENTRY_AUTH_TOKEN)
                      }
                  })
              ]
            : []),
        react(),
        sitemap({
            filter: (page) => {
                const excludePatterns = ['/auth/', '/mi-cuenta/', '/busqueda/', '/feedback/'];
                return !excludePatterns.some((pattern) => page.includes(pattern));
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
