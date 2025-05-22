import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import vercel from '@astrojs/vercel';
import { defineConfig } from 'astro/config';

export default defineConfig({
    integrations: [tailwind(), react()],
    output: 'server',
    adapter: vercel(),
    server: {
        port: 4321
    },
    i18n: {
        defaultLocale: 'es',
        locales: ['es', 'en', 'pt'],
        routing: {
            prefixDefaultLocale: false
        }
    },
    vite: {
        resolve: {
            alias: {
                '@repo/types': new URL('../../packages/types/src', import.meta.url).pathname,
                '@repo/config': new URL('../../packages/config/src', import.meta.url).pathname,
                '@repo/db': new URL('../../packages/db/src', import.meta.url).pathname,
                '@repo/logger': new URL('../../packages/logger/src', import.meta.url).pathname
            }
        }
    }
});
