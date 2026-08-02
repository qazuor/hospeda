/**
 * @file commerce-edit-data.ts
 * @description Shared form-state contract for the commerce owner editor (HOS-258).
 *
 * Lives outside `CommerceListingEditor.client.tsx` so the section components can
 * type their props without importing from the orchestrator that renders them —
 * a type-only cycle would be erased at runtime, but it makes the dependency
 * graph read backwards and trips the repo's circular-dependency guard.
 */

import type { Image, OpeningHours } from '@repo/schemas';
import type { CommerceI18nValues } from '../CommerceTranslationPanel.client';

/**
 * Subset of the contact JSONB block the owner edits in this surface.
 * NOTE: `website` is intentionally absent per SPEC-253 AC-4 — it is not
 * exposed in the owner editor UI even though it exists in ContactInfoSchema.
 */
export interface ContactValues {
    mobilePhone: string;
    workEmail: string;
}

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
 * `preservedMedia` is deliberately NOT part of this type — it is never editable,
 * never diffed, and only rides along on a media patch.
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
    readonly featuredImage: Image | null;
    readonly gallery: readonly Image[];
    readonly amenityIds: ReadonlySet<string>;
    readonly featureIds: ReadonlySet<string>;
    readonly i18nValues: CommerceI18nValues;
}

/**
 * The single generic change callback every section receives — the commerce
 * counterpart of the accommodation editor's `handleTextFieldChange`.
 */
export type CommerceFieldChange = <K extends keyof CommerceEditData>(
    field: K,
    value: CommerceEditData[K]
) => void;
