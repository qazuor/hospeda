/**
 * @file qr-attribution.test.ts
 * @description HOS-2359 §6.D.1 (OD-9): the UTMs a printed QR code adds to its
 * redirect destination. The printed code and the stored target never change; only
 * the `targetUrl` the resolve route answers with is decorated.
 */
import { EntityTypeEnum, QrCodePurposeEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { buildQrRedirectTarget } from '../../src/utils/qr-attribution';

const SITE_URL = 'https://hospeda.com.ar';
const TARGET = 'https://hospeda.com.ar/es/alojamientos/cabana-del-rio/';

describe('buildQrRedirectTarget', () => {
    it.each([
        [EntityTypeEnum.ACCOMMODATION, QrCodePurposeEnum.LISTING, 'accommodation', 'listing'],
        [EntityTypeEnum.VENUE, QrCodePurposeEnum.MENU, 'venue', 'menu'],
        [EntityTypeEnum.EXPERIENCE, QrCodePurposeEnum.BROCHURE, 'experience', 'brochure'],
        [
            EntityTypeEnum.HOST_TRADE,
            QrCodePurposeEnum.HOST_TRADE_USAGE,
            'host-trade',
            'host-trade-usage'
        ],
        [EntityTypeEnum.EXPERIENCE, QrCodePurposeEnum.CERTIFICATE, 'certificate', 'certificate']
    ])('maps %s + %s to campaign=%s content=%s', (entityType, purpose, campaign, content) => {
        // Arrange / Act
        const result = buildQrRedirectTarget({
            targetUrl: TARGET,
            entityType,
            purpose,
            siteUrl: SITE_URL
        });

        // Assert
        expect(result).toBe(
            `${TARGET}?utm_source=qr&utm_medium=print&utm_campaign=${campaign}&utm_content=${content}`
        );
    });

    it('uses campaign=manual and no content for an operator code with no entity or purpose', () => {
        const result = buildQrRedirectTarget({
            targetUrl: TARGET,
            entityType: null,
            purpose: null,
            siteUrl: SITE_URL
        });

        expect(result).toBe(`${TARGET}?utm_source=qr&utm_medium=print&utm_campaign=manual`);
    });

    it('uses campaign=manual for an entity type outside the QR vocabulary', () => {
        const result = buildQrRedirectTarget({
            targetUrl: TARGET,
            entityType: EntityTypeEnum.DESTINATION,
            purpose: undefined,
            siteUrl: SITE_URL
        });

        expect(result).toBe(`${TARGET}?utm_source=qr&utm_medium=print&utm_campaign=manual`);
    });

    it('certificate purpose wins over the entity type', () => {
        const result = buildQrRedirectTarget({
            targetUrl: TARGET,
            entityType: null,
            purpose: QrCodePurposeEnum.CERTIFICATE,
            siteUrl: SITE_URL
        });

        expect(result).toContain('utm_campaign=certificate');
    });

    it('returns an external target unchanged', () => {
        const external = 'https://www.instagram.com/hospeda/';

        const result = buildQrRedirectTarget({
            targetUrl: external,
            entityType: EntityTypeEnum.ACCOMMODATION,
            purpose: QrCodePurposeEnum.LISTING,
            siteUrl: SITE_URL
        });

        expect(result).toBe(external);
    });

    it('decorates a target on the configured site origin (staging, local)', () => {
        const result = buildQrRedirectTarget({
            targetUrl: 'http://localhost:4321/es/',
            entityType: null,
            purpose: null,
            siteUrl: 'http://localhost:4321'
        });

        expect(result).toBe(
            'http://localhost:4321/es/?utm_source=qr&utm_medium=print&utm_campaign=manual'
        );
    });

    it('leaves a target that already carries UTMs alone', () => {
        const preset = `${TARGET}?utm_source=flyer`;

        const result = buildQrRedirectTarget({
            targetUrl: preset,
            entityType: EntityTypeEnum.ACCOMMODATION,
            purpose: QrCodePurposeEnum.LISTING,
            siteUrl: SITE_URL
        });

        expect(result).toBe(preset);
    });
});
