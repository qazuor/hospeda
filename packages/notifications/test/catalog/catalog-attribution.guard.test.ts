/**
 * @file catalog-attribution.guard.test.ts
 * @description Every email catalog template is attributed and carries no open pixel (HOS-2359 AC-1, AC-5; HOS-2583 AC-2).
 *
 * Every non-outbox entry is rendered with
 * `{ medium: 'transactional', templateKey: entry.key }`: every own-origin link carries
 * the UTMs, other links are byte-identical to the unattributed render and neither the
 * HTML nor the text contains an image of ours. The outbox half needs the renderer
 * registry `apps/api` composes, so its render guard lives in
 * `apps/api/test/services/email-preview/email-catalog-attribution.guard.test.ts`.
 */
import { render } from '@react-email/render';
import { buildEmailTemplateCampaign, buildOwnWebOrigins, isOwnWebUrl } from '@repo/analytics';
import { configureEmailAssets, renderEmailBodies, resetEmailAssets } from '@repo/email';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
    EMAIL_CATALOG,
    type EmailCatalogRenderDeps,
    renderEmailCatalogScenario
} from '../../src/catalog/index';

const SITE_URL = 'https://hospeda.com.ar';
const OWN_ORIGINS = buildOwnWebOrigins({ siteUrl: SITE_URL });

const deps: EmailCatalogRenderDeps = {
    siteUrl: SITE_URL,
    outboxRenderer: () => {
        throw new Error('outbox renders are covered in apps/api');
    }
};

/** Decoded `href` values of every `<a>` in an HTML document, in order. */
function hrefsOf(html: string): readonly string[] {
    return [...html.matchAll(/<a\s(?:[^>]*?\s)?href="([^"]*)"/gi)].map((m) =>
        (m[1] ?? '').replaceAll('&amp;', '&')
    );
}

/** `src` of every image that points at a pixel path (`/p/<slug>`). */
function pixelsOf(html: string): readonly string[] {
    return [...html.matchAll(/<img src="([^"]*\/p\/[^"]*)"/g)].map((m) => m[1] ?? '');
}

describe('email catalog attribution render (non-outbox paths)', () => {
    beforeAll(() => {
        configureEmailAssets({ siteUrl: SITE_URL });
    });

    afterAll(() => {
        resetEmailAssets();
    });

    const cases = EMAIL_CATALOG.filter((entry) => entry.sendPath !== 'outbox').flatMap((entry) =>
        entry.scenarios.map((scenario) => ({ entry, scenarioId: scenario.id }))
    );
    const ownLinksBySendPath = new Map<string, number>();

    it('has non-outbox scenarios to render', () => {
        expect(cases.length).toBeGreaterThanOrEqual(61);
    });

    it.each(
        cases.map((c) => [c.entry.key, c.scenarioId, c] as const)
    )('attributes %s / %s (AC-1, HOS-2583 AC-2)', async (key, scenarioId, { entry }) => {
        // Arrange
        const rendered = await entry.renderScenario({ scenarioId, deps });
        const rawHtml = await render(rendered.react);

        // Act
        const { html, text } = await renderEmailBodies({
            react: rendered.react,
            attribution: { medium: 'transactional', templateKey: key }
        });

        // Assert: links
        const campaign = buildEmailTemplateCampaign({ key });
        const hrefs = hrefsOf(html);
        const own = hrefs.filter((url) => isOwnWebUrl({ url, ownOrigins: OWN_ORIGINS }));
        for (const url of own) {
            const params = new URL(url).searchParams;
            expect(params.get('utm_source'), url).toBe('email');
            expect(params.get('utm_medium'), url).toBe('transactional');
            expect(params.get('utm_campaign'), url).toBe(campaign);
            expect(params.get('utm_content') ?? '', url).not.toBe('');
        }
        const foreign = hrefs.filter((url) => !isOwnWebUrl({ url, ownOrigins: OWN_ORIGINS }));
        const rawForeign = hrefsOf(rawHtml).filter(
            (url) => !isOwnWebUrl({ url, ownOrigins: OWN_ORIGINS })
        );
        expect(foreign).toEqual(rawForeign);
        ownLinksBySendPath.set(
            entry.sendPath,
            (ownLinksBySendPath.get(entry.sendPath) ?? 0) + own.length
        );

        // Assert: no open pixel in the HTML nor the text (HOS-2583, AC-2)
        expect(pixelsOf(html)).toEqual([]);
        expect(html).toBe(html.replace(/<img[^>]*width="1" height="1"[^>]*>/g, ''));
        expect(text).not.toContain('/p/email-');
    });

    it('found at least one own-origin link per send path (non-vacuity)', () => {
        const sendPaths = new Set(cases.map((c) => c.entry.sendPath));
        for (const sendPath of sendPaths) {
            expect(ownLinksBySendPath.get(sendPath) ?? 0, sendPath).toBeGreaterThan(0);
        }
    });

    it('the admin preview carries UTMs and no pixel (AC-5)', async () => {
        const result = await renderEmailCatalogScenario({
            key: 'auth.reset-password',
            scenarioId: 'with-name',
            deps
        });

        expect(result.html).toContain('utm_campaign=auth-reset-password');
        expect(pixelsOf(result.html)).toEqual([]);
    });
});
