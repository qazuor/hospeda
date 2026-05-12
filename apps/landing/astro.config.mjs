import { defineConfig } from 'astro/config';

const SITE_URL = process.env.HOSPEDA_LANDING_SITE_URL || 'https://hospeda.com.ar';
// Public API base URL — baked into the client bundle at build time so the
// newsletter form knows where to POST. Override in CI/Coolify build args
// to point at staging-api during preview deployments.
const PUBLIC_API_URL = process.env.PUBLIC_API_URL || 'https://api.hospeda.com.ar';

export default defineConfig({
    site: SITE_URL,
    output: 'static',
    trailingSlash: 'always',
    server: {
        port: 4322
    },
    image: {
        service: { entrypoint: 'astro/assets/services/sharp' }
    },
    vite: {
        define: {
            'import.meta.env.PUBLIC_API_URL': JSON.stringify(PUBLIC_API_URL)
        }
    }
});
