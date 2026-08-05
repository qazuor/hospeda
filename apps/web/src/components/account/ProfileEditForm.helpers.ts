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
    /**
     * `settings.publicProfileShowSocialNetworks` (HOS-375 §6.7 / G-5) — the
     * owner's opt-in to publishing the links above on their public author page.
     *
     * The only non-string field in this snapshot, and deliberately so: it is a
     * setting rather than a profile field, it needs no trimming, and coercing it
     * to `'true'`/`'false'` would only invite a truthiness bug at the diff.
     */
    readonly publicProfileShowSocialNetworks: boolean;
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
        avatarUrl: user.avatarUrl ?? '',
        // Defaults to OFF: nothing is published until the owner says so
        // (HOS-375 §6.7). `=== true` rather than a truthy check, so a user with
        // no stored settings at all lands on false rather than undefined.
        publicProfileShowSocialNetworks: user.publicProfileShowSocialNetworks === true
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
 * field is correctly detected as a change (bug F6). Reproduces the JSONB
 * nesting rules the form uses: `province → location.region`, whole-block
 * rebuild for the REPLACE-mode columns (`socialNetworks`, `location`) — and a
 * changed-keys-only delta with explicit nulls for `profile` and `contactInfo`,
 * which the API MERGES rather than replaces (HOS-375; see the comments on
 * those blocks).
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

    // profile JSONB (bio / website / occupation) — a CHANGED-KEYS-ONLY patch.
    //
    // `users.profile` is a MERGEABLE JSONB column (HOS-375, see
    // `UserModel.mergeableJsonbColumns`), so the API merges this patch into the
    // stored object instead of replacing it. That is what stops this form from
    // deleting `profile.avatar` — a key it does not model at all, but which
    // decides whether the user's author page stays indexed and in the sitemap.
    //
    // Merge semantics invert the rule for CLEARING, which is why a key the user
    // emptied is sent as an explicit `null` instead of being omitted: an omitted
    // key now means "leave it as it was", so omission would make an emptied bio
    // silently un-saveable. `null` is what the API and the column both read as
    // "absent" (see `UserProfileSchema`, which accepts it for exactly this).
    //
    // Unchanged keys are omitted entirely — sending them back would be a no-op
    // under `||`, but it would also mean re-submitting a value the user never
    // touched through the server's write bounds (read ⊇ write).
    const bio = tr(current.bio);
    const website = tr(current.website);
    const occupation = tr(current.occupation);
    const profilePatch: Record<string, string | null> = {};
    if (bio !== tr(baseline.bio)) {
        flatChanged.bio = bio;
        profilePatch.bio = bio.length > 0 ? bio : null;
    }
    if (website !== tr(baseline.website)) {
        flatChanged.website = website;
        profilePatch.website = website.length > 0 ? website : null;
    }
    if (occupation !== tr(baseline.occupation)) {
        flatChanged.occupation = occupation;
        profilePatch.occupation = occupation.length > 0 ? occupation : null;
    }
    if (Object.keys(profilePatch).length > 0) {
        payload.profile = profilePatch;
    }

    // contactInfo JSONB (mobilePhone) — a CHANGED-KEYS-ONLY patch, same shape
    // and same reasoning as `profile` above.
    //
    // `users.contactInfo` is a MERGEABLE JSONB column (HOS-375, see
    // `UserModel.mergeableJsonbColumns`), so this patch is merged into the
    // stored object instead of replacing it. That is what stops this form from
    // deleting the eight contact keys it does not model — `personalEmail`,
    // `workEmail`, `homePhone`, `workPhone`, `whatsapp`, `website`,
    // `preferredEmail`, `preferredPhone`. `website` in particular is read back
    // by this very page as the fallback for the profile website field, so under
    // replacement semantics saving a phone destroyed a value the next page load
    // tried to display.
    //
    // Clearing is therefore an explicit `null`, not an omission: under merge an
    // omitted key means "leave it as it was", so the old `if (phone.length > 0)`
    // guard would have made an emptied phone silently un-saveable. The shared
    // `ContactInfoSchema` accepts `null` on every key for exactly this.
    const phone = tr(current.phone);
    if (phone !== tr(baseline.phone)) {
        flatChanged.phone = phone;
        payload.contactInfo = { mobilePhone: phone.length > 0 ? phone : null };
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

    // settings.publicProfileShowSocialNetworks (HOS-375 §6.7) — the owner's
    // opt-in to publishing the links above on their author page.
    //
    // Sent under `settings`, which the protected PATCH validates against the
    // web-scoped allowlist (`UserSettingsWebPatchSchema`, strict), NOT under
    // `socialNetworks`: it is a preference about the block, not part of it, and
    // slipping it into the JSONB would be rejected as an unknown key.
    //
    // Deliberately absent from `flatChanged`. That map feeds
    // `ProfileEditFormSchema`, which validates the FORM's text fields; a boolean
    // it does not declare has nothing to validate and would only risk tripping
    // the schema. It still reaches `payload`, which is what the "no changes"
    // guard in the component counts, so flipping the toggle alone is a real save.
    if (current.publicProfileShowSocialNetworks !== baseline.publicProfileShowSocialNetworks) {
        payload.settings = {
            publicProfileShowSocialNetworks: current.publicProfileShowSocialNetworks
        };
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
