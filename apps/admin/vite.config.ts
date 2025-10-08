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
        VITE_API_URL: z.string().url('Must be a valid API URL').optional(),
        HOSPEDA_PUBLIC_CLERK_PUBLISHABLE_KEY: z
            .string()
            .min(1, 'Clerk publishable key is required')
            .optional(),
        VITE_CLERK_PUBLISHABLE_KEY: z
            .string()
            .min(1, 'Clerk publishable key is required')
            .optional(),
        CLERK_SECRET_KEY: z.string().min(1, 'Clerk secret key is required').optional()
    })
    .refine((data) => data.HOSPEDA_API_URL || data.VITE_API_URL, {
        message: 'API_URL is required (either HOSPEDA_API_URL or VITE_API_URL)',
        path: ['API_URL']
    })
    .refine(
        (data) => data.HOSPEDA_PUBLIC_CLERK_PUBLISHABLE_KEY || data.VITE_CLERK_PUBLISHABLE_KEY,
        {
            message:
                'CLERK_PUBLISHABLE_KEY is required (either HOSPEDA_PUBLIC_CLERK_PUBLISHABLE_KEY or VITE_CLERK_PUBLISHABLE_KEY)',
            path: ['CLERK_PUBLISHABLE_KEY']
        }
    )
    .refine((data) => data.CLERK_SECRET_KEY, {
        message: 'CLERK_SECRET_KEY is required for server-side authentication',
        path: ['CLERK_SECRET_KEY']
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
        // Environment variable mapping plugin
        {
            name: 'hospeda-env-mapping',
            config() {
                return {
                    define: {
                        'import.meta.env.VITE_CLERK_PUBLISHABLE_KEY': JSON.stringify(
                            process.env.HOSPEDA_PUBLIC_CLERK_PUBLISHABLE_KEY ||
                                process.env.VITE_CLERK_PUBLISHABLE_KEY ||
                                ''
                        ),
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
            '@repo/icons': resolve(__dirname, '../../packages/icons/src')
        },
        dedupe: ['react', 'react-dom']
    },
    optimizeDeps: {
        force: true,
        include: ['react/jsx-runtime', 'react/jsx-dev-runtime'],
        exclude: [
            '@repo/schemas',
            '@repo/db',
            '@repo/logger',
            '@repo/utils',
            '@repo/config',
            '@repo/service-core',
            '@repo/icons'
            // '@repo/auth-ui' // Removido del exclude para permitir optimización
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
        // Disable minification for debugging
        minify: false,
        // Keep readable variable names
        rollupOptions: {
            output: {
                // Don't mangle variable names
                compact: false,
                // Keep function names readable
                preserveModules: false
            }
        },
        commonjsOptions: {
            include: [/node_modules/, /packages\/.*/],
            transformMixedEsModules: true,
            requireReturnsDefault: 'auto'
        }
    },
    define: {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
        'process.env.CLERK_SECRET_KEY': JSON.stringify(process.env.CLERK_SECRET_KEY || '')
    }
});
