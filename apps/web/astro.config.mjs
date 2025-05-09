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
    }
});
