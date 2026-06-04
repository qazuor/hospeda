/**
 * Tests for the `onboarding` namespace added to `UserSettingsSchema` (SPEC-175 T-002).
 *
 * Verifies:
 * - Historic stored-JSONB fixtures WITHOUT `onboarding` still parse cleanly
 *   (no regression — additive-only change).
 * - Full new `onboarding.whatsNew` shape parses.
 * - Partial `whatsNew` shapes (only `baselineAt`, only `seenIds`) parse.
 * - Invalid `adminTours` values (negative step count) are rejected.
 * - No `.default({})` silently injected: missing `onboarding` stays `undefined`.
 */
import { describe, expect, it } from 'vitest';
import { UserSettingsSchema } from '../../../src/entities/user/user.settings.schema.js';

// ---------------------------------------------------------------------------
// Historic fixture — a stored JSONB shape predating SPEC-175 (and SPEC-174).
// This object must parse cleanly after the additive change.
// ---------------------------------------------------------------------------

const HISTORIC_SETTINGS_PRE_SPEC175 = {
    themeWeb: 'system' as const,
    themeAdmin: 'dark' as const,
    languageWeb: 'es' as const,
    languageAdmin: 'es' as const,
    newsletter: false,
    notifications: {
        enabled: true,
        allowEmails: true,
        allowSms: false,
        allowPush: true
    }
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UserSettingsSchema — onboarding namespace (SPEC-175 T-002)', () => {
    describe('backward compatibility', () => {
        it('should parse a historic stored JSONB without the onboarding key (no regression)', () => {
            // Arrange — simulates a user row stored before SPEC-175 shipped
            const input = { ...HISTORIC_SETTINGS_PRE_SPEC175 };

            // Act
            const result = UserSettingsSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.onboarding).toBeUndefined();
            }
        });

        it('should parse a completely empty object (all fields optional)', () => {
            // Act
            const result = UserSettingsSchema.safeParse({});

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.onboarding).toBeUndefined();
            }
        });

        it('should not inject a default onboarding object when the key is absent', () => {
            // Arrange — critical: no `.default({})` anywhere in the onboarding subtree
            const input = { newsletter: false };

            // Act
            const result = UserSettingsSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                // If a default were present, this would be {} instead of undefined
                expect(result.data.onboarding).toBeUndefined();
            }
        });
    });

    describe('full new onboarding shape', () => {
        it('should parse a complete onboarding.whatsNew object', () => {
            // Arrange
            const input = {
                ...HISTORIC_SETTINGS_PRE_SPEC175,
                onboarding: {
                    adminTours: { 'host.welcome': 2 },
                    whatsNew: {
                        baselineAt: '2026-05-29T00:00:00Z',
                        seenIds: ['entry-001', 'entry-002']
                    }
                }
            };

            // Act
            const result = UserSettingsSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.onboarding?.whatsNew?.baselineAt).toBe('2026-05-29T00:00:00Z');
                expect(result.data.onboarding?.whatsNew?.seenIds).toEqual([
                    'entry-001',
                    'entry-002'
                ]);
                expect(result.data.onboarding?.adminTours?.['host.welcome']).toBe(2);
            }
        });

        it('should parse onboarding with only adminTours (no whatsNew)', () => {
            // Arrange — SPEC-174 state written before SPEC-175 lazy-init fires
            const input = {
                onboarding: {
                    adminTours: { 'host.welcome': 3 }
                }
            };

            // Act
            const result = UserSettingsSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.onboarding?.adminTours?.['host.welcome']).toBe(3);
                expect(result.data.onboarding?.whatsNew).toBeUndefined();
            }
        });

        it('should parse onboarding with only whatsNew (no adminTours)', () => {
            // Arrange — SPEC-175 state written before SPEC-174 ships
            const input = {
                onboarding: {
                    whatsNew: {
                        baselineAt: '2026-06-01T10:00:00Z',
                        seenIds: []
                    }
                }
            };

            // Act
            const result = UserSettingsSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.onboarding?.adminTours).toBeUndefined();
                expect(result.data.onboarding?.whatsNew?.seenIds).toEqual([]);
            }
        });
    });

    describe('partial whatsNew shapes', () => {
        it('should parse whatsNew with only baselineAt (no seenIds)', () => {
            // Arrange
            const input = {
                onboarding: {
                    whatsNew: {
                        baselineAt: '2026-06-03T12:00:00Z'
                    }
                }
            };

            // Act
            const result = UserSettingsSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.onboarding?.whatsNew?.baselineAt).toBe('2026-06-03T12:00:00Z');
                expect(result.data.onboarding?.whatsNew?.seenIds).toBeUndefined();
            }
        });

        it('should parse whatsNew with only seenIds (no baselineAt)', () => {
            // Arrange
            const input = {
                onboarding: {
                    whatsNew: {
                        seenIds: ['2026-05-29-cron-history']
                    }
                }
            };

            // Act
            const result = UserSettingsSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.onboarding?.whatsNew?.seenIds).toEqual([
                    '2026-05-29-cron-history'
                ]);
                expect(result.data.onboarding?.whatsNew?.baselineAt).toBeUndefined();
            }
        });

        it('should parse an empty whatsNew object', () => {
            // Arrange
            const input = { onboarding: { whatsNew: {} } };

            // Act
            const result = UserSettingsSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });
    });

    describe('invalid adminTours values', () => {
        it('should reject a negative step count in adminTours', () => {
            // Arrange — step index must be non-negative
            const input = {
                onboarding: {
                    adminTours: { 'host.welcome': -1 }
                }
            };

            // Act
            const result = UserSettingsSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject a non-integer step count in adminTours', () => {
            // Arrange
            const input = {
                onboarding: {
                    adminTours: { 'host.welcome': 1.5 }
                }
            };

            // Act
            const result = UserSettingsSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject a string value for an adminTours step', () => {
            // Arrange
            const input = {
                onboarding: {
                    adminTours: { 'host.welcome': 'done' }
                }
            };

            // Act
            const result = UserSettingsSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });
});
