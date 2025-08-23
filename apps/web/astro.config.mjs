import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import clerk from '@clerk/astro';
import tailwindcss from '@tailwindcss/vite';
import devtoolBreakpoints from 'astro-devtool-breakpoints';
import astroFontPicker from 'astro-font-picker';
import lighthouse from 'astro-lighthouse';
import og from 'astro-og';
import { defineConfig } from 'astro/config';

import typedLinks from 'astro-typed-links';

import reunmedianormalizeTrailingSlash from '@reunmedia/astro-normalize-trailing-slash';

// https://astro.build/config
export default defineConfig({
    envDir: new URL('../../', import.meta.url).pathname,
    integrations: [
        react(),
        clerk(),
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
    site: process.env.PUBLIC_SITE_URL ?? 'http://localhost:4321',
    viewTransitions: true,
    server: {
        port: 4321
    },
    vite: {
        css: {
            transformer: 'lightningcss'
        },
        plugins: [tailwindcss()],
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
