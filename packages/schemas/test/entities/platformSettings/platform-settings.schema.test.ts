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
    AddonPurchasesFreezeValueSchema,
    AnnouncementItemSchema,
    AnnouncementsValueSchema,
    MaintenanceModeValueSchema,
    PaidSignupsFreezeValueSchema,
    PlatformSettingsKeySchema,
    PlatformSettingsResponseSchema,
    ProviderWatchAuthorizationInputSchema,
    ProviderWatchAuthorizationValueSchema,
    PublicSessionRecordingResponseSchema,
    SeoDefaultsValueSchema,
    SessionRecordingPatchSchema,
    SessionRecordingPurgeRequestSchema,
    SessionRecordingPurgeResponseSchema,
    SessionRecordingRetentionDaysSchema,
    SessionRecordingValueSchema
} from '../../../src/entities/platformSettings/platform-settings.schema';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';
const VALID_ACTOR_UUID = '22222222-2222-4222-8222-222222222222';
const VALID_TIMESTAMP = '2026-05-28T12:34:56.000Z';

describe('PlatformSettingsKeySchema', () => {
    it('accepts each of the 7 supported keys', () => {
        for (const key of [
            'seo.defaults',
            'maintenance.mode',
            'announcements.global',
            'billing.paidSignupsFreeze',
            'billing.addonPurchasesFreeze',
            'billing.providerWatchAuthorization',
            'analytics.sessionRecording'
        ]) {
            expect(PlatformSettingsKeySchema.safeParse(key).success).toBe(true);
        }
    });

    it('rejects unknown keys', () => {
        const result = PlatformSettingsKeySchema.safeParse('seo.unknown');
        expect(result.success).toBe(false);
    });
});

describe('HOS-2347 SessionRecordingValueSchema', () => {
    it('accepts a boolean enabled value', () => {
        expect(SessionRecordingValueSchema.safeParse({ enabled: true }).success).toBe(true);
        expect(SessionRecordingValueSchema.safeParse({ enabled: false }).success).toBe(true);
    });

    it('AC-A6: rejects a non-boolean enabled value', () => {
        // Arrange
        const value = { enabled: 'yes' };

        // Act
        const result = SessionRecordingValueSchema.safeParse(value);

        // Assert
        expect(result.success).toBe(false);
    });

    it('routes the analytics.sessionRecording branch of the response union', () => {
        const result = PlatformSettingsResponseSchema.safeParse({
            key: 'analytics.sessionRecording',
            value: { enabled: true },
            updatedAt: VALID_TIMESTAMP,
            updatedBy: VALID_ACTOR_UUID
        });
        expect(result.success).toBe(true);
    });
});

describe('HOS-2347 retention period', () => {
    it.each([14, 30, 60])('accepts %i days', (days) => {
        expect(SessionRecordingRetentionDaysSchema.safeParse(days).success).toBe(true);
    });

    it.each([0, 7, 15, 90, -30, 30.5, '30', null])('rejects %s', (days) => {
        expect(SessionRecordingRetentionDaysSchema.safeParse(days).success).toBe(false);
    });

    it('defaults to 30 when a stored row predates the field', () => {
        // Arrange
        const legacyRow = { enabled: true };

        // Act
        const result = SessionRecordingValueSchema.parse(legacyRow);

        // Assert
        expect(result).toEqual({ enabled: true, retentionDays: 30 });
    });

    it('keeps an explicit period and rejects a value outside the enum', () => {
        expect(SessionRecordingValueSchema.parse({ enabled: false, retentionDays: 14 })).toEqual({
            enabled: false,
            retentionDays: 14
        });
        expect(
            SessionRecordingValueSchema.safeParse({ enabled: true, retentionDays: 45 }).success
        ).toBe(false);
    });

    it('the purge response carries the counts, the period used and stoppedEarly', () => {
        const valid = {
            replaysDeleted: 3,
            heatmapEventsDeleted: 0,
            savedReplaysDeleted: 1,
            retentionDays: 30,
            stoppedEarly: false
        };
        expect(SessionRecordingPurgeResponseSchema.safeParse(valid).success).toBe(true);
        expect(
            SessionRecordingPurgeResponseSchema.safeParse({ ...valid, replaysDeleted: -1 }).success
        ).toBe(false);
        expect(
            SessionRecordingPurgeResponseSchema.safeParse({ ...valid, stoppedEarly: undefined })
                .success
        ).toBe(false);
    });

    it('the purge request is strictly { retentionDays: 14 | 30 | 60 }', () => {
        expect(SessionRecordingPurgeRequestSchema.safeParse({ retentionDays: 14 }).success).toBe(
            true
        );
        expect(SessionRecordingPurgeRequestSchema.safeParse({ retentionDays: 45 }).success).toBe(
            false
        );
        expect(SessionRecordingPurgeRequestSchema.safeParse({}).success).toBe(false);
        expect(
            SessionRecordingPurgeRequestSchema.safeParse({ retentionDays: 30, x: 1 }).success
        ).toBe(false);
    });

    it('the patch accepts either field alone, and refuses none or a bad period', () => {
        expect(SessionRecordingPatchSchema.safeParse({ enabled: true }).success).toBe(true);
        expect(SessionRecordingPatchSchema.safeParse({ retentionDays: 60 }).success).toBe(true);
        expect(SessionRecordingPatchSchema.safeParse({}).success).toBe(false);
        expect(SessionRecordingPatchSchema.safeParse({ retentionDays: 7 }).success).toBe(false);
    });
});

describe('HOS-2347 PublicSessionRecordingResponseSchema', () => {
    it('accepts exactly { enabled }', () => {
        expect(PublicSessionRecordingResponseSchema.safeParse({ enabled: false }).success).toBe(
            true
        );
    });

    it('AC-P2: rejects any extra key (no updatedAt/updatedBy leak)', () => {
        const result = PublicSessionRecordingResponseSchema.safeParse({
            enabled: true,
            updatedBy: VALID_ACTOR_UUID
        });
        expect(result.success).toBe(false);
    });
});

describe('HOS-1749 AddonPurchasesFreezeValueSchema', () => {
    it('accepts a boolean frozen value', () => {
        expect(AddonPurchasesFreezeValueSchema.safeParse({ frozen: true }).success).toBe(true);
    });
});

describe('HOS-1749 PaidSignupsFreezeValueSchema', () => {
    it('accepts a boolean frozen value', () => {
        // Arrange
        const value = { frozen: true };

        // Act
        const result = PaidSignupsFreezeValueSchema.safeParse(value);

        // Assert
        expect(result.success).toBe(true);
    });

    it('accepts an explicitly open setting', () => {
        // Arrange
        const value = { frozen: false };

        // Act
        const result = PaidSignupsFreezeValueSchema.safeParse(value);

        // Assert
        expect(result.success).toBe(true);
    });

    it('rejects a missing frozen field', () => {
        // Arrange
        const value = {};

        // Act
        const result = PaidSignupsFreezeValueSchema.safeParse(value);

        // Assert
        expect(result.success).toBe(false);
    });

    it("rejects 'yes' instead of coercing it to a boolean", () => {
        // Arrange
        const value = { frozen: 'yes' };

        // Act
        const result = PaidSignupsFreezeValueSchema.safeParse(value);

        // Assert
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

    describe('indexNowEnabled (HOS-585 / AC-13)', () => {
        /**
         * The load-bearing one. Every `seo.defaults` row written before this
         * field existed lacks it, and the admin page calls `safeParse` on the
         * stored value before rendering. A required boolean would fail all of
         * them and take the page down. Asserting the resulting VALUE — not just
         * `.success` — is what makes this test able to fail: a schema that
         * dropped the field entirely would still parse, but would not produce
         * `false`.
         */
        it('parses a row stored before the field existed, defaulting to false', () => {
            const result = SeoDefaultsValueSchema.safeParse(validSeo);

            expect(result.success).toBe(true);
            expect(result.success && result.data.indexNowEnabled).toBe(false);
        });

        it('preserves an explicit true', () => {
            const result = SeoDefaultsValueSchema.safeParse({
                ...validSeo,
                indexNowEnabled: true
            });

            expect(result.success && result.data.indexNowEnabled).toBe(true);
        });

        it('preserves an explicit false', () => {
            const result = SeoDefaultsValueSchema.safeParse({
                ...validSeo,
                indexNowEnabled: false
            });

            expect(result.success && result.data.indexNowEnabled).toBe(false);
        });

        it('rejects a non-boolean', () => {
            const result = SeoDefaultsValueSchema.safeParse({
                ...validSeo,
                indexNowEnabled: 'true'
            });

            expect(result.success).toBe(false);
        });
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

    it('routes billing.paidSignupsFreeze to the freeze branch', () => {
        // Arrange
        const value = { frozen: true };

        // Act
        const result = PlatformSettingsResponseSchema.safeParse({
            key: 'billing.paidSignupsFreeze',
            value,
            ...baseEnvelope
        });

        // Assert
        expect(result.success).toBe(true);
        if (result.success && result.data.key === 'billing.paidSignupsFreeze') {
            expect(result.data.value.frozen).toBe(true);
        }
    });

    it('rejects a maintenance value under billing.paidSignupsFreeze', () => {
        // Arrange
        const value = { enabled: true };

        // Act
        const result = PlatformSettingsResponseSchema.safeParse({
            key: 'billing.paidSignupsFreeze',
            value,
            ...baseEnvelope
        });

        // Assert
        expect(result.success).toBe(false);
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

describe('HOS-1512 ProviderWatchAuthorizationValueSchema', () => {
    it('accepts a month and an integer maximum charge in minor units', () => {
        const result = ProviderWatchAuthorizationValueSchema.safeParse({
            month: '2026-11',
            maxChargeMinor: 150000
        });
        expect(result.success).toBe(true);
    });

    it.each([
        '2026-13',
        '2026-00',
        '2026-1',
        '26-11',
        '2026/11',
        '2026-11-01',
        ''
    ])('rejects the month %j', (month) => {
        expect(
            ProviderWatchAuthorizationValueSchema.safeParse({ month, maxChargeMinor: 100 }).success
        ).toBe(false);
    });

    it('accepts a maximum charge of 0: the authorization of a read-only battery', () => {
        expect(
            ProviderWatchAuthorizationValueSchema.safeParse({ month: '2026-11', maxChargeMinor: 0 })
                .success
        ).toBe(true);
    });

    it.each([-1, 1.5, Number.NaN, '100'])('rejects the maximum charge %j', (maxChargeMinor) => {
        expect(
            ProviderWatchAuthorizationValueSchema.safeParse({ month: '2026-11', maxChargeMinor })
                .success
        ).toBe(false);
    });

    it('is a member of the discriminated response union', () => {
        const result = PlatformSettingsResponseSchema.safeParse({
            key: 'billing.providerWatchAuthorization',
            value: { month: '2026-11', maxChargeMinor: 150000 },
            updatedAt: VALID_TIMESTAMP,
            updatedBy: VALID_ACTOR_UUID
        });
        expect(result.success).toBe(true);
    });

    it('rejects the value of another key under this key', () => {
        const result = PlatformSettingsResponseSchema.safeParse({
            key: 'billing.providerWatchAuthorization',
            value: { frozen: true },
            updatedAt: VALID_TIMESTAMP,
            updatedBy: VALID_ACTOR_UUID
        });
        expect(result.success).toBe(false);
    });
});

describe('HOS-1512 provider watch authorization input and consumption', () => {
    const input = { month: '2026-11', maxChargeMinor: 150000, accountId: '100000001' };

    it('accepts the input with a numeric account id and an optional nickname', () => {
        expect(ProviderWatchAuthorizationInputSchema.safeParse(input).success).toBe(true);
        expect(
            ProviderWatchAuthorizationInputSchema.safeParse({
                ...input,
                accountNickname: 'HOSPEDA'
            }).success
        ).toBe(true);
    });

    it.each([
        '',
        'abc',
        '12 34',
        '-5',
        '1'.repeat(21)
    ])('rejects the account id %j', (accountId) => {
        expect(
            ProviderWatchAuthorizationInputSchema.safeParse({ ...input, accountId }).success
        ).toBe(false);
    });

    it('requires the account id in the input', () => {
        const { accountId: _omitted, ...withoutId } = input;
        expect(ProviderWatchAuthorizationInputSchema.safeParse(withoutId).success).toBe(false);
    });

    it('strips the consumption fields from the input: a new authorization is never consumed', () => {
        const parsed = ProviderWatchAuthorizationInputSchema.parse({
            ...input,
            consumedAt: '2026-11-01T00:00:00.000Z',
            consumedByRunId: VALID_UUID
        });
        expect(parsed).not.toHaveProperty('consumedAt');
        expect(parsed).not.toHaveProperty('consumedByRunId');
    });

    it('lets the stored value carry the consumption and tolerates a missing account id', () => {
        expect(
            ProviderWatchAuthorizationValueSchema.safeParse({
                ...input,
                consumedAt: '2026-11-01T00:00:00.000Z',
                consumedByRunId: VALID_UUID
            }).success
        ).toBe(true);
        expect(
            ProviderWatchAuthorizationValueSchema.safeParse({ month: '2026-11', maxChargeMinor: 1 })
                .success
        ).toBe(true);
    });
});
