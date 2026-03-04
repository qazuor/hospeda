import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { URL, fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { z } from 'zod';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Load environment variables manually (monorepo) or use Vercel env vars (deployment)
const rootDir = resolve(__dirname, '../../');
const envPath = resolve(rootDir, '.env.local');

try {
    // Try to load from monorepo root first
    const envContent = readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n').filter((line) => line.trim() && !line.startsWith('#'));

    // Prefer for...of instead of forEach for clarity and style consistency
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
    console.info('📦 Running in deployment mode - using platform environment variables');
}

// Validate environment variables for Admin App
const AdminEnvSchema = z
    .object({
        // Check both HOSPEDA_ (monorepo) and VITE_ (deployment) formats
        HOSPEDA_API_URL: z.string().url('Must be a valid API URL').optional(),
        VITE_API_URL: z.string().url('Must be a valid API URL').optional()
    })
    .refine((data) => data.HOSPEDA_API_URL || data.VITE_API_URL, {
        message: 'API_URL is required (either HOSPEDA_API_URL or VITE_API_URL)',
        path: ['API_URL']
    });

try {
    AdminEnvSchema.parse(process.env);
} catch (error) {
    console.error('❌ Admin App environment validation FAILED');

    if (error instanceof z.ZodError && error.issues && Array.isArray(error.issues)) {
        const errorMessages = error.issues
            .map((err: z.ZodIssue) => `  - ${err.path.join('.')}: ${err.message}`)
            .join('\n');
        console.error(`❌ Environment validation failed for Admin App:\n${errorMessages}`);
        process.exit(1);
    }
    console.error('❌ Unexpected error during Admin App environment validation:', error);
    process.exit(1);
}

export default defineConfig({
    envDir: resolve(__dirname, '../../'),
    plugins: [
        tsconfigPaths({ projects: ['./tsconfig.json'] }),
        tailwindcss(),
        tanstackStart({ customViteReactPlugin: true }),
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
        // Environment variable mapping plugin
        {
            name: 'hospeda-env-mapping',
            config() {
                return {
                    define: {
                        'import.meta.env.VITE_API_URL': JSON.stringify(
                            process.env.HOSPEDA_API_URL || process.env.VITE_API_URL || ''
                        ),
                        'import.meta.env.VITE_DEBUG_ACTOR_ID': JSON.stringify(
                            process.env.HOSPEDA_DEBUG_ACTOR_ID ||
                                process.env.VITE_DEBUG_ACTOR_ID ||
                                ''
                        ),
                        'import.meta.env.VITE_SUPPORTED_LOCALES': JSON.stringify(
                            process.env.HOSPEDA_SUPPORTED_LOCALES ||
                                process.env.VITE_SUPPORTED_LOCALES ||
                                'en,es'
                        ),
                        'import.meta.env.VITE_DEFAULT_LOCALE': JSON.stringify(
                            process.env.HOSPEDA_DEFAULT_LOCALE ||
                                process.env.VITE_DEFAULT_LOCALE ||
                                'en'
                        )
                    }
                };
            }
        }
    ],
    resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
            '@repo/schemas': resolve(__dirname, '../../packages/schemas/src'),
            '@repo/db': resolve(__dirname, '../../packages/db/src'),
            '@repo/logger': resolve(__dirname, '../../packages/logger/src'),
            '@repo/utils': resolve(__dirname, '../../packages/utils/src'),
            '@repo/config': resolve(__dirname, '../../packages/config/src'),
            '@repo/service-core': resolve(__dirname, '../../packages/service-core/src'),
            '@repo/icons': resolve(__dirname, '../../packages/icons/src'),
            '@repo/i18n': resolve(__dirname, '../../packages/i18n/src')
        },
        dedupe: ['react', 'react-dom']
    },
    optimizeDeps: {
        force: true,
        include: ['react/jsx-runtime', 'react/jsx-dev-runtime', '@phosphor-icons/react'],
        exclude: [
            '@repo/schemas',
            '@repo/db',
            '@repo/logger',
            '@repo/utils',
            '@repo/config',
            '@repo/service-core',
            '@repo/icons',
            '@repo/i18n'
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
        // Code splitting configuration
        rollupOptions: {
            output: {
                // Manual chunks for better code splitting
                manualChunks: (id) => {
                    // Vendor chunks - large external dependencies
                    if (id.includes('node_modules')) {
                        // React ecosystem
                        if (
                            id.includes('react') ||
                            id.includes('react-dom') ||
                            id.includes('scheduler')
                        ) {
                            return 'vendor-react';
                        }

                        // TanStack libraries
                        if (id.includes('@tanstack')) {
                            if (id.includes('router') || id.includes('start')) {
                                return 'vendor-tanstack-router';
                            }
                            if (id.includes('query')) {
                                return 'vendor-tanstack-query';
                            }
                            if (id.includes('table') || id.includes('virtual')) {
                                return 'vendor-tanstack-table';
                            }
                            if (id.includes('form')) {
                                return 'vendor-tanstack-form';
                            }
                            return 'vendor-tanstack-other';
                        }

                        // Radix UI components
                        if (id.includes('@radix-ui')) {
                            return 'vendor-radix';
                        }

                        // Zod validation
                        if (id.includes('zod')) {
                            return 'vendor-zod';
                        }

                        // Lucide icons
                        if (id.includes('lucide')) {
                            return 'vendor-icons';
                        }

                        // Other vendor code
                        return 'vendor';
                    }

                    // Feature chunks from src/features/
                    if (id.includes('/features/')) {
                        const match = id.match(/\/features\/([^/]+)\//);
                        if (match?.[1]) {
                            return `feature-${match[1]}`;
                        }
                    }

                    // Component chunks
                    if (id.includes('/components/entity-')) {
                        return 'components-entity';
                    }
                    if (id.includes('/components/table/')) {
                        return 'components-table';
                    }
                    if (id.includes('/components/ui/')) {
                        return 'components-ui';
                    }

                    // Lib/utils chunks
                    if (id.includes('/lib/') || id.includes('/utils/')) {
                        return 'lib-utils';
                    }

                    // Default - let Rollup decide
                    return undefined;
                },
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
        // Source maps for production debugging
        sourcemap: process.env.NODE_ENV === 'production' ? 'hidden' : true
    },
    define: {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
    }
});
