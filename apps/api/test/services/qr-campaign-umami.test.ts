/**
 * HOS-2679 — QR campaigns ↔ Umami: a pure link builder, no Umami calls.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/utils/env', () => ({
    env: {
        HOSPEDA_UMAMI_URL: 'https://umami.from-env.test',
        HOSPEDA_UMAMI_WEBSITE_ID_WEB: '11111111-2222-4333-8444-555555555555'
    }
}));

import {
    buildUmamiCampaignViewUrl,
    type QrCampaignUmamiConfig,
    resolveQrCampaignsUmami
} from '../../src/services/qr-campaign-umami';

const WEBSITE = '0f3c2a5e-1111-4222-8333-444455556666';
const FULL: QrCampaignUmamiConfig = { baseUrl: 'https://umami.test', websiteId: WEBSITE };

describe('buildUmamiCampaignViewUrl', () => {
    it('encodes the operator and the campaign as ONE value', () => {
        // Act
        const url = buildUmamiCampaignViewUrl({
            baseUrl: 'https://umami.test',
            websiteId: WEBSITE,
            campaign: 'verano 2026'
        });

        // Assert
        expect(url).toBe(`https://umami.test/websites/${WEBSITE}?utmCampaign=eq.verano%202026`);
    });

    it('drops trailing slashes of the base url', () => {
        const url = buildUmamiCampaignViewUrl({
            baseUrl: 'https://umami.test//',
            websiteId: WEBSITE,
            campaign: 'x'
        });

        expect(url).toBe(`https://umami.test/websites/${WEBSITE}?utmCampaign=eq.x`);
    });

    it('keeps a dot in the campaign (Umami splits the operator on the first dot only)', () => {
        const url = buildUmamiCampaignViewUrl({
            baseUrl: 'https://umami.test',
            websiteId: WEBSITE,
            campaign: 'v1.2'
        });

        expect(url).toBe(`https://umami.test/websites/${WEBSITE}?utmCampaign=eq.v1.2`);
    });
});

describe('resolveQrCampaignsUmami', () => {
    it('gives every campaign its count and a view link', () => {
        // Act
        const result = resolveQrCampaignsUmami({
            campaigns: [
                { campaign: 'verano', qrCount: 2 },
                { campaign: 'invierno', qrCount: 1 }
            ],
            config: FULL
        });

        // Assert
        expect(result.items).toEqual([
            {
                campaign: 'verano',
                qrCount: 2,
                viewUrl: `https://umami.test/websites/${WEBSITE}?utmCampaign=eq.verano`
            },
            {
                campaign: 'invierno',
                qrCount: 1,
                viewUrl: `https://umami.test/websites/${WEBSITE}?utmCampaign=eq.invierno`
            }
        ]);
    });

    it('returns no items for no campaigns', () => {
        expect(resolveQrCampaignsUmami({ campaigns: [], config: FULL })).toEqual({ items: [] });
    });

    it('gives no link without the Umami URL or the web website id', () => {
        const campaigns = [{ campaign: 'verano', qrCount: 2 }];

        const noUrl = resolveQrCampaignsUmami({ campaigns, config: { websiteId: WEBSITE } });
        const noSite = resolveQrCampaignsUmami({
            campaigns,
            config: { baseUrl: 'https://umami.test' }
        });

        expect(noUrl.items[0]?.viewUrl).toBeNull();
        expect(noSite.items[0]?.viewUrl).toBeNull();
    });

    it('gives a campaign with a comma no link and flags it (Umami splits eq values on commas)', () => {
        const result = resolveQrCampaignsUmami({
            campaigns: [{ campaign: 'a,b', qrCount: 4 }],
            config: FULL
        });

        expect(result.items).toEqual([
            { campaign: 'a,b', qrCount: 4, unsupportedReason: 'COMMA_IN_CAMPAIGN', viewUrl: null }
        ]);
    });

    it('reads the url and website id from the api settings when no config is injected', () => {
        const result = resolveQrCampaignsUmami({ campaigns: [{ campaign: 'x', qrCount: 1 }] });

        expect(result.items[0]?.viewUrl).toBe(
            'https://umami.from-env.test/websites/11111111-2222-4333-8444-555555555555?utmCampaign=eq.x'
        );
    });
});
