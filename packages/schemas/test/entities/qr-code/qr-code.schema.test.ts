/**
 * Tests for the QR code entity schemas (HOS-981).
 *
 * @module test/entities/qr-code/qr-code.schema
 */

import { describe, expect, it } from 'vitest';
import {
    QR_CODE_DEFAULT_BACKGROUND_COLOR,
    QR_CODE_DEFAULT_FOREGROUND_COLOR,
    QR_CODE_DEFAULT_MARGIN,
    QrCodeCreateInputSchema,
    QrCodeErrorCorrectionLevelEnum,
    QrCodeFormatEnum,
    QrCodeRenderOptionsSchema,
    QrCodeScanSchema,
    QrCodeSlugSchema,
    QrCodeSourceEnum,
    QrCodeUpdateInputSchema
} from '../../../src/index.js';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';

describe('QrCodeSlugSchema', () => {
    it('accepts a slug from the unambiguous alphabet', () => {
        expect(QrCodeSlugSchema.safeParse('k7Qm2XbT').success).toBe(true);
    });

    it('rejects the ambiguous characters the printed URL cannot afford', () => {
        for (const slug of ['abcdefg0', 'abcdefgO', 'abcdefg1', 'abcdefgl', 'abcdefgI']) {
            expect(QrCodeSlugSchema.safeParse(slug).success).toBe(false);
        }
    });

    it('rejects separators and anything not URL-safe', () => {
        for (const slug of ['abcd-efg', 'abcd_efg', 'abcd efg', 'abcd/efg', 'abcd.efg']) {
            expect(QrCodeSlugSchema.safeParse(slug).success).toBe(false);
        }
    });

    it('rejects a slug that is too short', () => {
        expect(QrCodeSlugSchema.safeParse('abc').success).toBe(false);
    });
});

describe('QrCodeRenderOptionsSchema', () => {
    it('fills every field from an empty object', () => {
        const parsed = QrCodeRenderOptionsSchema.parse({});

        expect(parsed.errorCorrectionLevel).toBe(QrCodeErrorCorrectionLevelEnum.M);
        expect(parsed.format).toBe(QrCodeFormatEnum.SVG);
        expect(parsed.margin).toBe(QR_CODE_DEFAULT_MARGIN);
        expect(parsed.size).toBeNull();
        expect(parsed.foregroundColor).toBe(QR_CODE_DEFAULT_FOREGROUND_COLOR);
        expect(parsed.backgroundColor).toBe(QR_CODE_DEFAULT_BACKGROUND_COLOR);
    });

    it('keeps every explicitly supplied value', () => {
        const parsed = QrCodeRenderOptionsSchema.parse({
            errorCorrectionLevel: QrCodeErrorCorrectionLevelEnum.H,
            format: QrCodeFormatEnum.PNG,
            margin: 2,
            size: 512,
            foregroundColor: '#123456',
            backgroundColor: '#abcdef12'
        });

        expect(parsed).toStrictEqual({
            errorCorrectionLevel: QrCodeErrorCorrectionLevelEnum.H,
            format: QrCodeFormatEnum.PNG,
            margin: 2,
            size: 512,
            foregroundColor: '#123456',
            backgroundColor: '#abcdef12'
        });
    });

    it('rejects an out-of-range margin', () => {
        expect(QrCodeRenderOptionsSchema.safeParse({ margin: -1 }).success).toBe(false);
        expect(QrCodeRenderOptionsSchema.safeParse({ margin: 21 }).success).toBe(false);
    });

    it('rejects a size below the scannable floor', () => {
        expect(QrCodeRenderOptionsSchema.safeParse({ size: 32 }).success).toBe(false);
    });

    it('rejects a colour that is not hex', () => {
        expect(QrCodeRenderOptionsSchema.safeParse({ foregroundColor: 'black' }).success).toBe(
            false
        );
        expect(QrCodeRenderOptionsSchema.safeParse({ backgroundColor: '#12345' }).success).toBe(
            false
        );
    });

    it('rejects an unknown option rather than silently dropping it', () => {
        expect(
            QrCodeRenderOptionsSchema.safeParse({ logoUrl: 'https://x.test/a.png' }).success
        ).toBe(false);
    });
});

describe('QrCodeCreateInputSchema', () => {
    const base = {
        targetUrl: 'https://hospeda.com.ar/alojamientos/foo',
        label: 'Cartelera plaza Ramirez',
        source: QrCodeSourceEnum.MANUAL
    };

    it('accepts a minimal manual code with no slug', () => {
        const parsed = QrCodeCreateInputSchema.parse(base);

        expect(parsed.slug).toBeUndefined();
        expect(parsed.isActive).toBe(true);
        expect(parsed.renderOptions).toBeUndefined();
    });

    it('accepts an explicit slug', () => {
        expect(QrCodeCreateInputSchema.parse({ ...base, slug: 'k7Qm2XbT' }).slug).toBe('k7Qm2XbT');
    });

    it('rejects a target that is not a URL', () => {
        expect(QrCodeCreateInputSchema.safeParse({ ...base, targetUrl: 'not a url' }).success).toBe(
            false
        );
    });

    it('rejects an empty label', () => {
        expect(QrCodeCreateInputSchema.safeParse({ ...base, label: '' }).success).toBe(false);
    });

    it('rejects audit fields supplied by the caller', () => {
        expect(
            QrCodeCreateInputSchema.safeParse({ ...base, createdById: VALID_UUID }).success
        ).toBe(false);
        expect(QrCodeCreateInputSchema.safeParse({ ...base, id: VALID_UUID }).success).toBe(false);
    });
});

describe('QrCodeUpdateInputSchema', () => {
    it('accepts a lone targetUrl — the whole reason the table exists', () => {
        const parsed = QrCodeUpdateInputSchema.parse({
            targetUrl: 'https://hospeda.com.ar/otra-cosa'
        });

        expect(parsed).toStrictEqual({ targetUrl: 'https://hospeda.com.ar/otra-cosa' });
    });

    /**
     * The slug is already printed on a sticker somewhere. Accepting it here
     * would let an update strand every code in the field.
     */
    it('refuses a slug', () => {
        expect(QrCodeUpdateInputSchema.safeParse({ slug: 'k7Qm2XbT' }).success).toBe(false);
    });

    /**
     * A PATCH that omits `isActive` must not resurrect a retired code. This is
     * what `stripShapeDefaults` buys, and an empty patch is the way to see it.
     */
    it('materialises nothing from an empty patch', () => {
        expect(QrCodeUpdateInputSchema.parse({})).toStrictEqual({});
    });
});

describe('QrCodeScanSchema', () => {
    it('accepts a scan row', () => {
        const parsed = QrCodeScanSchema.parse({
            id: VALID_UUID,
            qrCodeId: VALID_UUID,
            scannedAt: '2026-09-02T12:00:00.000Z'
        });

        expect(parsed.scannedAt).toBeInstanceOf(Date);
    });

    /**
     * Pins the privacy decision: the scan row carries exactly three fields.
     * If someone adds `ipAddress` or `userAgent` to the entity, this fails.
     */
    it('carries no field beyond qrCodeId and scannedAt', () => {
        expect(Object.keys(QrCodeScanSchema.shape).sort()).toStrictEqual([
            'id',
            'qrCodeId',
            'scannedAt'
        ]);
    });
});
