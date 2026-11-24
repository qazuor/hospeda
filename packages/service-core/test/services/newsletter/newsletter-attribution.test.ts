/**
 * @file newsletter-attribution.test.ts
 *
 * Unit tests for the newsletter campaign attribution helpers (HOS-2359 §6.B.3).
 */
import { describe, expect, it } from 'vitest';
import {
    buildCampaignTestSendAttribution,
    computeCampaignAttributionSlug,
    resolveCampaignEmailAttribution
} from '../../../src/services/newsletter/newsletter-attribution.js';

const CAMPAIGN = {
    id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    title: 'Novedades de Otoño'
} as const;
const SLUG = 'novedades-de-otono-aaaaaaaa';

describe('computeCampaignAttributionSlug', () => {
    it('derives the utm_campaign slug from the title and id', () => {
        expect(computeCampaignAttributionSlug({ campaign: CAMPAIGN })).toBe(SLUG);
    });
});

describe('resolveCampaignEmailAttribution', () => {
    it('uses the stored slug', () => {
        expect(
            resolveCampaignEmailAttribution({
                campaign: { ...CAMPAIGN, attributionSlug: 'stored-1' }
            })
        ).toEqual({ medium: 'campaign', campaignSlug: 'stored-1' });
    });

    it('recomputes the slug for a campaign without one', () => {
        expect(
            resolveCampaignEmailAttribution({
                campaign: { ...CAMPAIGN, attributionSlug: null }
            })
        ).toEqual({ medium: 'campaign', campaignSlug: SLUG });
    });
});

describe('buildCampaignTestSendAttribution', () => {
    it('carries the campaign slug and nothing else (no pixel, HOS-2583)', () => {
        expect(buildCampaignTestSendAttribution({ campaign: CAMPAIGN })).toEqual({
            medium: 'campaign',
            campaignSlug: SLUG
        });
    });
});
