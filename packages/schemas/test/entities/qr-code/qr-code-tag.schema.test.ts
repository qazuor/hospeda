/**
 * HOS-2679 — QR-code tag schemas and the two new admin list filters.
 */
import { describe, expect, it } from 'vitest';
import {
    QR_CODE_TAG_MAX_PER_CODE,
    QR_CODE_TAG_NAME_MAX_LENGTH,
    QrCodeAdminListItemSchema,
    QrCodeAdminSearchSchema,
    QrCodeSetTagsInputSchema,
    QrCodeTagCreateInputSchema,
    QrCodeTagRefSchema,
    QrCodeTagUpdateInputSchema
} from '../../../src/index.js';

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';

describe('QrCodeTagCreateInputSchema', () => {
    it('accepts a name and trims it', () => {
        const parsed = QrCodeTagCreateInputSchema.parse({ name: '  Verano 2026 ' });
        expect(parsed).toStrictEqual({ name: 'Verano 2026' });
    });

    it('accepts a colour from the shared palette, or null', () => {
        expect(QrCodeTagCreateInputSchema.parse({ name: 'x', color: 'BLUE' }).color).toBe('BLUE');
        expect(QrCodeTagCreateInputSchema.parse({ name: 'x', color: null }).color).toBeNull();
    });

    it('rejects an unknown colour', () => {
        expect(QrCodeTagCreateInputSchema.safeParse({ name: 'x', color: 'NAVY' }).success).toBe(
            false
        );
    });

    it('rejects a blank name with the i18n key', () => {
        const result = QrCodeTagCreateInputSchema.safeParse({ name: '   ' });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe('zodError.qrCodeTag.name.min');
    });

    it('rejects a name past the limit', () => {
        const result = QrCodeTagCreateInputSchema.safeParse({
            name: 'a'.repeat(QR_CODE_TAG_NAME_MAX_LENGTH + 1)
        });
        expect(result.error?.issues[0]?.message).toBe('zodError.qrCodeTag.name.max');
    });

    it('refuses a caller-supplied slug: the service derives it', () => {
        expect(QrCodeTagCreateInputSchema.safeParse({ name: 'x', slug: 'x' }).success).toBe(false);
    });
});

describe('QrCodeTagUpdateInputSchema', () => {
    it('accepts a rename alone, a recolour alone, or nothing', () => {
        expect(QrCodeTagUpdateInputSchema.parse({ name: 'Nuevo' })).toStrictEqual({
            name: 'Nuevo'
        });
        expect(QrCodeTagUpdateInputSchema.parse({ color: null })).toStrictEqual({ color: null });
        expect(QrCodeTagUpdateInputSchema.parse({})).toStrictEqual({});
    });

    it('refuses a slug', () => {
        expect(QrCodeTagUpdateInputSchema.safeParse({ slug: 'x' }).success).toBe(false);
    });
});

describe('QrCodeSetTagsInputSchema', () => {
    it('accepts an empty set (clear all tags)', () => {
        expect(QrCodeSetTagsInputSchema.parse({ tagIds: [] })).toStrictEqual({ tagIds: [] });
    });

    it('rejects a non-uuid', () => {
        expect(QrCodeSetTagsInputSchema.safeParse({ tagIds: ['nope'] }).success).toBe(false);
    });

    it('rejects more than the per-code cap', () => {
        const tagIds = Array.from(
            { length: QR_CODE_TAG_MAX_PER_CODE + 1 },
            (_, i) => `11111111-1111-4111-8111-${String(i).padStart(12, '0')}`
        );
        const result = QrCodeSetTagsInputSchema.safeParse({ tagIds });
        expect(result.error?.issues[0]?.message).toBe('zodError.qrCodeTag.tagIds.max');
    });
});

describe('QrCodeAdminSearchSchema — HOS-2679 filters', () => {
    it('parses a comma-separated tagIds list', () => {
        const parsed = QrCodeAdminSearchSchema.parse({ tagIds: `${UUID_A}, ${UUID_B},` });
        expect(parsed.tagIds).toStrictEqual([UUID_A, UUID_B]);
    });

    it('parses a repeated tagIds param', () => {
        const parsed = QrCodeAdminSearchSchema.parse({ tagIds: [UUID_A, UUID_B] });
        expect(parsed.tagIds).toStrictEqual([UUID_A, UUID_B]);
    });

    it('re-parses its own output (the route parses, then the service parses again)', () => {
        const once = QrCodeAdminSearchSchema.parse({ tagIds: UUID_A, utmCampaign: ' verano ' });
        const twice = QrCodeAdminSearchSchema.parse(once);
        expect(twice.tagIds).toStrictEqual([UUID_A]);
        expect(twice.utmCampaign).toBe('verano');
    });

    it('rejects a malformed tag id', () => {
        expect(QrCodeAdminSearchSchema.safeParse({ tagIds: 'abc' }).success).toBe(false);
    });

    it('rejects a blank utmCampaign rather than ignoring it', () => {
        const result = QrCodeAdminSearchSchema.safeParse({ utmCampaign: '  ' });
        expect(result.error?.issues[0]?.message).toBe('zodError.qrCode.utmCampaign.min');
    });

    it('keeps the pre-existing filters', () => {
        const parsed = QrCodeAdminSearchSchema.parse({
            source: 'MANUAL',
            entityType: 'VENUE',
            purpose: 'MENU',
            isActive: 'false'
        });
        expect(parsed.source).toBe('MANUAL');
        expect(parsed.entityType).toBe('VENUE');
        expect(parsed.purpose).toBe('MENU');
        expect(parsed.isActive).toBe(false);
    });
});

describe('QrCodeAdminListItemSchema', () => {
    it('requires tags, scanUrl and scanUtm on top of the code', () => {
        const keys = Object.keys(QrCodeAdminListItemSchema.shape);
        expect(keys).toContain('tags');
        expect(keys).toContain('scanUrl');
        expect(keys).toContain('scanUtm');
    });

    it('a tag ref carries only what a badge needs', () => {
        expect(Object.keys(QrCodeTagRefSchema.shape).sort()).toStrictEqual([
            'color',
            'id',
            'name',
            'slug'
        ]);
    });
});
