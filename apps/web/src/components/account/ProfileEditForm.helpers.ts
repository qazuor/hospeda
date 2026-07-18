/**
 * @file ProfileEditForm.helpers.ts
 * @description Shared type + pure diff/validation helpers for the profile edit
 * form.
 *
 * HOS-190 slice 3: the local `parseZodErrors` mapper (path[0]-only, hand-rolled
 * i18n resolution) was removed — the form now uses the shared `useZodForm` /
 * `zodIssuesToFieldErrors` primitive from `@/lib/forms` instead, which
 * supports nested paths and the same `{{min}}`/`{{max}}` interpolation. See
 * `src/lib/forms/field-errors.ts` for the replacement.
 *
 * HOS-190 (BETA-189): this file now also owns the form's client validation
 * schema and the pure snapshot-diff logic. The diff is computed against a
 * MUTABLE baseline snapshot (resynced after every successful save by the
 * component) rather than the load-time `initialUser` prop — that resync is
 * what fixes bug F6 (a reverted just-saved field being wrongly reported as "no
 * changes"; see `buildProfilePatch`).
 */

import { ProfileEditSchema } from '@repo/schemas';
import { z } from 'zod';
import type { FieldErrors } from '@/lib/forms/field-errors';
import type { ProfileEditUser } from './ProfileEditForm.client';

/**
 * Field-level error messages keyed by field name. Re-exports the shared
 * `FieldErrors` type (dotted-path string keys) under the name the profile-edit
 * subcomponents already import, so this migration doesn't require touching
 * every subcomponent's type import just to rename it.
 */
export type ProfileEditFieldErrors = FieldErrors;

/**
 * Client validation schema for the profile edit form.
 *
 * Extends the shared `ProfileEditSchema` (which keeps `displayName`/`firstName`/
 * `lastName` blankable for read⊇write) with a tightened `bio` bound that matches
 * the SERVER's `profile.bio` rule (min 10 / max 300) instead of the looser
 * client `max(1000)`-no-min. Previously a 4-char (or 301-1000-char) bio passed
 * the client schema and then 400'd opaquely server-side with no field marked —
 * BETA-189 P4. The empty-string variant stays valid so a bio can be cleared.
 */
export const ProfileEditFormSchema = ProfileEditSchema.extend({
    bio: z
        .union([
            z.literal(''),
            z
                .string()
                .min(10, { message: 'zodError.user.profile.bio.min' })
                .max(300, { message: 'zodError.user.profile.bio.max' })
        ])
        .optional()
});

/** Required name fields that must not be silently CLEARED client-side (BETA-189 P1). */
export type RequiredNameField = 'displayName' | 'firstName' | 'lastName';

/**
 * Normalized snapshot of every editable profile field, as plain strings. Used
 * as the diff baseline (resynced after each save) and to build the current
 * form state for diffing.
 */
export interface ProfileSnapshot {
    readonly displayName: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly birthDate: string;
    readonly phone: string;
    readonly bio: string;
    readonly website: string;
    readonly occupation: string;
    readonly facebookUrl: string;
    readonly instagramUrl: string;
    readonly twitterUrl: string;
    readonly linkedinUrl: string;
    readonly youtubeUrl: string;
    readonly country: string;
    readonly province: string;
    readonly city: string;
    readonly addressLine1: string;
    readonly postalCode: string;
    readonly avatarUrl: string;
}

/**
 * Build the initial diff baseline from the server-fetched user. Mirrors the
 * component's per-field `useState` initializers EXACTLY so the first diff is
 * accurate (any divergence would make a pristine form look dirty).
 *
 * @param user - The server-fetched user to seed the baseline from.
 * @returns A normalized {@link ProfileSnapshot}.
 */
export function buildInitialProfileSnapshot(user: ProfileEditUser): ProfileSnapshot {
    return {
        displayName: user.displayName ?? '',
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        birthDate: user.birthDate ?? '',
        phone: user.phone ?? '',
        bio: user.profile?.bio ?? '',
        website: user.website ?? user.profile?.website ?? '',
        occupation: user.profile?.occupation ?? '',
        facebookUrl: user.facebookUrl ?? '',
        instagramUrl: user.instagramUrl ?? '',
        twitterUrl: user.twitterUrl ?? '',
        linkedinUrl: user.linkedinUrl ?? '',
        youtubeUrl: user.youtubeUrl ?? '',
        country: user.country ?? '',
        province: user.province ?? '',
        city: user.city ?? '',
        addressLine1: user.addressLine1 ?? '',
        postalCode: user.postalCode ?? '',
        avatarUrl: user.avatarUrl ?? ''
    };
}

/** Result of {@link buildProfilePatch}. */
export interface BuiltProfilePatch {
    /**
     * Flat, changed-only field map for schema validation. Only fields the user
     * actually touched are present, so a pre-existing invalid value the user is
     * not editing never blocks an unrelated save (read⊇write).
     */
    readonly flatChanged: Record<string, string>;
    /**
     * Nested API PATCH payload (profile / contactInfo / socialNetworks /
     * location JSONB blocks + top-level birthDate / names). Excludes `image`,
     * which the component adds after the async avatar upload.
     */
    readonly payload: Record<string, unknown>;
    /**
     * Required name fields the user tried to CLEAR (had a value at baseline, now
     * empty). The component blocks + announces these instead of saving (P1).
     */
    readonly clearedRequiredNames: readonly RequiredNameField[];
}

const REQUIRED_NAME_FIELDS: readonly RequiredNameField[] = ['displayName', 'firstName', 'lastName'];

const tr = (value: string): string => value.trim();

/**
 * Compute the PATCH diff between the current form snapshot and the baseline.
 *
 * The diff is intentionally driven by the MUTABLE `baseline` (resynced after
 * each save) rather than the load-time initial user, so reverting a just-saved
 * field is correctly detected as a change (bug F6). Reproduces the exact JSONB
 * nesting rules the form has always used (whole-block profile / social /
 * location rebuild on any change, `province → location.region`, phone omitted
 * on clear).
 *
 * @param params.current - Snapshot of the current form field values.
 * @param params.baseline - Snapshot of the last-persisted values.
 * @returns The validation subset, API payload, and any cleared required names.
 */
export function buildProfilePatch({
    current,
    baseline
}: {
    readonly current: ProfileSnapshot;
    readonly baseline: ProfileSnapshot;
}): BuiltProfilePatch {
    const flatChanged: Record<string, string> = {};
    const payload: Record<string, unknown> = {};
    const clearedRequiredNames: RequiredNameField[] = [];

    // Required names: read⊇write — a name never set (baseline empty) may stay
    // empty and is omitted; but CLEARING a previously-set name is blocked.
    for (const field of REQUIRED_NAME_FIELDS) {
        const cur = tr(current[field]);
        const base = tr(baseline[field]);
        if (cur === base) continue;
        if (cur.length === 0) {
            clearedRequiredNames.push(field);
            continue;
        }
        flatChanged[field] = cur;
        payload[field] = cur;
    }

    // birthDate (top-level) — sent when changed to a non-empty value.
    const birthDate = tr(current.birthDate);
    if (birthDate !== tr(baseline.birthDate) && birthDate.length > 0) {
        flatChanged.birthDate = birthDate;
        payload.birthDate = birthDate;
    }

    // profile JSONB (bio / website / occupation) — rebuilt as a whole block
    // (with only non-empty fields) whenever any of the three changed, so the
    // API gets a self-consistent JSONB value whether it merges or replaces.
    const bio = tr(current.bio);
    const website = tr(current.website);
    const occupation = tr(current.occupation);
    const profileChanged =
        bio !== tr(baseline.bio) ||
        website !== tr(baseline.website) ||
        occupation !== tr(baseline.occupation);
    if (profileChanged) {
        if (bio !== tr(baseline.bio)) flatChanged.bio = bio;
        if (website !== tr(baseline.website)) flatChanged.website = website;
        if (occupation !== tr(baseline.occupation)) flatChanged.occupation = occupation;
        const profilePatch: Record<string, string> = {};
        if (bio.length > 0) profilePatch.bio = bio;
        if (website.length > 0) profilePatch.website = website;
        if (occupation.length > 0) profilePatch.occupation = occupation;
        payload.profile = profilePatch;
    }

    // contactInfo JSONB (mobilePhone) — omitted on clear (required-when-present).
    const phone = tr(current.phone);
    if (phone !== tr(baseline.phone)) {
        flatChanged.phone = phone;
        if (phone.length > 0) {
            payload.contactInfo = { mobilePhone: phone };
        }
    }

    // socialNetworks JSONB — whole block rebuilt (non-empty only) on any change.
    const socialFields: ReadonlyArray<{
        readonly flatKey: string;
        readonly jsonKey: 'facebook' | 'instagram' | 'twitter' | 'linkedIn' | 'youtube';
        readonly cur: string;
        readonly base: string;
    }> = [
        {
            flatKey: 'facebookUrl',
            jsonKey: 'facebook',
            cur: tr(current.facebookUrl),
            base: tr(baseline.facebookUrl)
        },
        {
            flatKey: 'instagramUrl',
            jsonKey: 'instagram',
            cur: tr(current.instagramUrl),
            base: tr(baseline.instagramUrl)
        },
        {
            flatKey: 'twitterUrl',
            jsonKey: 'twitter',
            cur: tr(current.twitterUrl),
            base: tr(baseline.twitterUrl)
        },
        {
            flatKey: 'linkedinUrl',
            jsonKey: 'linkedIn',
            cur: tr(current.linkedinUrl),
            base: tr(baseline.linkedinUrl)
        },
        {
            flatKey: 'youtubeUrl',
            jsonKey: 'youtube',
            cur: tr(current.youtubeUrl),
            base: tr(baseline.youtubeUrl)
        }
    ];
    let socialChanged = false;
    const socialPatch: Record<string, string> = {};
    for (const s of socialFields) {
        if (s.cur !== s.base) {
            socialChanged = true;
            flatChanged[s.flatKey] = s.cur;
        }
        if (s.cur.length > 0) socialPatch[s.jsonKey] = s.cur;
    }
    if (socialChanged) {
        payload.socialNetworks = socialPatch;
    }

    // location JSONB — whole block rebuilt (non-empty only), `province → region`.
    const country = tr(current.country);
    const province = tr(current.province);
    const city = tr(current.city);
    const addressLine1 = tr(current.addressLine1);
    const postalCode = tr(current.postalCode);
    const locationChanged =
        country !== tr(baseline.country) ||
        province !== tr(baseline.province) ||
        city !== tr(baseline.city) ||
        addressLine1 !== tr(baseline.addressLine1) ||
        postalCode !== tr(baseline.postalCode);
    if (locationChanged) {
        if (country !== tr(baseline.country)) flatChanged.country = country;
        if (province !== tr(baseline.province)) flatChanged.province = province;
        if (city !== tr(baseline.city)) flatChanged.city = city;
        if (addressLine1 !== tr(baseline.addressLine1)) flatChanged.addressLine1 = addressLine1;
        if (postalCode !== tr(baseline.postalCode)) flatChanged.postalCode = postalCode;
        const locationPatch: Record<string, string> = {};
        if (country.length > 0) locationPatch.country = country;
        if (province.length > 0) locationPatch.region = province;
        if (city.length > 0) locationPatch.city = city;
        if (addressLine1.length > 0) locationPatch.addressLine1 = addressLine1;
        if (postalCode.length > 0) locationPatch.postalCode = postalCode;
        payload.location = locationPatch;
    }

    return { flatChanged, payload, clearedRequiredNames };
}
