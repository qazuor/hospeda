/**
 * Unit tests for platform-settings Zod schemas (SPEC-156).
 *
 * Coverage:
 *   - Key enum: accepts the 3 supported keys, rejects others.
 *   - SeoDefaultsValueSchema: valid/invalid shapes + URL rule.
 *   - MaintenanceModeValueSchema: required `enabled`, optional `message`.
 *   - AnnouncementItemSchema: UUID id, tri-locale text, variant enum,
 *     optional ISO-8601 date window.
 *   - AnnouncementsValueSchema: array passthrough.
 *   - PlatformSettingsResponseSchema (discriminated union): branch routing per
 *     `key`, and that a value mismatched to its key is rejected.
 *
 * @module test/entities/platformSettings/platform-settings.schema.test
 */

import { describe, expect, it } from 'vitest';
import {
    AnnouncementItemSchema,
    AnnouncementsValueSchema,
    MaintenanceModeValueSchema,
    PlatformSettingsKeySchema,
    PlatformSettingsResponseSchema,
    SeoDefaultsValueSchema
} from '../../../src/entities/platformSettings/platform-settings.schema';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';
const VALID_ACTOR_UUID = '22222222-2222-4222-8222-222222222222';
const VALID_TIMESTAMP = '2026-05-28T12:34:56.000Z';

describe('PlatformSettingsKeySchema', () => {
    it('accepts each of the 3 supported keys', () => {
        for (const key of ['seo.defaults', 'maintenance.mode', 'announcements.global']) {
            expect(PlatformSettingsKeySchema.safeParse(key).success).toBe(true);
        }
    });

    it('rejects unknown keys', () => {
        const result = PlatformSettingsKeySchema.safeParse('seo.unknown');
        expect(result.success).toBe(false);
    });
});

describe('SeoDefaultsValueSchema', () => {
    const validSeo = {
        metaTitleTemplate: '%s | Hospeda',
        metaDescriptionDefault: 'Alojamientos en Concepción del Uruguay',
        ogImageDefault: 'https://hospeda.com.ar/og.png'
    };

    it('accepts a valid SEO defaults value', () => {
        expect(SeoDefaultsValueSchema.safeParse(validSeo).success).toBe(true);
    });

    it('rejects empty metaTitleTemplate', () => {
        const result = SeoDefaultsValueSchema.safeParse({ ...validSeo, metaTitleTemplate: '' });
        expect(result.success).toBe(false);
    });

    it('rejects non-URL ogImageDefault', () => {
        const result = SeoDefaultsValueSchema.safeParse({
            ...validSeo,
            ogImageDefault: 'not-a-url'
        });
        expect(result.success).toBe(false);
    });
});

describe('MaintenanceModeValueSchema', () => {
    it('accepts enabled-only (message omitted)', () => {
        expect(MaintenanceModeValueSchema.safeParse({ enabled: true }).success).toBe(true);
    });

    it('accepts enabled + optional message', () => {
        const result = MaintenanceModeValueSchema.safeParse({
            enabled: false,
            message: 'Volvemos en 1 hora'
        });
        expect(result.success).toBe(true);
    });

    it('rejects missing enabled flag', () => {
        const result = MaintenanceModeValueSchema.safeParse({ message: 'no enabled' });
        expect(result.success).toBe(false);
    });
});

describe('AnnouncementItemSchema', () => {
    const validAnnouncement = {
        id: VALID_UUID,
        text: {
            es: 'Hola',
            en: 'Hello',
            pt: 'Olá'
        },
        variant: 'info' as const,
        dismissible: true
    };

    it('accepts a minimal valid announcement (no date window)', () => {
        expect(AnnouncementItemSchema.safeParse(validAnnouncement).success).toBe(true);
    });

    it('accepts an announcement with start + end dates', () => {
        const result = AnnouncementItemSchema.safeParse({
            ...validAnnouncement,
            startsAt: VALID_TIMESTAMP,
            endsAt: '2026-06-01T00:00:00.000Z'
        });
        expect(result.success).toBe(true);
    });

    it('rejects a non-UUID id', () => {
        const result = AnnouncementItemSchema.safeParse({ ...validAnnouncement, id: 'not-uuid' });
        expect(result.success).toBe(false);
    });

    it('rejects missing locale text (e.g., no pt)', () => {
        const result = AnnouncementItemSchema.safeParse({
            ...validAnnouncement,
            text: { es: 'Hola', en: 'Hello' }
        });
        expect(result.success).toBe(false);
    });

    it('rejects an unknown variant', () => {
        const result = AnnouncementItemSchema.safeParse({
            ...validAnnouncement,
            variant: 'success'
        });
        expect(result.success).toBe(false);
    });

    it('rejects a non-ISO-8601 startsAt', () => {
        const result = AnnouncementItemSchema.safeParse({
            ...validAnnouncement,
            startsAt: '2026/05/28'
        });
        expect(result.success).toBe(false);
    });
});

describe('AnnouncementsValueSchema', () => {
    it('accepts an empty array', () => {
        expect(AnnouncementsValueSchema.safeParse([]).success).toBe(true);
    });

    it('accepts an array of valid items', () => {
        const result = AnnouncementsValueSchema.safeParse([
            {
                id: VALID_UUID,
                text: { es: 'a', en: 'a', pt: 'a' },
                variant: 'warning',
                dismissible: false
            }
        ]);
        expect(result.success).toBe(true);
    });

    it('rejects an array containing an invalid item', () => {
        const result = AnnouncementsValueSchema.safeParse([
            {
                id: 'bad-id',
                text: { es: '', en: 'a', pt: 'a' },
                variant: 'info',
                dismissible: true
            }
        ]);
        expect(result.success).toBe(false);
    });
});

describe('PlatformSettingsResponseSchema (discriminated union)', () => {
    const baseEnvelope = {
        updatedAt: VALID_TIMESTAMP,
        updatedBy: VALID_ACTOR_UUID
    };

    it('routes seo.defaults to the SEO branch', () => {
        const result = PlatformSettingsResponseSchema.safeParse({
            key: 'seo.defaults',
            value: {
                metaTitleTemplate: '%s | Hospeda',
                metaDescriptionDefault: 'desc',
                ogImageDefault: 'https://hospeda.com.ar/og.png'
            },
            ...baseEnvelope
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.key).toBe('seo.defaults');
        }
    });

    it('routes maintenance.mode to the maintenance branch', () => {
        const result = PlatformSettingsResponseSchema.safeParse({
            key: 'maintenance.mode',
            value: { enabled: true },
            ...baseEnvelope
        });
        expect(result.success).toBe(true);
        if (result.success && result.data.key === 'maintenance.mode') {
            expect(result.data.value.enabled).toBe(true);
        }
    });

    it('routes announcements.global to the announcements branch', () => {
        const result = PlatformSettingsResponseSchema.safeParse({
            key: 'announcements.global',
            value: [
                {
                    id: VALID_UUID,
                    text: { es: 'a', en: 'a', pt: 'a' },
                    variant: 'info',
                    dismissible: true
                }
            ],
            ...baseEnvelope
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.key).toBe('announcements.global');
            expect(Array.isArray(result.data.value)).toBe(true);
        }
    });

    it('rejects a key/value mismatch (seo.defaults shape under maintenance.mode key)', () => {
        const result = PlatformSettingsResponseSchema.safeParse({
            key: 'maintenance.mode',
            value: {
                metaTitleTemplate: '%s | Hospeda',
                metaDescriptionDefault: 'desc',
                ogImageDefault: 'https://hospeda.com.ar/og.png'
            },
            ...baseEnvelope
        });
        expect(result.success).toBe(false);
    });

    it('rejects an unknown key (discriminator failure)', () => {
        const result = PlatformSettingsResponseSchema.safeParse({
            key: 'unknown.key',
            value: { whatever: true },
            ...baseEnvelope
        });
        expect(result.success).toBe(false);
    });
});
