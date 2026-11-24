/**
 * @file catalog-attribution.guard.test.ts
 * @description Every email catalog template is attributed and has a pixel (HOS-2359 OD-2, AC-1, AC-2, AC-5, AC-7).
 *
 * Two halves:
 *
 * - **Manifest (all 123 entries, no rendering):** the committed
 *   `generated/email-pixel-manifest.json` that `pnpm umami:setup` reads must equal
 *   what the catalog derives, so a template can never ship without its pixel being
 *   created. Slugs are unique, ≤ 90 chars and inside Umami's measured slug limit
 *   (100, M-1).
 * - **Render (every non-outbox entry here):** rendered with
 *   `{ medium: 'transactional', templateKey: entry.key, includePixel: true }`, every
 *   own-origin link carries the UTMs, other links are byte-identical to the
 *   unattributed render, the HTML has exactly one pixel and the text none. The outbox
 *   half needs the renderer registry `apps/api` composes, so its render guard lives
 *   in `apps/api/test/services/email-preview/email-catalog-attribution.guard.test.ts`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@react-email/render';
import {
    buildEmailTemplateCampaign,
    buildEmailTemplatePixelSlug,
    buildOwnWebOrigins,
    isOwnWebUrl,
    UTM_TOKEN_REGEX
} from '@repo/analytics';
import { configureEmailAssets, renderEmailBodies, resetEmailAssets } from '@repo/email';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
    buildEmailPixelManifest,
    EMAIL_CATALOG,
    EMAIL_PIXEL_MANIFEST_COMMAND,
    EMAIL_PIXEL_MANIFEST_PATH,
    type EmailCatalogRenderDeps,
    type EmailPixelManifestEntry,
    renderEmailCatalogScenario
} from '../../src/catalog/index';

const SITE_URL = 'https://hospeda.com.ar';
const PIXEL_BASE_URL = 'https://pulso.hospeda.com.ar';
/** Spec ceiling for a pixel slug; Umami 3.5.0 rejects > 100 (measured, M-1). */
const MAX_PIXEL_SLUG_LENGTH = 90;
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

/** `src` of every Umami pixel in an HTML document. */
function pixelsOf(html: string): readonly string[] {
    return [...html.matchAll(/<img src="([^"]*\/p\/[^"]*)"/g)].map((m) => m[1] ?? '');
}

describe('email pixel manifest (HOS-2359 OD-2)', () => {
    const committed = JSON.parse(
        readFileSync(join(__dirname, '../..', EMAIL_PIXEL_MANIFEST_PATH), 'utf-8')
    ) as EmailPixelManifestEntry[];
    const derived = buildEmailPixelManifest();

    it('covers the whole catalog (non-vacuity)', () => {
        expect(EMAIL_CATALOG.length).toBeGreaterThanOrEqual(123);
        expect(derived).toHaveLength(EMAIL_CATALOG.length);
    });

    it(`matches the catalog; run \`${EMAIL_PIXEL_MANIFEST_COMMAND}\` when it does not (AC-7)`, () => {
        const committedKeys = new Set(committed.map((entry) => entry.key));
        const missing = derived.filter((entry) => !committedKeys.has(entry.key)).map((e) => e.key);

        expect(missing, `missing from ${EMAIL_PIXEL_MANIFEST_PATH}`).toEqual([]);
        expect(committed).toEqual(derived);
    });

    it('derives each slug from the key, unique, short and in the token charset', () => {
        const slugs = derived.map((entry) => entry.pixelSlug);

        expect(new Set(slugs).size).toBe(slugs.length);
        for (const entry of derived) {
            expect(entry.pixelSlug).toBe(buildEmailTemplatePixelSlug({ key: entry.key }));
            expect(entry.utmCampaign).toBe(buildEmailTemplateCampaign({ key: entry.key }));
            expect(entry.pixelSlug.length, entry.key).toBeLessThanOrEqual(MAX_PIXEL_SLUG_LENGTH);
            expect(entry.pixelSlug, entry.key).toMatch(UTM_TOKEN_REGEX);
            expect(entry.name.startsWith('Email · '), entry.key).toBe(true);
        }
    });
});

describe('email catalog attribution render (non-outbox paths)', () => {
    beforeAll(() => {
        configureEmailAssets({ siteUrl: SITE_URL, pixelBaseUrl: PIXEL_BASE_URL });
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
    )('attributes %s / %s (AC-1, AC-2)', async (key, scenarioId, { entry }) => {
        // Arrange
        const rendered = await entry.renderScenario({ scenarioId, deps });
        const rawHtml = await render(rendered.react);

        // Act
        const { html, text } = await renderEmailBodies({
            react: rendered.react,
            attribution: { medium: 'transactional', templateKey: key, includePixel: true }
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

        // Assert: exactly one pixel, before </body>, no query string; none in text
        const pixelSlug = buildEmailTemplatePixelSlug({ key });
        expect(pixelsOf(html)).toEqual([`${PIXEL_BASE_URL}/p/${pixelSlug}`]);
        expect(html.indexOf(`/p/${pixelSlug}`)).toBeLessThan(html.lastIndexOf('</body>'));
        expect(text).not.toContain('/p/email-');
    });

    it('found at least one own-origin link per send path (non-vacuity)', () => {
        const sendPaths = new Set(cases.map((c) => c.entry.sendPath));
        for (const sendPath of sendPaths) {
            expect(ownLinksBySendPath.get(sendPath) ?? 0, sendPath).toBeGreaterThan(0);
        }
    });

    it('the admin preview carries UTMs and never the pixel (AC-5)', async () => {
        const result = await renderEmailCatalogScenario({
            key: 'auth.reset-password',
            scenarioId: 'with-name',
            deps
        });

        expect(result.html).toContain('utm_campaign=auth-reset-password');
        expect(pixelsOf(result.html)).toEqual([]);
    });
});
