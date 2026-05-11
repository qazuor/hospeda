import { defineConfig } from 'astro/config';

const SITE_URL = process.env.HOSPEDA_LANDING_SITE_URL || 'https://hospeda.com.ar';

export default defineConfig({
    site: SITE_URL,
    output: 'static',
    trailingSlash: 'always',
    server: {
        port: 4322
    },
    image: {
        service: { entrypoint: 'astro/assets/services/sharp' }
    }
});
