/**
 * @file sitemap.test.ts
 * @description Validates the Astro configuration file for correct sitemap
 * integration setup, site URL configuration, and sitemap filter rules.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const astroConfigContent = readFileSync(resolve(__dirname, '../../astro.config.mjs'), 'utf8');

describe('astro.config.mjs - sitemap', () => {
    // ---------------------------------------------------------------------------
    // Import
    // ---------------------------------------------------------------------------
    describe('sitemap import', () => {
        it('should import @astrojs/sitemap', () => {
            expect(astroConfigContent).toContain("from '@astrojs/sitemap'");
        });

        it('should assign the sitemap import to a named binding', () => {
            expect(astroConfigContent).toMatch(/import\s+sitemap\s+from\s+'@astrojs\/sitemap'/);
        });
    });

    // ---------------------------------------------------------------------------
    // Integration usage
    // ---------------------------------------------------------------------------
    describe('sitemap integration', () => {
        it('should call sitemap() inside the integrations array', () => {
            expect(astroConfigContent).toContain('sitemap(');
        });

        it('should register sitemap as part of the integrations config key', () => {
            // Verify the integrations block exists and sitemap is somewhere inside it
            const integrationsStart = astroConfigContent.indexOf('integrations:');
            expect(integrationsStart).toBeGreaterThan(-1);

            const afterIntegrations = astroConfigContent.slice(integrationsStart);
            expect(afterIntegrations).toContain('sitemap(');
        });

        it('should configure a filter function on the sitemap', () => {
            expect(astroConfigContent).toContain('filter:');
        });

        it('should exclude auth routes from the sitemap', () => {
            expect(astroConfigContent).toContain('/auth/');
        });

        it('should exclude account routes from the sitemap', () => {
            expect(astroConfigContent).toContain('/mi-cuenta/');
        });
    });

    // ---------------------------------------------------------------------------
    // Site URL
    // ---------------------------------------------------------------------------
    describe('site URL configuration', () => {
        it('should set the site property in the defineConfig call', () => {
            expect(astroConfigContent).toContain('site:');
        });

        it('should derive site URL from HOSPEDA_SITE_URL environment variable', () => {
            expect(astroConfigContent).toContain('HOSPEDA_SITE_URL');
        });

        it('should fall back to a localhost URL when the env var is absent', () => {
            expect(astroConfigContent).toContain('http://localhost:4321');
        });
    });

    // ---------------------------------------------------------------------------
    // React integration is also present (sanity check for integrations array)
    // ---------------------------------------------------------------------------
    describe('other integrations (sanity)', () => {
        it('should also register the react integration', () => {
            expect(astroConfigContent).toContain("from '@astrojs/react'");
            expect(astroConfigContent).toContain('react()');
        });
    });
});
