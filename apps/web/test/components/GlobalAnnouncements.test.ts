/**
 * @file GlobalAnnouncements.test.ts
 * @description Source-based tests for the Astro component (SPEC-156 PR-4
 * T-041 / AC-19). Vitest cannot render `.astro` files, so we pin the wiring
 * shape so future refactors cannot silently drop the API call, the date
 * filter, the dismiss cookie, or the BaseLayout integration.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentSrc = readFileSync(
    resolve(__dirname, '../../src/components/GlobalAnnouncements.astro'),
    'utf8'
);

const baseLayoutSrc = readFileSync(
    resolve(__dirname, '../../src/layouts/BaseLayout.astro'),
    'utf8'
);

const endpointsSrc = readFileSync(resolve(__dirname, '../../src/lib/api/endpoints.ts'), 'utf8');

describe('GlobalAnnouncements.astro (T-041)', () => {
    describe('SSR data flow', () => {
        it('imports the announcementsApi from the central endpoints module', () => {
            expect(componentSrc).toContain('announcementsApi');
            expect(componentSrc).toContain("from '@/lib/api/endpoints'");
        });

        it('does NOT call fetch() directly (must go through apiClient)', () => {
            // Per apps/web/CLAUDE.md "Rules": NEVER call fetch() directly.
            expect(componentSrc).not.toMatch(/\bfetch\(/);
        });

        it('filters by current Date at render time to mask the 5min cache', () => {
            expect(componentSrc).toContain('filterActiveByDate');
            expect(componentSrc).toContain('new Date()');
        });

        it('reads response.ok (matching ApiResult), NOT response.success', () => {
            // Regression guard: `ApiResult<T>` exposes `ok` as the
            // discriminator (see apps/web/src/lib/api/types.ts). An earlier
            // version of this file checked `response.success`, which always
            // resolved to undefined and short-circuited the banner to the
            // empty fallback — silently breaking the SSR render.
            expect(componentSrc).toMatch(/response\.ok\s*\?\s*response\.data\s*:/);
            expect(componentSrc).not.toMatch(/response\.success\b/);
        });
    });

    describe('output', () => {
        it('renders a wrapper with data-testid="global-announcements"', () => {
            expect(componentSrc).toContain('data-testid="global-announcements"');
        });

        it('renders the variant tone class on each banner', () => {
            expect(componentSrc).toContain('global-announcement--info');
            expect(componentSrc).toContain('global-announcement--warning');
            expect(componentSrc).toContain('global-announcement--danger');
        });

        it('exposes data-announcement-id, data-starts-at, data-ends-at attributes', () => {
            expect(componentSrc).toContain('data-announcement-id');
            expect(componentSrc).toContain('data-starts-at');
            expect(componentSrc).toContain('data-ends-at');
        });

        it('renders the dismiss button only when item.dismissible is true', () => {
            expect(componentSrc).toContain('item.dismissible &&');
            expect(componentSrc).toContain('data-dismiss-id');
        });

        it('uses pickAnnouncementText for locale-aware copy', () => {
            expect(componentSrc).toContain('pickAnnouncementText(item, locale)');
        });

        it('localizes the dismiss aria-label for the 3 supported locales', () => {
            expect(componentSrc).toContain('Dismiss announcement');
            expect(componentSrc).toContain('Fechar comunicado');
            expect(componentSrc).toContain('Cerrar anuncio');
        });
    });

    describe('inline client script', () => {
        it('uses the hospeda_ann_dismissed cookie name', () => {
            expect(componentSrc).toContain('hospeda_ann_dismissed');
        });

        it('refilters by date on the client (mirrors filterActiveByDate)', () => {
            // Mirrors the server logic so an item that expired during the
            // 5-min cache window hides on the next page render without an
            // extra round trip.
            expect(componentSrc).toContain('startsAt && new Date(startsAt).getTime() > now');
            expect(componentSrc).toContain('endsAt && new Date(endsAt).getTime() < now');
        });

        it('hides any banner whose id is already in the cookie', () => {
            expect(componentSrc).toContain('dismissed.has(id)');
        });

        it('writes the cookie back with SameSite=Lax', () => {
            expect(componentSrc).toContain('SameSite=Lax');
        });
    });
});

describe('BaseLayout wiring (T-041)', () => {
    it('imports GlobalAnnouncements at the top of the layout', () => {
        expect(baseLayoutSrc).toContain("from '@/components/GlobalAnnouncements.astro'");
    });

    it('mounts GlobalAnnouncements above <main> so banners are first on the page', () => {
        // Order check: the GlobalAnnouncements tag must appear BEFORE the
        // <main> tag in the layout markup.
        const announcementIdx = baseLayoutSrc.indexOf('<GlobalAnnouncements');
        const mainIdx = baseLayoutSrc.indexOf('<main');
        expect(announcementIdx).toBeGreaterThan(-1);
        expect(mainIdx).toBeGreaterThan(-1);
        expect(announcementIdx).toBeLessThan(mainIdx);
    });

    it('forwards the page locale to the component', () => {
        expect(baseLayoutSrc).toContain('<GlobalAnnouncements locale={locale} />');
    });
});

describe('announcementsApi.list (T-041)', () => {
    it('routes through apiClient.get against /api/v1/public/announcements', () => {
        expect(endpointsSrc).toContain('announcementsApi');
        expect(endpointsSrc).toContain('apiClient.get({ path: `${BASE}/announcements`');
    });
});
