/**
 * @file destination-option.ts
 * @description Shared destination-select option shape for the commerce
 * owner self-service surfaces (HOS-693).
 *
 * Moved out of `gastronomy/CommerceLead.client.tsx` when HOS-693 §6.2 deleted
 * that component along with the pre-onboarding lead form it rendered — the
 * public lead form is gone, but the type it exported is still the one
 * `CommerceCreateForm.client.tsx`, `CommerceListingEditor.client.tsx`, and
 * `editor/BasicInfoSection.client.tsx` use for their own destination selects.
 * Lives as a standalone module (not re-exported from any single consumer) so
 * none of the three has to import it from one of its siblings.
 */

/** A destination option for a commerce owner surface's destination select. */
export interface DestinationOption {
    readonly id: string;
    readonly name: string;
}
