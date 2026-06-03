import { z } from 'zod';

/**
 * User Settings schema definition using Zod for validation.
 * Represents the settings and preferences for a user.
 *
 * ## Migration note (SPEC-096 / REQ-096-05)
 *
 * The original schema stored a single `darkMode` boolean and a single
 * `language` string for all surfaces. Web and Admin now need independent
 * control of theme and locale, so four new fields have been introduced:
 *
 * | New field      | Replaces           | Default    |
 * |----------------|--------------------|------------|
 * | `themeWeb`     | `darkMode`         | `'system'` |
 * | `themeAdmin`   | `darkMode`         | `'system'` |
 * | `languageWeb`  | `language`         | `'es'`     |
 * | `languageAdmin`| `language`         | `'es'`     |
 *
 * The legacy `darkMode` and `language` fields are kept **optional** so that
 * existing stored JSONB objects continue to parse without errors. They will be
 * removed in a follow-up after a DB backfill migration copies their values
 * into the four new fields (`darkMode → themeWeb + themeAdmin`,
 * `language → languageWeb + languageAdmin`).
 *
 * Web-scoped PATCH endpoints should only accept `themeWeb`, `languageWeb`,
 * `notifications`, and `newsletter`. Admin-scoped endpoints may update any
 * of the four theme/language fields.
 */

export const UserNotificationsSchema = z.object({
    enabled: z.boolean({ message: 'zodError.user.settings.notifications.enabled.required' }),
    allowEmails: z.boolean({
        message: 'zodError.user.settings.notifications.allowEmails.required'
    }),
    allowSms: z.boolean({
        message: 'zodError.user.settings.notifications.allowSms.required'
    }),
    allowPush: z.boolean({
        message: 'zodError.user.settings.notifications.allowPush.required'
    })
});

/**
 * Allowed theme values for the web and admin surfaces.
 * `'system'` follows the OS/browser preference.
 */
export const ThemeEnumSchema = z.enum(['system', 'light', 'dark']);

/** Inferred type for {@link ThemeEnumSchema}. */
export type ThemeEnum = z.infer<typeof ThemeEnumSchema>;

/**
 * Allowed locale values across the platform.
 * Matches the supported locales defined in `@repo/i18n`.
 */
export const LanguageEnumSchema = z.enum(['es', 'en', 'pt']);

/** Inferred type for {@link LanguageEnumSchema}. */
export type LanguageEnum = z.infer<typeof LanguageEnumSchema>;

export const UserSettingsSchema = z.object({
    // -------------------------------------------------------------------------
    // LEGACY FIELDS — kept optional for backward compatibility during migration
    // TODO: Remove after DB backfill (SPEC-096 follow-up).
    // -------------------------------------------------------------------------

    /** @deprecated Use `themeWeb` and `themeAdmin` instead. */
    darkMode: z.boolean().optional(),

    /** @deprecated Use `languageWeb` and `languageAdmin` instead. */
    language: z
        .string()
        .min(2, { message: 'zodError.user.settings.language.min' })
        .max(10, { message: 'zodError.user.settings.language.max' })
        .optional(),

    // -------------------------------------------------------------------------
    // NEW PER-SURFACE FIELDS (SPEC-096 / REQ-096-05)
    // -------------------------------------------------------------------------

    /**
     * Theme preference for the web (public) surface.
     * Defaults to `'system'` (follows OS/browser preference).
     */
    themeWeb: ThemeEnumSchema.default('system').optional(),

    /**
     * Theme preference for the admin surface.
     * Defaults to `'system'` (follows OS/browser preference).
     */
    themeAdmin: ThemeEnumSchema.default('system').optional(),

    /**
     * Locale for the web (public) surface.
     * Defaults to `'es'` (Argentina market default).
     */
    languageWeb: LanguageEnumSchema.default('es').optional(),

    /**
     * Locale for the admin surface.
     * Defaults to `'es'` (Argentina market default).
     */
    languageAdmin: LanguageEnumSchema.default('es').optional(),

    /** Notification channel preferences. Optional so that legacy stored JSONB without this key still parses (BETA-36). */
    notifications: UserNotificationsSchema.optional(),

    /**
     * Whether the user has opted in to the marketing newsletter.
     * Defaults to `false`.
     */
    newsletter: z.boolean().default(false).optional()
});

/**
 * Web-scoped subset of {@link UserSettingsSchema} that protected (non-admin)
 * endpoints accept on PATCH requests. Only these four keys may be written:
 *
 *   - `themeWeb`
 *   - `languageWeb`
 *   - `notifications`
 *   - `newsletter`
 *
 * Strict mode (`.strict()`) means any unknown key — including the admin-only
 * `themeAdmin` / `languageAdmin` fields, or arbitrary garbage — causes a
 * validation error that the route layer translates into HTTP 400.
 *
 * SPEC-096 / REQ-096-05 (T-032).
 */
export const UserSettingsWebPatchSchema = z
    .object({
        themeWeb: ThemeEnumSchema.optional(),
        languageWeb: LanguageEnumSchema.optional(),
        notifications: UserNotificationsSchema.optional(),
        newsletter: z.boolean().optional()
    })
    .strict();

/**
 * Admin-scoped subset of {@link UserSettingsSchema} for PATCH requests via the
 * admin API. Allows all four theme/language fields plus the shared keys.
 *
 * SPEC-096 / REQ-096-05 (T-032).
 */
export const UserSettingsAdminPatchSchema = z
    .object({
        themeWeb: ThemeEnumSchema.optional(),
        themeAdmin: ThemeEnumSchema.optional(),
        languageWeb: LanguageEnumSchema.optional(),
        languageAdmin: LanguageEnumSchema.optional(),
        notifications: UserNotificationsSchema.optional(),
        newsletter: z.boolean().optional()
    })
    .strict();

/**
 * Type exports for User Settings
 */
export type UserNotifications = z.infer<typeof UserNotificationsSchema>;
export type UserSettings = z.infer<typeof UserSettingsSchema>;
export type UserSettingsWebPatch = z.infer<typeof UserSettingsWebPatchSchema>;
export type UserSettingsAdminPatch = z.infer<typeof UserSettingsAdminPatchSchema>;
