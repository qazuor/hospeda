import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import sentry from '@sentry/astro';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import { validateWebEnv } from './src/env.ts';

const rootDir = resolve(new URL('.', import.meta.url).pathname, '../../');
// appDir is this file's directory (apps/web). envDir is set here so Vite
// auto-loads .env files from apps/web/ rather than the monorepo root.
const appDir = resolve(new URL('.', import.meta.url).pathname);

// Load apps/web/.env.local into process.env before validateWebEnv() runs.
// Vite/Astro only populates import.meta.env AFTER astro.config.mjs executes,
// so we manually pre-load the file here the same way the old code did for the
// root .env.local.
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

// Validate environment variables at startup - fails fast on misconfiguration
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
    adapter: vercel({
        isr: {
            expiration: 86400,
            bypassToken: process.env.HOSPEDA_REVALIDATION_SECRET,
            exclude: [
                /^(\/(?:en|pt))?\/mi-cuenta(\/.*)?$/,
                /^(\/(?:en|pt))?\/auth(\/.*)?$/,
                /^(\/(?:en|pt))?\/busqueda(\/.*)?$/,
                /^(\/(?:en|pt))?\/feedback(\/.*)?$/,
                /^(\/(?:en|pt))?\/alojamientos\/(.*)\/?$/,
                /^(\/(?:en|pt))?\/eventos\/(.*)\/?$/,
                /^(\/(?:en|pt))?\/alojamientos\/tipo(\/.*)?$/,
                /^(\/(?:en|pt))?\/eventos\/categoria(\/.*)?$/
            ]
        },
        imageService: true
    }),

    server: {
        port: 4321
    },
    image: {
        remotePatterns: [
            { hostname: 'localhost' },
            { hostname: '*.vercel.app' },
            ...(apiHostname && apiHostname !== 'localhost' ? [{ hostname: apiHostname }] : [])
        ]
    },
    integrations: [
        ...(process.env.PUBLIC_SENTRY_DSN
            ? [
                  sentry({
                      dsn: process.env.PUBLIC_SENTRY_DSN,
                      sourceMapsUploadOptions: {
                          // Only upload source maps when SENTRY_AUTH_TOKEN is available.
                          // Keeps local builds from failing when the token is not configured.
                          enabled: Boolean(process.env.SENTRY_AUTH_TOKEN)
                      }
                  })
              ]
            : []),
        react(),
        sitemap({
            filter: (page) => {
                const excludePatterns = ['/auth/', '/mi-cuenta/'];
                return !excludePatterns.some((pattern) => page.includes(pattern));
            }
        })
    ],
    vite: {
        plugins: [tailwindcss()],
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
                '@repo/service-core': resolve(rootDir, 'packages/service-core/src'),
                '@repo/feedback': resolve(rootDir, 'packages/feedback/src')
            }
        },
        define: {
            'import.meta.env.PUBLIC_API_URL': JSON.stringify(HOSPEDA_API_URL),
            'import.meta.env.PUBLIC_SITE_URL': JSON.stringify(HOSPEDA_SITE_URL),
            'import.meta.env.PUBLIC_SENTRY_RELEASE': JSON.stringify(
                process.env.VERCEL_GIT_COMMIT_SHA || process.env.PUBLIC_SENTRY_RELEASE || ''
            )
        }
    }
    // CSP is handled via HTTP headers in src/middleware.ts (not Astro experimental.csp)
});
