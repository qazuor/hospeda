/**
 * @file email-catalog-attribution.guard.test.ts
 * @description HOS-2359 AC-1, AC-2: EVERY email catalog entry (all send paths, outbox
 * included) rendered through the production preview dependencies and attributed as a
 * real send (`includePixel: true`): own-origin links carry the UTMs, every other link
 * is byte-identical to the unattributed render, the HTML holds exactly one pixel
 * before `</body>` and the text none. `packages/notifications` guards the manifest
 * and the non-outbox renders; the outbox renderer registry is composed here, so this
 * is the only place the whole catalog renders.
 */
import { render } from '@react-email/render';
import {
    buildEmailTemplateCampaign,
    buildEmailTemplatePixelSlug,
    buildOwnWebOrigins,
    isOwnWebUrl
} from '@repo/analytics';
import { configureEmailAssets, renderEmailBodies, resetEmailAssets } from '@repo/email';
import { EMAIL_CATALOG, type EmailCatalogRenderDeps } from '@repo/notifications';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildEmailPreviewDeps } from '../../../src/services/email-preview/email-preview-deps.js';
import { calledIoSpies, ioGuardsAreArmed } from './preview-io-guards.js';

vi.mock(
    '../../../src/utils/partner-application/partner-claim-secret.js',
    async (importOriginal) => ({
        ...(await importOriginal<Record<string, unknown>>()),
        issuePartnerClaimSecret: vi.fn(async () => {
            throw new Error('A real database-backed collaborator ran during an email preview');
        })
    })
);
vi.mock(
    '../../../src/utils/listing-publication/listing-names-reader.js',
    async (importOriginal) => ({
        ...(await importOriginal<Record<string, unknown>>()),
        readListingNames: vi.fn(async () => {
            throw new Error('A real database-backed collaborator ran during an email preview');
        })
    })
);
vi.mock(
    '../../../src/utils/reconciliation-summary/reconciliation-subjects-reader.js',
    async (importOriginal) => ({
        ...(await importOriginal<Record<string, unknown>>()),
        readReconciliationSubjects: vi.fn(async () => {
            throw new Error('A real database-backed collaborator ran during an email preview');
        })
    })
);

const SITE_URL = 'https://hospeda.com.ar';
const PIXEL_BASE_URL = 'https://pulso.hospeda.com.ar';
const OWN_ORIGINS = buildOwnWebOrigins({ siteUrl: SITE_URL });

const deps: EmailCatalogRenderDeps = buildEmailPreviewDeps({
    siteUrl: SITE_URL,
    adminUrl: 'https://admin.hospeda.com.ar',
    environmentLabel: 'STAGING'
});

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

const cases = EMAIL_CATALOG.map((entry) => [entry.key, entry] as const);
const ownLinksBySendPath = new Map<string, number>();

describe('email catalog attribution: every entry, every send path (HOS-2359)', () => {
    beforeAll(() => {
        configureEmailAssets({ siteUrl: SITE_URL, pixelBaseUrl: PIXEL_BASE_URL });
    });

    afterAll(() => {
        resetEmailAssets();
    });

    it('renders the whole catalog with an armed I/O guard (non-vacuity)', () => {
        expect(cases.length).toBeGreaterThanOrEqual(123);
        expect(ioGuardsAreArmed()).toBe(true);
    });

    it.each(cases)('attributes %s (AC-1, AC-2)', async (key, entry) => {
        // Arrange
        const scenarioId = entry.scenarios[0]?.id ?? 'default';
        const rendered = await entry.renderScenario({ scenarioId, deps });
        const rawHtml = await render(rendered.react);

        // Act
        const { html, text } = await renderEmailBodies({
            react: rendered.react,
            attribution: { medium: 'transactional', templateKey: key, includePixel: true }
        });

        // Assert: own links carry the UTMs, foreign links are untouched
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

        // Assert: exactly one pixel, before </body>; none in the text part
        const pixelSlug = buildEmailTemplatePixelSlug({ key });
        expect(pixelsOf(html)).toEqual([`${PIXEL_BASE_URL}/p/${pixelSlug}`]);
        expect(html.indexOf(`/p/${pixelSlug}`)).toBeLessThan(html.lastIndexOf('</body>'));
        expect(text).not.toContain('/p/email-');
        expect(calledIoSpies(), 'the render performed I/O').toEqual([]);
    });

    it('found at least one own-origin link per send path (non-vacuity)', () => {
        const sendPaths = new Set(EMAIL_CATALOG.map((entry) => entry.sendPath));
        expect(sendPaths.has('outbox')).toBe(true);
        for (const sendPath of sendPaths) {
            expect(ownLinksBySendPath.get(sendPath) ?? 0, sendPath).toBeGreaterThan(0);
        }
    });
});
