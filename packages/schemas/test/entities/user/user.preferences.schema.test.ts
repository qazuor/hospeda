import { describe, expect, it } from 'vitest';
import {
    LanguageEnumSchema,
    ThemeEnumSchema,
    UserSettingsSchema
} from '../../../src/entities/user/user.settings.schema.js';

// ---------------------------------------------------------------------------
// Valid base for the required `notifications` object
// ---------------------------------------------------------------------------

const VALID_NOTIFICATIONS = {
    enabled: true,
    allowEmails: true,
    allowSms: false,
    allowPush: true
};

const VALID_BASE = { notifications: VALID_NOTIFICATIONS };

// ---------------------------------------------------------------------------
// ThemeEnumSchema
// ---------------------------------------------------------------------------

describe('ThemeEnumSchema', () => {
    it('should accept "system"', () => {
        expect(ThemeEnumSchema.safeParse('system').success).toBe(true);
    });

    it('should accept "light"', () => {
        expect(ThemeEnumSchema.safeParse('light').success).toBe(true);
    });

    it('should accept "dark"', () => {
        expect(ThemeEnumSchema.safeParse('dark').success).toBe(true);
    });

    it('should reject an unknown value', () => {
        expect(ThemeEnumSchema.safeParse('auto').success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// LanguageEnumSchema
// ---------------------------------------------------------------------------

describe('LanguageEnumSchema', () => {
    it('should accept "es"', () => {
        expect(LanguageEnumSchema.safeParse('es').success).toBe(true);
    });

    it('should accept "en"', () => {
        expect(LanguageEnumSchema.safeParse('en').success).toBe(true);
    });

    it('should accept "pt"', () => {
        expect(LanguageEnumSchema.safeParse('pt').success).toBe(true);
    });

    it('should reject an unknown locale', () => {
        expect(LanguageEnumSchema.safeParse('fr').success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// UserSettingsSchema — new per-surface fields
// ---------------------------------------------------------------------------

describe('UserSettingsSchema — new per-surface fields (SPEC-096)', () => {
    describe('themeWeb', () => {
        it('should accept valid theme values', () => {
            for (const value of ['system', 'light', 'dark']) {
                const result = UserSettingsSchema.safeParse({ ...VALID_BASE, themeWeb: value });
                expect(result.success, `themeWeb: ${value}`).toBe(true);
            }
        });

        it('should default themeWeb to "system" when omitted', () => {
            const result = UserSettingsSchema.safeParse(VALID_BASE);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.themeWeb).toBe('system');
            }
        });

        it('should reject an invalid themeWeb value', () => {
            const result = UserSettingsSchema.safeParse({ ...VALID_BASE, themeWeb: 'auto' });
            expect(result.success).toBe(false);
        });
    });

    describe('themeAdmin', () => {
        it('should accept valid theme values', () => {
            for (const value of ['system', 'light', 'dark']) {
                const result = UserSettingsSchema.safeParse({ ...VALID_BASE, themeAdmin: value });
                expect(result.success, `themeAdmin: ${value}`).toBe(true);
            }
        });

        it('should default themeAdmin to "system" when omitted', () => {
            const result = UserSettingsSchema.safeParse(VALID_BASE);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.themeAdmin).toBe('system');
            }
        });

        it('should reject an invalid themeAdmin value', () => {
            const result = UserSettingsSchema.safeParse({ ...VALID_BASE, themeAdmin: 'random' });
            expect(result.success).toBe(false);
        });
    });

    describe('languageWeb', () => {
        it('should accept valid language values', () => {
            for (const value of ['es', 'en', 'pt']) {
                const result = UserSettingsSchema.safeParse({ ...VALID_BASE, languageWeb: value });
                expect(result.success, `languageWeb: ${value}`).toBe(true);
            }
        });

        it('should default languageWeb to "es" when omitted', () => {
            const result = UserSettingsSchema.safeParse(VALID_BASE);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.languageWeb).toBe('es');
            }
        });

        it('should reject an unknown languageWeb value', () => {
            const result = UserSettingsSchema.safeParse({ ...VALID_BASE, languageWeb: 'fr' });
            expect(result.success).toBe(false);
        });
    });

    describe('languageAdmin', () => {
        it('should accept valid language values', () => {
            for (const value of ['es', 'en', 'pt']) {
                const result = UserSettingsSchema.safeParse({
                    ...VALID_BASE,
                    languageAdmin: value
                });
                expect(result.success, `languageAdmin: ${value}`).toBe(true);
            }
        });

        it('should default languageAdmin to "es" when omitted', () => {
            const result = UserSettingsSchema.safeParse(VALID_BASE);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.languageAdmin).toBe('es');
            }
        });

        it('should reject an unknown languageAdmin value', () => {
            const result = UserSettingsSchema.safeParse({ ...VALID_BASE, languageAdmin: 'de' });
            expect(result.success).toBe(false);
        });
    });

    describe('newsletter', () => {
        it('should default newsletter to false when omitted', () => {
            const result = UserSettingsSchema.safeParse(VALID_BASE);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.newsletter).toBe(false);
            }
        });

        it('should accept newsletter: true', () => {
            const result = UserSettingsSchema.safeParse({ ...VALID_BASE, newsletter: true });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.newsletter).toBe(true);
            }
        });

        it('should accept newsletter: false', () => {
            const result = UserSettingsSchema.safeParse({ ...VALID_BASE, newsletter: false });
            expect(result.success).toBe(true);
        });

        it('should reject a non-boolean newsletter', () => {
            const result = UserSettingsSchema.safeParse({ ...VALID_BASE, newsletter: 'yes' });
            expect(result.success).toBe(false);
        });
    });

    describe('full new-fields payload', () => {
        it('should accept all four new fields set explicitly', () => {
            // Arrange
            const input = {
                ...VALID_BASE,
                themeWeb: 'dark',
                themeAdmin: 'light',
                languageWeb: 'en',
                languageAdmin: 'pt',
                newsletter: true
            };

            // Act
            const result = UserSettingsSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.themeWeb).toBe('dark');
                expect(result.data.themeAdmin).toBe('light');
                expect(result.data.languageWeb).toBe('en');
                expect(result.data.languageAdmin).toBe('pt');
                expect(result.data.newsletter).toBe(true);
            }
        });
    });
});

// ---------------------------------------------------------------------------
// UserSettingsSchema — legacy fields preserved
// ---------------------------------------------------------------------------

describe('UserSettingsSchema — legacy fields (backward compat)', () => {
    it('should accept the legacy darkMode boolean', () => {
        const result = UserSettingsSchema.safeParse({ ...VALID_BASE, darkMode: true });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.darkMode).toBe(true);
        }
    });

    it('should accept the legacy language string', () => {
        const result = UserSettingsSchema.safeParse({ ...VALID_BASE, language: 'es' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.language).toBe('es');
        }
    });

    it('should accept both legacy and new fields simultaneously (migration period)', () => {
        const input = {
            ...VALID_BASE,
            darkMode: false,
            language: 'en',
            themeWeb: 'light',
            themeAdmin: 'dark',
            languageWeb: 'en',
            languageAdmin: 'es'
        };
        const result = UserSettingsSchema.safeParse(input);
        expect(result.success).toBe(true);
    });

    it('should allow legacy fields to be absent (they are optional)', () => {
        // Schema without darkMode or language — should still pass
        const result = UserSettingsSchema.safeParse(VALID_BASE);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.darkMode).toBeUndefined();
            expect(result.data.language).toBeUndefined();
        }
    });

    it('should reject legacy language exceeding 10 chars', () => {
        const result = UserSettingsSchema.safeParse({
            ...VALID_BASE,
            language: 'en-US-longvalue'
        });
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// UserSettingsSchema — notifications (BETA-36: now optional)
// ---------------------------------------------------------------------------

describe('UserSettingsSchema — notifications', () => {
    it('should accept an empty object — notifications is now optional (BETA-36)', () => {
        // Before BETA-36 this returned false because notifications was required.
        // After the fix, an empty settings object is valid (legacy JSONB rows
        // without a notifications key must parse successfully).
        const result = UserSettingsSchema.safeParse({});
        expect(result.success).toBe(true);
    });

    it('should reject notifications with missing fields when the key IS present', () => {
        const result = UserSettingsSchema.safeParse({
            notifications: { enabled: true }
        });
        expect(result.success).toBe(false);
    });

    it('should accept a full notifications object', () => {
        const result = UserSettingsSchema.safeParse(VALID_BASE);
        expect(result.success).toBe(true);
    });
});
