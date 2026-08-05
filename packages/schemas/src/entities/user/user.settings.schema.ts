import { z } from 'zod';
import { stripShapeDefaults } from '../../utils/utils.js';

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
    newsletter: z.boolean().default(false).optional(),

    /**
     * Whether the user has opted in to search history recording (SPEC-289).
     * Defaults to `true` (recording enabled). Set to `false` to pause recording.
     * Stored additively in the existing `settings` JSONB column — no DB migration needed.
     */
    searchHistoryEnabled: z.boolean().default(true).optional(),

    /**
     * Whether the user's social networks may be shown on their public author
     * page (HOS-375 §6.7). Defaults to `false` — the opt-in is explicit,
     * because publishing someone's social handles is not something to infer
     * from the mere presence of the data. Networks already stored by users who
     * never asked for a public profile stay private until they say so.
     *
     * Stored additively in the existing `settings` JSONB column — no DB
     * migration needed, and a stored settings object without the key parses
     * fine (it reads as `false`).
     */
    publicProfileShowSocialNetworks: z.boolean().default(false).optional(),

    /**
     * Onboarding progress namespace. Shared by SPEC-174 (welcome tour) and
     * SPEC-175 (What's New). Added additively — no DB migration required.
     *
     * **CRITICAL**: Do NOT add `.default({})` to this field or any sub-object.
     * Adding a default causes Zod to rewrite the stored JSONB on every parse,
     * silently zeroing onboarding state for users whose column lacks the key.
     * A stored settings object WITHOUT `onboarding` must parse cleanly.
     */
    onboarding: z
        .object({
            /**
             * Welcome-tour step counters, keyed by tour id.
             * Each value is the last completed step index (non-negative integer).
             *
             * This key belongs to SPEC-174 (admin-welcome-tour) semantics.
             * It is defined here because both SPEC-174 and SPEC-175 share the
             * same `onboarding` JSONB namespace; each spec's dedicated PATCH
             * endpoint only touches its own sub-key and preserves the other.
             */
            adminTours: z.record(z.string(), z.number().int().nonnegative()).optional(),

            /**
             * What's New seen-state for the authenticated user (SPEC-175).
             *
             * - `baselineAt`: ISO datetime set on the user's first
             *   `GET /api/v1/protected/whats-new` hit (lazy init). Entries
             *   with `publishedAt <= baselineAt` are automatically treated as
             *   seen, preventing flooding pre-existing users on feature deploy.
             * - `seenIds`: set of entry ids explicitly marked seen by the user
             *   (via `PATCH /api/v1/protected/users/me/whats-new-seen`).
             */
            whatsNew: z
                .object({
                    /** ISO datetime of the user's first GET hit. Set by lazy-init logic. */
                    baselineAt: z.string().datetime().optional(),
                    /** Entry ids that the user has explicitly marked as seen. */
                    seenIds: z.array(z.string()).optional()
                })
                .optional()
        })
        .optional()
});

/**
 * The WRITE/PATCH shape of {@link UserSettingsSchema}: identical field-for-field,
 * except that every `.default()` has been removed (HOS-375).
 *
 * ## Why this exists — the merge alone was not enough
 *
 * `users.settings` is ONE JSONB column holding every preference namespace, and
 * `UserModel` opts it into shallow-merge semantics (`stored || patch`) so that a
 * partial patch does not wipe its siblings. That protection is real but it acts
 * at the very LAST layer, and by then the patch was no longer partial.
 *
 * `BaseCrudService.runWithLoggingAndValidation` re-parses the request body
 * through `UserService.updateSchema` (= `UserUpdateInputSchema`) and forwards
 * `validationResult.data` — the PARSED payload — to `model.update`. Zod EXPANDS
 * `.default()` at parse time, and `ZodObject.partial()` only makes the OUTER
 * `settings` key optional: it does not suppress the defaults declared on the
 * fields INSIDE it. So `{ settings: { publicProfileShowSocialNetworks: true } }`
 * reached the model as a fully-populated object also carrying
 * `themeWeb: 'system'`, `themeAdmin: 'system'`, `languageWeb: 'es'`,
 * `languageAdmin: 'es'`, `newsletter: false` and `searchHistoryEnabled: true`.
 * The merge then did exactly what it is supposed to do and wrote all seven keys.
 *
 * The two user-visible failures that closes:
 *
 * 1. A user opts into publishing their social links on their public author
 *    page, then later flips dark mode on `/mi-cuenta/preferencias` (which sends
 *    `{ settings: { themeWeb: 'dark' } }`). `publicProfileShowSocialNetworks`
 *    was re-defaulted to `false` and their social block silently disappeared
 *    from the public page. The admin account form had the same effect.
 * 2. Flipping the social toggle re-defaulted theme, language, newsletter and
 *    search-history — a dark-mode, `en`-locale, newsletter-subscribed user lost
 *    all of it in a single save.
 *
 * ## Why removing the defaults here is not a narrowing
 *
 * The package's additive-only compatibility policy
 * (`docs/guides/schema-compat-policy.md`) forbids TIGHTENING a published shape.
 * Dropping a `.default()` widens what parses: every input that used to be
 * accepted still is, and the only observable change is that an ABSENT key now
 * stays absent instead of materialising a value the caller never sent. That is
 * the documented "absent key = no change" contract of a PATCH shape — the same
 * reasoning, and the same `stripShapeDefaults` mechanism, that SPEC-217 applied
 * to the top level of all 32 `*UpdateInputSchema`s. This is the nested case
 * SPEC-217 did not reach, because `settings` itself never carried a default:
 * its FIELDS do, and `stripShapeDefaults` only walks one level.
 *
 * READ paths are untouched: {@link UserSettingsSchema} still carries every
 * default, so a stored row parsed on the way OUT still materialises them.
 * {@link UserCreateInputSchema} likewise still uses the defaulted schema, so a
 * newly created user gets a fully-populated `settings` object.
 *
 * ## Nesting
 *
 * `stripShapeDefaults` removes top-level `ZodDefault` wrappers (including ones
 * behind `.optional()` / `.nullable()`). Neither nested namespace —
 * `notifications` nor `onboarding` — declares a default today, and `onboarding`
 * is explicitly forbidden from ever gaining one (see its JSDoc above). A
 * recursive assertion in `test/entities/user/user.settings-patch.hos375.test.ts`
 * walks the whole tree and fails if ANY default reappears at any depth, so a
 * future nested default cannot silently reintroduce the bug.
 */
export const UserSettingsPatchSchema = z.object(stripShapeDefaults(UserSettingsSchema.shape));

/** Inferred type for {@link UserSettingsPatchSchema}. */
export type UserSettingsPatch = z.infer<typeof UserSettingsPatchSchema>;

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
        newsletter: z.boolean().optional(),
        /**
         * The author-page social opt-in (HOS-375 §6.7). It MUST be listed here:
         * this schema is `.strict()`, so a key it does not declare makes the web
         * PATCH fail with a 400 whose cause is not obvious from the UI.
         */
        publicProfileShowSocialNetworks: z.boolean().optional()
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

/**
 * The `onboarding.whatsNew` sub-object from {@link UserSettingsSchema}.
 *
 * Holds the What's New seen-state persisted in the user's `settings` JSONB
 * column. Both fields are optional — a value is only written by the lazy-init
 * logic on the user's first `GET /api/v1/protected/whats-new` request.
 *
 * @see SPEC-175 §6.1, §6.5
 */
export type UserOnboardingWhatsNew = NonNullable<
    NonNullable<UserSettings['onboarding']>['whatsNew']
>;

/**
 * The full `onboarding` sub-object from {@link UserSettingsSchema}.
 *
 * Aggregates all onboarding sub-keys:
 * - `adminTours` (SPEC-174): welcome-tour step counters.
 * - `whatsNew` (SPEC-175): What's New seen-state.
 *
 * @see SPEC-174, SPEC-175 §6.1
 */
export type UserOnboarding = NonNullable<UserSettings['onboarding']>;
