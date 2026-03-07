import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import sentry from '@sentry/astro';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

const rootDir = resolve(new URL('.', import.meta.url).pathname, '../../');
const envPath = resolve(rootDir, '.env.local');

try {
    const envContent = readFileSync(envPath, 'utf8');
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

const HOSPEDA_API_URL =
    process.env.HOSPEDA_API_URL || process.env.PUBLIC_API_URL || 'http://localhost:3001';
const HOSPEDA_SITE_URL =
    process.env.HOSPEDA_SITE_URL || process.env.PUBLIC_SITE_URL || 'http://localhost:4321';

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
    adapter: vercel({
        isr: true,
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
                      sourceMapsUploadOptions: { enabled: false }
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
        envDir: rootDir,
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
            'import.meta.env.PUBLIC_SITE_URL': JSON.stringify(HOSPEDA_SITE_URL)
        }
    }
});
