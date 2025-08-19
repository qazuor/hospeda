import node from '@astrojs/node';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';
import clerk from '@clerk/astro';
import devtoolBreakpoints from 'astro-devtool-breakpoints';
import astroFontPicker from 'astro-font-picker';
import lighthouse from 'astro-lighthouse';
import og from 'astro-og';
import { defineConfig } from 'astro/config';

import typedLinks from 'astro-typed-links';

import reunmedianormalizeTrailingSlash from '@reunmedia/astro-normalize-trailing-slash';

// Configuration for preview/testing - uses Node adapter instead of Vercel
export default defineConfig({
    integrations: [
        tailwind({ config: { applyBaseStyles: true } }),
        react(),
        clerk(),
        sitemap(),
        og(),
        lighthouse(),
        astroFontPicker(),
        devtoolBreakpoints(),
        typedLinks(),
        reunmedianormalizeTrailingSlash()
    ],
    output: 'server',
    adapter: node({
        mode: 'standalone'
    }),
    trailingSlash: 'always',
    site: process.env.PUBLIC_SITE_URL ?? 'http://localhost:4321',
    vite: {
        resolve: {
            alias: {
                '@repo/auth-ui': '/home/qazuor/projects/WEBS/hospeda/packages/auth-ui/src',
                '@repo/types': '/home/qazuor/projects/WEBS/hospeda/packages/types/src',
                '@repo/config': '/home/qazuor/projects/WEBS/hospeda/packages/config/src',
                '@repo/db': '/home/qazuor/projects/WEBS/hospeda/packages/db/src',
                '@repo/utils': '/home/qazuor/projects/WEBS/hospeda/packages/utils/src',
                '@repo/logger': '/home/qazuor/projects/WEBS/hospeda/packages/logger/src',
                '@repo/service-common':
                    '/home/qazuor/projects/WEBS/hospeda/packages/service-common/src'
            }
        }
    }
});
