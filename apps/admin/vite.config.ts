import { resolve } from 'node:path';
import { URL, fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
    envDir: resolve(__dirname, '../../'),
    plugins: [
        tsconfigPaths({ projects: ['./tsconfig.json'] }),
        tailwindcss(),
        tanstackStart({ customViteReactPlugin: true }),
        react()
    ],
    resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
            '@repo/types': resolve(__dirname, '../../packages/types/src'),
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
            '@repo/types',
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
        commonjsOptions: {
            include: [/node_modules/, /packages\/.*/],
            transformMixedEsModules: true,
            requireReturnsDefault: 'auto'
        }
    },
    define: {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
        // Map Vite-specific variables to universal ones
        'import.meta.env.VITE_CLERK_PUBLISHABLE_KEY': JSON.stringify(
            process.env.PUBLIC_CLERK_PUBLISHABLE_KEY
        ),
        'import.meta.env.VITE_ADMIN_API_BASE_URL': JSON.stringify(process.env.PUBLIC_API_BASE_URL),
        'import.meta.env.VITE_DEBUG_ACTOR_ID': JSON.stringify(process.env.DEBUG_ACTOR_ID)
    }
});
