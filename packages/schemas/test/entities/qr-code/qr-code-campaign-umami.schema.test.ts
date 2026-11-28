/**
 * HOS-2679 — the QR campaigns ↔ Umami contract (a link only, no segments).
 */

import { describe, expect, it } from 'vitest';
import {
    QrCampaignsUmamiResponseSchema,
    QrCampaignUmamiItemSchema,
    qrCampaignUmamiUnsupportedReason
} from '../../../src/entities/qr-code/qr-code-campaign-umami.schema.js';

describe('QrCampaignUmamiItemSchema', () => {
    it('accepts a row without a view url (Umami not configured)', () => {
        // Arrange
        const row = { campaign: 'x', qrCount: 0, viewUrl: null };

        // Act
        const parsed = QrCampaignUmamiItemSchema.safeParse(row);

        // Assert
        expect(parsed.success).toBe(true);
    });

    it('accepts a row with a view url', () => {
        const row = { campaign: 'x', qrCount: 2, viewUrl: 'https://umami.example/websites/abc' };

        expect(QrCampaignUmamiItemSchema.safeParse(row).success).toBe(true);
    });

    it('refuses an unknown unsupported reason', () => {
        const row = { campaign: 'x', qrCount: 1, viewUrl: null, unsupportedReason: 'TOO_LONG' };

        expect(QrCampaignUmamiItemSchema.safeParse(row).success).toBe(false);
    });

    it('refuses a negative count', () => {
        expect(
            QrCampaignUmamiItemSchema.safeParse({ campaign: 'x', qrCount: -1, viewUrl: null })
                .success
        ).toBe(false);
    });
});

describe('QrCampaignsUmamiResponseSchema', () => {
    it('carries only the items (no create capability: the panel links, never writes)', () => {
        expect(QrCampaignsUmamiResponseSchema.parse({ items: [] })).toStrictEqual({ items: [] });
    });
});

describe('qrCampaignUmamiUnsupportedReason', () => {
    it('flags a comma (Umami splits eq values on it)', () => {
        expect(qrCampaignUmamiUnsupportedReason({ campaign: 'a,b' })).toBe('COMMA_IN_CAMPAIGN');
    });

    it('accepts a dot (Umami splits the operator on the FIRST dot only)', () => {
        expect(qrCampaignUmamiUnsupportedReason({ campaign: 'v1.2' })).toBeUndefined();
    });
});
