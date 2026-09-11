/**
 * @file commerce-edit-data.ts
 * @description Shared form-state contract for the commerce owner editor (HOS-258).
 *
 * Lives outside `CommerceListingEditor.client.tsx` so the section components can
 * type their props without importing from the orchestrator that renders them —
 * a type-only cycle would be erased at runtime, but it makes the dependency
 * graph read backwards and trips the repo's circular-dependency guard.
 */

import type { OpeningHours } from '@repo/schemas';
import type { CommerceI18nValues } from '../CommerceTranslationPanel.client';

/**
 * The `contactInfo` members this surface exposes, in render order.
 *
 * NOTE: `website` is intentionally absent per SPEC-253 AC-4 — it is not exposed
 * in the owner editor UI even though it exists in `ContactInfoSchema`.
 *
 * Runtime array rather than a bare type so the id contract can ENUMERATE what
 * the editor claims to render (HOS-385): the schema's `contactInfo` block is a
 * whole object, and only these members have a control to focus.
 */
export const CONTACT_KEYS = ['mobilePhone', 'workEmail'] as const;

/** Subset of the contact JSONB block the owner edits in this surface. */
export type ContactValues = Record<(typeof CONTACT_KEYS)[number], string>;

/** Social URLs the owner edits (subset of SocialNetwork, includes linkedIn per AC-4). */
export interface SocialValues {
    facebook: string;
    instagram: string;
    twitter: string;
    tiktok: string;
    youtube: string;
    linkedIn: string;
}

export const SOCIAL_KEYS: ReadonlyArray<keyof SocialValues> = [
    'facebook',
    'instagram',
    'twitter',
    'tiktok',
    'youtube',
    'linkedIn'
];

/**
 * All owner-editable form state, held as ONE object (HOS-258 PR 1).
 *
 * Mirrors `AccommodationEditData` in the host editor: the orchestrator owns this
 * object plus a `baseline` snapshot, and the PATCH body is the diff between the
 * two. It replaced the 18 independent `useState` slots + manual `dirty` Set this
 * editor used to carry, which made per-section extraction impossible.
 *
 * Media is deliberately NOT part of this type (HOS-372): `MediaSection` owns its
 * own state and persists every photo operation immediately against the
 * relational media endpoints, so photos are never diffed into the PATCH body.
 */
export interface CommerceEditData {
    readonly name: string;
    readonly destinationId: string;
    readonly description: string;
    readonly listingType: string;
    readonly summary: string;
    readonly richDescription: string;
    readonly contact: ContactValues;
    readonly social: SocialValues;
    readonly openingHours: OpeningHours | null;
    readonly priceRange: string;
    readonly menuUrl: string;
    readonly isPriceOnRequest: boolean;
    readonly priceFrom: number | null;
    readonly priceUnit: string;
    /**
     * Where the experience starts (HOS-1048) — experience vertical only, since
     * `meetingPoint` is on `ExperienceOwnerUpdateInputSchema` and not on the
     * gastronomy one. It lives on the shared state object anyway, exactly as
     * gastronomy's `priceRange`/`menuUrl` do: this type is the union of both
     * verticals, and `buildPatchPayload` decides what actually ships.
     */
    readonly meetingPoint: string;
    /**
     * Latitude of the meeting point, or `null` when nothing is pinned. `null`
     * rather than `0`, which is a real place off the coast of Africa — see
     * `parseCoordinateInput`.
     */
    readonly meetingPointLat: number | null;
    /** Longitude of the meeting point, or `null`. See {@link meetingPointLat}. */
    readonly meetingPointLong: number | null;
    /**
     * How to GET to the meeting point (HOS-1049) — already split into items,
     * like {@link whatToBring}: the textarea converts on the way in and out, so
     * this state matches the column and the PATCH body exactly.
     *
     * The ONE entitlement-gated field in this editor. It still round-trips for
     * a provider whose plan no longer grants it — see
     * {@link meetingPointDirectionsEnabled} for why the value and the
     * permission are two separate pieces of state.
     */
    readonly meetingPointDirections: readonly string[];
    /**
     * Whether the provider's CURRENT plan grants `manage_experience_directions`
     * (HOS-1049), as resolved by the protected `getById`.
     *
     * NOT derived from the value above, and the difference matters in both
     * directions: an entitled provider who has written nothing must still be
     * offered the field, and a downgraded provider who has written plenty must
     * still SEE it — read-only, so they know what is being withheld from their
     * public page rather than watching it vanish.
     *
     * Read-only state: nothing in this form can change it.
     */
    readonly meetingPointDirectionsEnabled: boolean;
    /**
     * Whole hours of the experience's duration (HOS-898), or `null` when the
     * box is empty.
     *
     * The duration is ONE column (`durationMinutes`) but TWO pieces of form
     * state, deliberately. Deriving hours and minutes from the total on every
     * render would rewrite the boxes while the owner types — "90" typed into
     * the minutes box would turn into "1 h 30 min" mid-keystroke. Keeping the
     * two halves independent means what you type stays put, and
     * `buildPatchPayload` joins them once, at save time.
     */
    readonly durationHours: number | null;
    /**
     * The leftover minutes of the duration (HOS-898), or `null` when empty.
     * Named `...Part` because it is NOT the stored total. See
     * {@link durationHours}.
     */
    readonly durationMinutesPart: number | null;
    /**
     * What the traveller has to bring (HOS-1046). Already split into items —
     * the textarea in `PracticalInfoSection` converts on the way in and out, so
     * this state matches the column and the PATCH body exactly.
     */
    readonly whatToBring: readonly string[];
    /** Requirements to take part (HOS-1046). See {@link whatToBring}. */
    readonly requirements: readonly string[];
    /** Free-text cancellation policy (HOS-1047); `''` when not declared. */
    readonly cancellationPolicy: string;
    /** Whether the owner offers an arrangement for private groups (HOS-1056). */
    readonly acceptsPrivateGroups: boolean;
    readonly amenityIds: ReadonlySet<string>;
    readonly featureIds: ReadonlySet<string>;
    readonly i18nValues: CommerceI18nValues;
    readonly refreshSlugFromName: boolean;
}

/**
 * The single generic change callback every section receives — the commerce
 * counterpart of the accommodation editor's `handleTextFieldChange`.
 */
export type CommerceFieldChange = <K extends keyof CommerceEditData>(
    field: K,
    value: CommerceEditData[K]
) => void;
