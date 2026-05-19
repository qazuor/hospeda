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
// Brief location schema for the onboarding flow
// ---------------------------------------------------------------------------

/**
 * Minimal location schema used only during profile completion.
 *
 * We intentionally do NOT reuse FullLocationSchema here because that schema
 * has many required fields (state, country) that we cannot guarantee a new
 * user will fill in.  This subset persists what the user actually typed.
 */
export const BriefLocationSchema = z.object({
    /** ISO country code or display name (e.g. "AR", "Argentina"). */
    country: z.string().min(2, { message: 'zodError.common.location.country.min' }).max(100),
    /** State or province (free text, optional). */
    region: z.string().min(1).max(100).optional(),
    /** City name (free text, optional). */
    city: z.string().min(1).max(100).optional()
});

/** Inferred TypeScript type for {@link BriefLocationSchema}. */
export type BriefLocation = z.infer<typeof BriefLocationSchema>;

// ---------------------------------------------------------------------------
// POST /api/v1/protected/profile/complete
// ---------------------------------------------------------------------------

/**
 * Request body for the profile-completion endpoint.
 *
 * Collects the minimum baseline profile data required for the rest of the
 * UI to have something to render.  Only `firstName`, `lastName`, and
 * `acceptedTerms` are required; everything else is optional.
 *
 * Schema Compatibility Policy note:
 * - `displayName` was previously required; it is now optional (additive-safe
 *   relaxation).  The service derives it from `${firstName} ${lastName}` when
 *   not provided.
 * - All new fields are optional — existing callers are not broken.
 */
export const CompleteProfileBodySchema = z
    .object({
        /**
         * First / given name.
         * Required field — replaces the old single "displayName" approach.
         * Persisted to users.first_name.
         */
        firstName: z
            .string({ message: 'zodError.user.firstName.required' })
            .min(1, { message: 'zodError.user.firstName.min' })
            .max(50, { message: 'zodError.user.firstName.max' }),

        /**
         * Last / family name.
         * Required field added in this round.
         * Persisted to users.last_name.
         */
        lastName: z
            .string({ message: 'zodError.user.lastName.required' })
            .min(1, { message: 'zodError.user.lastName.min' })
            .max(50, { message: 'zodError.user.lastName.max' }),

        /**
         * Full display name (persisted to users.display_name).
         * Better Auth maps its virtual `name` field to this column.
         *
         * RELAXED from required → optional (additive-safe per Schema Compatibility Policy).
         * When absent the service computes `${firstName} ${lastName}`.trim().
         */
        displayName: z
            .string({ message: 'zodError.user.displayName.required' })
            .min(2, { message: 'zodError.user.displayName.min' })
            .max(50, { message: 'zodError.user.displayName.max' })
            .optional(),

        /**
         * Birth date in ISO-8601 date string (YYYY-MM-DD from <input type="date">).
         * Persisted to users.birth_date.
         */
        birthDate: z.string().date().optional(),

        /**
         * Avatar URL returned by the avatar upload flow.
         * Only sent when the user changed their avatar during onboarding.
         * Persisted to users.image.
         */
        imageUrl: z.string().url({ message: 'zodError.user.imageUrl.url' }).optional(),

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
         * Short biography (10–300 chars, optional "Más detalles" section).
         * Persisted to users.profile JSONB.
         */
        bio: z
            .string()
            .min(10, { message: 'zodError.user.bio.min' })
            .max(300, { message: 'zodError.user.bio.max' })
            .optional(),

        /**
         * Personal or professional website URL.
         * Persisted to users.profile JSONB.
         */
        website: z.string().url({ message: 'zodError.user.website.url' }).optional(),

        /**
         * User's occupation / job title (2–100 chars, optional).
         * Persisted to users.profile JSONB.
         */
        occupation: z
            .string()
            .min(2, { message: 'zodError.user.occupation.min' })
            .max(100, { message: 'zodError.user.occupation.max' })
            .optional(),

        /**
         * Subset of social network URLs from SocialNetworkSchema.
         * Each platform is individually optional; invalid URLs are rejected.
         * Persisted to users.social_networks JSONB.
         */
        socialNetworks: z
            .object({
                facebook: z.string().url().optional(),
                instagram: z.string().url().optional(),
                twitter: z.string().url().optional(),
                linkedIn: z.string().url().optional(),
                tiktok: z.string().url().optional(),
                youtube: z.string().url().optional()
            })
            .optional(),

        /**
         * Brief location collected during onboarding (country / region / city).
         * Uses BriefLocationSchema — NOT the full FullLocationSchema — so users
         * can skip region/city without triggering required-field errors.
         * Persisted to users.location JSONB.
         */
        location: BriefLocationSchema.optional(),

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
