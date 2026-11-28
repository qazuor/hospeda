/**
 * HOS-2679 PR 2 — the QR campaigns ↔ Umami contract.
 */

import { describe, expect, it } from 'vitest';
import {
    QR_CAMPAIGN_SEGMENT_MAX_LENGTH,
    QrCampaignUmamiItemSchema,
    QrCampaignUmamiSegmentCreateSchema,
    qrCampaignSegmentName,
    qrCampaignUmamiUnsupportedReason
} from '../../../src/entities/qr-code/qr-code-campaign-umami.schema.js';

describe('qrCampaignSegmentName', () => {
    it('prefixes the campaign with "QR · "', () => {
        expect(qrCampaignSegmentName({ campaign: 'verano 2026' })).toBe('QR · verano 2026');
    });
});

describe('QrCampaignUmamiSegmentCreateSchema', () => {
    it('accepts a campaign', () => {
        expect(QrCampaignUmamiSegmentCreateSchema.parse({ campaign: 'verano' })).toStrictEqual({
            campaign: 'verano'
        });
    });

    it('refuses an unknown key (strict)', () => {
        expect(
            QrCampaignUmamiSegmentCreateSchema.safeParse({ campaign: 'verano', name: 'x' }).success
        ).toBe(false);
    });

    it('refuses an empty campaign', () => {
        expect(QrCampaignUmamiSegmentCreateSchema.safeParse({ campaign: '' }).success).toBe(false);
    });
});

describe('QrCampaignUmamiItemSchema', () => {
    it('accepts an unavailable row without a view url', () => {
        // Arrange
        const row = { campaign: 'x', qrCount: 0, umami: { status: 'unavailable', viewUrl: null } };

        // Act
        const parsed = QrCampaignUmamiItemSchema.safeParse(row);

        // Assert
        expect(parsed.success).toBe(true);
    });

    it('refuses an unknown status', () => {
        const row = { campaign: 'x', qrCount: 1, umami: { status: 'other', viewUrl: null } };

        expect(QrCampaignUmamiItemSchema.safeParse(row).success).toBe(false);
    });
});

describe('qrCampaignUmamiUnsupportedReason', () => {
    it('flags a comma (Umami splits eq values on it)', () => {
        expect(qrCampaignUmamiUnsupportedReason({ campaign: 'a,b' })).toBe('COMMA_IN_CAMPAIGN');
    });

    it('accepts a dot (Umami splits the operator on the FIRST dot only)', () => {
        expect(qrCampaignUmamiUnsupportedReason({ campaign: 'v1.2' })).toBeUndefined();
    });

    it('flags a campaign longer than the create accepts, and the limits agree', () => {
        // Arrange
        const tooLong = 'x'.repeat(QR_CAMPAIGN_SEGMENT_MAX_LENGTH + 1);
        const longest = 'x'.repeat(QR_CAMPAIGN_SEGMENT_MAX_LENGTH);

        // Assert
        expect(qrCampaignUmamiUnsupportedReason({ campaign: tooLong })).toBe('TOO_LONG');
        expect(qrCampaignUmamiUnsupportedReason({ campaign: longest })).toBeUndefined();
        expect(QrCampaignUmamiSegmentCreateSchema.safeParse({ campaign: tooLong }).success).toBe(
            false
        );
        expect(QrCampaignUmamiSegmentCreateSchema.safeParse({ campaign: longest }).success).toBe(
            true
        );
    });
});
