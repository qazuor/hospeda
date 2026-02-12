import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';
import devtoolBreakpoints from 'astro-devtool-breakpoints';
import astroFontPicker from 'astro-font-picker';
import lighthouse from 'astro-lighthouse';
import og from 'astro-og';
import { defineConfig } from 'astro/config';
import { z } from 'zod';

import reunmedianormalizeTrailingSlash from '@reunmedia/astro-normalize-trailing-slash';
import typedLinks from 'astro-typed-links';

// Load environment variables manually (monorepo) or use Vercel env vars (deployment)
const rootDir = resolve(new URL('.', import.meta.url).pathname, '../../');
const envPath = resolve(rootDir, '.env.local');

try {
    // Try to load from monorepo root first
    const envContent = readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n').filter((line) => line.trim() && !line.startsWith('#'));

    for (const line of lines) {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length) {
            let value = valueParts.join('=').trim();
            // Remove inline comments (everything after # including the #)
            const commentIndex = value.indexOf('#');
            if (commentIndex !== -1) {
                value = value.substring(0, commentIndex).trim();
            }
            // Only set if not already defined (Vercel env vars take precedence)
            if (!process.env[key.trim()]) {
                process.env[key.trim()] = value;
            }
        }
    }
} catch (_error) {
    // In deployment (Vercel), .env.local won't exist - use platform env vars
    // biome-ignore lint/suspicious/noConsoleLog: <explanation>
    console.log('📦 Running in deployment mode - using platform environment variables');
}

// Validate environment variables for Web App
const WebEnvSchema = z
    .object({
        // Check both HOSPEDA_ (monorepo) and PUBLIC_ (deployment) formats
        HOSPEDA_API_URL: z.string().url('Must be a valid API URL').optional(),
        PUBLIC_API_URL: z.string().url('Must be a valid API URL').optional(),
        HOSPEDA_SITE_URL: z.string().url('Must be a valid site URL').optional(),
        PUBLIC_SITE_URL: z.string().url('Must be a valid site URL').optional(),
    })
    .refine((data) => data.HOSPEDA_API_URL || data.PUBLIC_API_URL, {
        message: 'API_URL is required (either HOSPEDA_API_URL or PUBLIC_API_URL)',
        path: ['API_URL']
    })
    .refine((data) => data.HOSPEDA_SITE_URL || data.PUBLIC_SITE_URL, {
        message: 'SITE_URL is required (either HOSPEDA_SITE_URL or PUBLIC_SITE_URL)',
        path: ['SITE_URL']
    });

// biome-ignore lint/suspicious/noConsoleLog: <explanation>
console.log('🔍 Validating Web App environment variables...');

// Debug info about environment variables
const webEnvKeys = Object.keys(process.env).filter(
    (key) => key.startsWith('HOSPEDA_') || key.startsWith('PUBLIC_') || key === 'NODE_ENV'
);

if (webEnvKeys.length === 0) {
    console.warn('⚠️  No relevant environment variables found for Web App');
    console.warn('🔍 Looking for variables starting with: HOSPEDA_, PUBLIC_, NODE_ENV');
} else {
    // biome-ignore lint/suspicious/noConsoleLog: <explanation>
    console.log(`🔍 Found ${webEnvKeys.length} relevant environment variables for Web App`);
}

try {
    WebEnvSchema.parse(process.env);
    // biome-ignore lint/suspicious/noConsoleLog: <explanation>
    console.log('✅ Web App environment validation passed');
    // biome-ignore lint/suspicious/noConsoleLog: <explanation>
    console.log('📊 Validated environment variables for Web App');
} catch (error) {
    console.error('❌ Web App environment validation FAILED');

    if (error instanceof z.ZodError && error.errors && Array.isArray(error.errors)) {
        const errorMessages = error.errors
            .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
            .join('\n');
        console.error(`❌ Environment validation failed for Web App:\n${errorMessages}`);

        // Additional debug info
        console.error('\n🐛 Debug info for Web App:');
        console.error(`📂 Current working directory: ${process.cwd()}`);
        console.error(`🔍 NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
        console.error(`📝 Total env vars: ${Object.keys(process.env).length}`);
        console.error(`📂 Expected .env.local location: ${process.cwd()}/.env.local`);

        console.error('\n💡 Check your .env.local file or Vercel environment variables.');
        process.exit(1);
    }
    console.error('❌ Unexpected error during Web App environment validation:', error);
    process.exit(1);
}

// https://astro.build/config
export default defineConfig({
    envDir: new URL('../../', import.meta.url).pathname,
    integrations: [
        react(),
        sitemap(),
        astroFontPicker(),
        og(),
        lighthouse(),
        devtoolBreakpoints(),
        typedLinks(),
        reunmedianormalizeTrailingSlash()
    ],
    output: 'server',
    adapter: vercel(),
    trailingSlash: 'always',
    site: process.env.HOSPEDA_SITE_URL ?? 'http://localhost:4321',
    viewTransitions: true,
    server: {
        port: 4321
    },
    vite: {
        css: {
            transformer: 'lightningcss'
        },
        plugins: [
            tailwindcss(),
            // Environment variable mapping plugin
            {
                name: 'hospeda-env-mapping',
                config() {
                    return {
                        define: {
                            'import.meta.env.PUBLIC_API_URL': JSON.stringify(
                                process.env.HOSPEDA_API_URL || process.env.PUBLIC_API_URL || ''
                            ),
                            'import.meta.env.PUBLIC_SITE_URL': JSON.stringify(
                                process.env.HOSPEDA_SITE_URL || process.env.PUBLIC_SITE_URL || ''
                            ),
                            'import.meta.env.PUBLIC_SUPPORTED_LOCALES': JSON.stringify(
                                process.env.HOSPEDA_PUBLIC_SUPPORTED_LOCALES ||
                                    process.env.PUBLIC_SUPPORTED_LOCALES ||
                                    'en,es'
                            ),
                            'import.meta.env.PUBLIC_DEFAULT_LOCALE': JSON.stringify(
                                process.env.HOSPEDA_PUBLIC_DEFAULT_LOCALE ||
                                    process.env.PUBLIC_DEFAULT_LOCALE ||
                                    'en'
                            )
                        }
                    };
                }
            }
        ],
        resolve: {
            alias: {
                '@repo/auth-ui': new URL('../../packages/auth-ui/src', import.meta.url).pathname,
                '@repo/types': new URL('../../packages/types/src', import.meta.url).pathname,
                '@repo/config': new URL('../../packages/config/src', import.meta.url).pathname,
                '@repo/db': new URL('../../packages/db/src', import.meta.url).pathname,
                '@repo/utils': new URL('../../packages/utils/src', import.meta.url).pathname,
                '@repo/logger': new URL('../../packages/logger/src', import.meta.url).pathname,
                '@repo/icons': new URL('../../packages/icons/src', import.meta.url).pathname,
                '@repo/i18n': new URL('../../packages/i18n/src', import.meta.url).pathname,
                '@repo/service-common': new URL(
                    '../../packages/service-common/src',
                    import.meta.url
                ).pathname
            }
        }
    }
});
