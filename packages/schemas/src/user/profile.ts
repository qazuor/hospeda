/**
 * Centralized user profile edit schema (SPEC-096 / REQ-096-06).
 *
 * Both the web (`/mi-cuenta/editar/`) and admin (`/admin/users/:id/edit`)
 * surfaces validate profile-edit input against this single schema to ensure
 * a consistent source of truth and avoid drift between the two apps.
 */
import { z } from 'zod';

// ============================================================================
// SCHEMA
// ============================================================================

/**
 * Schema for user profile edit operations.
 *
 * Uses `z.strictObject` so that any extra field (e.g. `role`, `email`,
 * `permissions`) passed by accident or injected via request manipulation is
 * rejected with a validation error rather than silently ignored.
 *
 * **Phone format**: E.164 — a leading `+` followed by 1-3 country-code digits
 * and 4-14 subscriber digits (e.g. `+541134567890`). An empty string `''` is
 * also accepted to allow clearing the phone field.
 *
 * **Avatar URL**: A valid absolute URL or an empty string `''` (to allow
 * clearing the avatar). Relative paths and data URIs are rejected.
 *
 * @example
 * ```ts
 * // Valid — minimal payload
 * ProfileEditSchema.parse({
 *   displayName: 'María García',
 *   firstName: 'María',
 *   lastName: 'García',
 * });
 *
 * // Valid — full payload
 * ProfileEditSchema.parse({
 *   displayName: 'María García',
 *   firstName: 'María',
 *   lastName: 'García',
 *   bio: 'Amante de los viajes y el litoral argentino.',
 *   avatarUrl: 'https://cdn.example.com/avatars/maria.jpg',
 *   phone: '+541134567890',
 * });
 *
 * // Invalid — extra field rejected by strictObject
 * ProfileEditSchema.parse({ displayName: 'X', firstName: 'X', lastName: 'X', role: 'admin' });
 * // → ZodError: Unrecognized key(s) in object: 'role'
 * ```
 */
export const ProfileEditSchema = z.strictObject({
    /**
     * Public display name shown across the platform.
     * Between 1 and 100 characters.
     */
    displayName: z
        .string()
        .min(1, { message: 'zodError.user.profile.displayName.min' })
        .max(100, { message: 'zodError.user.profile.displayName.max' }),

    /**
     * Legal first name. Between 1 and 100 characters.
     */
    firstName: z
        .string()
        .min(1, { message: 'zodError.user.profile.firstName.min' })
        .max(100, { message: 'zodError.user.profile.firstName.max' }),

    /**
     * Legal last name. Between 1 and 100 characters.
     */
    lastName: z
        .string()
        .min(1, { message: 'zodError.user.profile.lastName.min' })
        .max(100, { message: 'zodError.user.profile.lastName.max' }),

    /**
     * Short biography or personal description. Up to 1000 characters.
     * Optional — omitting it leaves the existing bio unchanged on the server.
     */
    bio: z.string().max(1000, { message: 'zodError.user.profile.bio.max' }).optional(),

    /**
     * URL of the user's avatar image.
     * Accepts a valid absolute URL or an empty string `''` (to clear the avatar).
     */
    avatarUrl: z.union([z.literal(''), z.string().url()]).optional(),

    /**
     * Contact phone number in E.164 format (`+<country><number>`).
     * Accepts an empty string `''` to allow clearing the phone field.
     * The regex enforces: `+` followed by 1-3 country-code digits and 4-14
     * subscriber digits (total 5-17 digits after the `+`).
     */
    phone: z.union([z.literal(''), z.string().regex(/^\+\d{1,3}\d{4,14}$/)]).optional(),

    // ─── SPEC-113 polish: extended profile fields ───────────────────────────
    //
    // All additions below are `.optional()` per the additive-only schema
    // compatibility policy. Each accepts an empty string `''` (where
    // applicable) so the user can clear a previously-set value.

    /**
     * Date of birth, ISO `YYYY-MM-DD` (or empty string to clear).
     * The server parses this into a `Date`; the wire format stays a string
     * so the same payload works from native HTML date inputs.
     */
    birthDate: z
        .union([
            z.literal(''),
            z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
                message: 'zodError.user.profile.birthDate.format'
            })
        ])
        .optional(),

    /**
     * Personal website URL. Empty string clears it.
     */
    website: z.union([z.literal(''), z.string().url()]).optional(),

    /**
     * Free-text occupation / job title. 2-100 chars when set; `''` clears.
     */
    occupation: z
        .union([
            z.literal(''),
            z
                .string()
                .min(2, { message: 'zodError.user.profile.occupation.min' })
                .max(100, { message: 'zodError.user.profile.occupation.max' })
        ])
        .optional(),

    // Social networks — each accepts a full URL or `''` to clear.
    facebookUrl: z.union([z.literal(''), z.string().url()]).optional(),
    instagramUrl: z.union([z.literal(''), z.string().url()]).optional(),
    twitterUrl: z.union([z.literal(''), z.string().url()]).optional(),
    linkedinUrl: z.union([z.literal(''), z.string().url()]).optional(),
    youtubeUrl: z.union([z.literal(''), z.string().url()]).optional(),

    // Postal address fields — all strings; `''` clears.
    addressLine1: z.string().max(200).optional(),
    city: z.string().max(100).optional(),
    province: z.string().max(100).optional(),
    country: z.string().max(100).optional(),
    postalCode: z.string().max(20).optional()
});

// ============================================================================
// TYPES
// ============================================================================

/**
 * Inferred TypeScript type for {@link ProfileEditSchema}.
 *
 * @example
 * ```ts
 * import type { ProfileEditInput } from '@repo/schemas';
 *
 * async function updateProfile(input: ProfileEditInput): Promise<void> { ... }
 * ```
 */
export type ProfileEditInput = z.infer<typeof ProfileEditSchema>;
