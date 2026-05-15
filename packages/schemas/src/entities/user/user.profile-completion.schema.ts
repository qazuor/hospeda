/**
 * Schemas for the profile completion flow (SPEC-113).
 *
 * These schemas are used exclusively by the three POST endpoints
 * under /api/v1/protected/profile/*.  They live here (in @repo/schemas)
 * as the single source of truth so that both the API route layer and
 * the web front-end can import them without duplication.
 */

import { z } from 'zod';
import { InternationalPhoneRegex } from '../../utils/utils.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Supported locales across the platform. */
const SUPPORTED_LOCALES = ['es', 'en', 'pt'] as const;

/**
 * Minimum password length enforced by the auth config
 * (`emailAndPassword` in apps/api/src/lib/auth.ts).
 * Keep this value in sync with Better Auth's own minPasswordLength.
 */
export const PROFILE_COMPLETION_MIN_PASSWORD_LENGTH = 8;

// ---------------------------------------------------------------------------
// POST /api/v1/protected/profile/complete
// ---------------------------------------------------------------------------

/**
 * Request body for the profile-completion endpoint.
 *
 * Collects the minimum baseline profile data required for the rest of the
 * UI to have something to render.  Only `displayName` and `acceptedTerms`
 * are required; everything else is optional so the frontend can use a
 * progressive form.
 */
export const CompleteProfileBodySchema = z
    .object({
        /**
         * Full display name (persisted to users.display_name).
         * Better Auth maps its virtual `name` field to this column.
         */
        displayName: z
            .string({ message: 'zodError.user.displayName.required' })
            .min(2, { message: 'zodError.user.displayName.min' })
            .max(50, { message: 'zodError.user.displayName.max' }),

        /**
         * Casual "how do we call you" name.
         * Persisted to users.first_name.  When absent, defaults to the first
         * word of displayName.
         */
        firstName: z
            .string({ message: 'zodError.user.firstName.required' })
            .min(2, { message: 'zodError.user.firstName.min' })
            .max(50, { message: 'zodError.user.firstName.max' })
            .optional(),

        /**
         * Mobile phone number.
         * Must follow E.164-compatible format (enforced by InternationalPhoneRegex).
         * Persisted into users.contact_info.mobilePhone JSONB path.
         */
        phone: z
            .string()
            .regex(InternationalPhoneRegex, {
                message: 'zodError.common.contact.mobilePhone.international'
            })
            .optional(),

        /**
         * Preferred locale for the web surface.
         * Persisted to users.settings.languageWeb JSONB path.
         */
        locale: z.enum(SUPPORTED_LOCALES).optional(),

        /**
         * Whether the user opted into the marketing newsletter.
         * When true, the endpoint delegates to NewsletterSubscriberService.
         */
        newsletterOptIn: z.boolean().optional(),

        /**
         * Must be TRUE.  Guards against callers that submit the form without
         * the checkbox being checked.
         */
        acceptedTerms: z.literal(true, { message: 'zodError.user.acceptedTerms.required' })
    })
    .strict();

/** Inferred TypeScript type for {@link CompleteProfileBodySchema}. */
export type CompleteProfileBody = z.infer<typeof CompleteProfileBodySchema>;

/**
 * Response returned by POST /api/v1/protected/profile/complete.
 *
 * `requiresSetPassword` is TRUE when the user is OAuth-only (no credential
 * account row) — the frontend uses this flag to decide whether to next-route
 * to the set-password screen.
 */
export const CompleteProfileResponseSchema = z.object({
    profileCompleted: z.literal(true),
    requiresSetPassword: z.boolean()
});

/** Inferred TypeScript type for {@link CompleteProfileResponseSchema}. */
export type CompleteProfileResponse = z.infer<typeof CompleteProfileResponseSchema>;

// ---------------------------------------------------------------------------
// POST /api/v1/protected/profile/set-password
// ---------------------------------------------------------------------------

/**
 * Request body for the set-password endpoint.
 *
 * Password strength rules mirror the `emailAndPassword` config in
 * apps/api/src/lib/auth.ts (minimum 8 characters; Better Auth enforces its
 * own server-side checks on top — we validate here too for early feedback).
 */
export const SetPasswordBodySchema = z
    .object({
        /** The password the user wants to set. */
        password: z
            .string({ message: 'zodError.user.password.required' })
            .min(PROFILE_COMPLETION_MIN_PASSWORD_LENGTH, {
                message: 'zodError.user.password.min'
            })
    })
    .strict();

/** Inferred TypeScript type for {@link SetPasswordBodySchema}. */
export type SetPasswordBody = z.infer<typeof SetPasswordBodySchema>;

/**
 * Response returned by POST /api/v1/protected/profile/set-password.
 *
 * `credentialCreated: true` when Better Auth confirmed the account row was
 * created.
 */
export const SetPasswordResponseSchema = z.object({
    setPasswordPrompted: z.literal(true),
    credentialCreated: z.literal(true)
});

/** Inferred TypeScript type for {@link SetPasswordResponseSchema}. */
export type SetPasswordResponse = z.infer<typeof SetPasswordResponseSchema>;

// ---------------------------------------------------------------------------
// POST /api/v1/protected/profile/skip-set-password
// ---------------------------------------------------------------------------

/**
 * Request body for the skip-set-password endpoint.
 * No fields — the body is intentionally empty.
 */
export const SkipSetPasswordBodySchema = z.object({}).strict();

/** Inferred TypeScript type for {@link SkipSetPasswordBodySchema}. */
export type SkipSetPasswordBody = z.infer<typeof SkipSetPasswordBodySchema>;

/**
 * Response returned by POST /api/v1/protected/profile/skip-set-password.
 *
 * `credentialCreated: false` signals that no account row was created.
 */
export const SkipSetPasswordResponseSchema = z.object({
    setPasswordPrompted: z.literal(true),
    credentialCreated: z.literal(false)
});

/** Inferred TypeScript type for {@link SkipSetPasswordResponseSchema}. */
export type SkipSetPasswordResponse = z.infer<typeof SkipSetPasswordResponseSchema>;
