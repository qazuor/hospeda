/**
 * @file newsletter-attribution.test.ts
 *
 * Unit tests for the newsletter campaign attribution helpers (HOS-2359 §6.B.3).
 */
import { describe, expect, it, vi } from 'vitest';
import {
    buildCampaignTestSendAttribution,
    provisionCampaignAttribution,
    resolveCampaignEmailAttribution
} from '../../../src/services/newsletter/newsletter-attribution.js';

const CAMPAIGN = {
    id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    title: 'Novedades de Otoño'
} as const;
const SLUG = 'novedades-de-otono-aaaaaaaa';

function makeLogger() {
    return { warn: vi.fn() };
}

describe('provisionCampaignAttribution', () => {
    it('asks the provisioner for newsletter-<slug> and stores both slugs (AC-10)', async () => {
        // Arrange
        const provisioner = vi.fn(async ({ slug }: { slug: string }) => ({ slug }));
        const logger = makeLogger();

        // Act
        const result = await provisionCampaignAttribution({
            campaign: CAMPAIGN,
            provisioner,
            logger
        });

        // Assert
        expect(provisioner).toHaveBeenCalledWith({
            slug: `newsletter-${SLUG}`,
            name: 'Newsletter · Novedades de Otoño'
        });
        expect(result).toEqual({ attributionSlug: SLUG, umamiPixelSlug: `newsletter-${SLUG}` });
        expect(logger.warn).not.toHaveBeenCalled();
    });

    it('stores a NULL pixel when the provisioner answers null (AC-11)', async () => {
        const result = await provisionCampaignAttribution({
            campaign: CAMPAIGN,
            provisioner: vi.fn(async () => null),
            logger: makeLogger()
        });

        expect(result).toEqual({ attributionSlug: SLUG, umamiPixelSlug: null });
    });

    it('treats a rejection as null and logs one warn (AC-11)', async () => {
        const logger = makeLogger();

        const result = await provisionCampaignAttribution({
            campaign: CAMPAIGN,
            provisioner: vi.fn(async () => {
                throw new Error('boom');
            }),
            logger
        });

        expect(result.umamiPixelSlug).toBeNull();
        expect(logger.warn).toHaveBeenCalledTimes(1);
    });

    it('stores a NULL pixel without a provisioner', async () => {
        const result = await provisionCampaignAttribution({
            campaign: CAMPAIGN,
            provisioner: undefined,
            logger: makeLogger()
        });

        expect(result).toEqual({ attributionSlug: SLUG, umamiPixelSlug: null });
    });
});

describe('resolveCampaignEmailAttribution', () => {
    it('uses the stored slugs', () => {
        expect(
            resolveCampaignEmailAttribution({
                campaign: {
                    ...CAMPAIGN,
                    attributionSlug: 'stored-1',
                    umamiPixelSlug: 'newsletter-stored-1'
                }
            })
        ).toEqual({
            medium: 'campaign',
            campaignSlug: 'stored-1',
            pixelSlug: 'newsletter-stored-1'
        });
    });

    it('recomputes the slug and renders no pixel for a campaign without them', () => {
        expect(
            resolveCampaignEmailAttribution({
                campaign: { ...CAMPAIGN, attributionSlug: null, umamiPixelSlug: null }
            })
        ).toEqual({ medium: 'campaign', campaignSlug: SLUG, pixelSlug: null });
    });
});

describe('buildCampaignTestSendAttribution', () => {
    it('never carries a pixel (AC-13)', () => {
        expect(buildCampaignTestSendAttribution({ campaign: CAMPAIGN })).toEqual({
            medium: 'campaign',
            campaignSlug: SLUG,
            pixelSlug: null
        });
    });
});
