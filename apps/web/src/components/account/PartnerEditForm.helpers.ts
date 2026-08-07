/**
 * @file PartnerEditForm.helpers.ts
 * @description Pure snapshot + diff helpers for the partner owner
 * self-service edit form (HOS-278 D3). Kept separate from the component so the
 * payload-building logic — the exact place the content-atom rule lives — is
 * directly unit-testable without mounting React.
 */

import type { MyPartner, MyPartnerUpdate } from '@/lib/api/endpoints-protected';

/**
 * Normalized snapshot of every field the owner may edit, as plain strings.
 *
 * Used both as the diff baseline (resynced after a successful save) and to
 * build the current form state for diffing. Everything is a string because
 * that is what an `<input>` holds; the payload builder is what turns an empty
 * string back into the `null` the API expects.
 */
export interface PartnerEditSnapshot {
    readonly logoUrl: string;
    readonly description: string;
    readonly websiteUrl: string;
    readonly workEmail: string;
    readonly workPhone: string;
    readonly whatsapp: string;
    readonly facebook: string;
    readonly instagram: string;
    readonly twitter: string;
    readonly linkedIn: string;
    readonly tiktok: string;
    readonly youtube: string;
}

/**
 * Builds the form's diff baseline from the server-fetched partner.
 *
 * The content trio is seeded from the PENDING proposal when one is awaiting
 * review (`contentReviewState === 'pending'`) so re-opening the form continues
 * refining that submission instead of quietly resetting it back to the still-
 * live content underneath it. Otherwise it seeds from the LIVE content — the
 * ordinary "propose a change to what's currently published" case. Same
 * interpretation `buildHostTradeEditSnapshot` makes, and for the same reason:
 * a half-finished pending edit must not disappear on the next visit.
 *
 * @param partner - The server-fetched listing to seed the baseline from.
 * @returns A normalized {@link PartnerEditSnapshot}.
 */
export function buildPartnerEditSnapshot(partner: MyPartner): PartnerEditSnapshot {
    const hasPending = partner.contentReviewState === 'pending';
    return {
        logoUrl: (hasPending ? partner.pendingLogoUrl : partner.logoUrl) ?? '',
        description: (hasPending ? partner.pendingDescription : partner.description) ?? '',
        websiteUrl: (hasPending ? partner.pendingWebsiteUrl : partner.websiteUrl) ?? '',
        workEmail: partner.contactInfo?.workEmail ?? '',
        workPhone: partner.contactInfo?.workPhone ?? '',
        whatsapp: partner.contactInfo?.whatsapp ?? '',
        facebook: partner.socialNetworks?.facebook ?? '',
        instagram: partner.socialNetworks?.instagram ?? '',
        twitter: partner.socialNetworks?.twitter ?? '',
        linkedIn: partner.socialNetworks?.linkedIn ?? '',
        tiktok: partner.socialNetworks?.tiktok ?? '',
        youtube: partner.socialNetworks?.youtube ?? ''
    };
}

/** The contact keys this form models, paired with their snapshot field. */
const CONTACT_KEYS = ['workEmail', 'workPhone', 'whatsapp'] as const;

/**
 * Every key `SocialNetworkSchema` declares — ALL SIX, deliberately.
 *
 * `socialNetworks` is replaced wholesale rather than merged, so this list has
 * to be exhaustive: a key the form does not model would be dropped on the first
 * save. Modelling all six is what makes wholesale replacement safe, and it is
 * also what makes "delete my Instagram" expressible at all (see the atom-rule
 * note below).
 */
const SOCIAL_KEYS = ['facebook', 'instagram', 'twitter', 'linkedIn', 'tiktok', 'youtube'] as const;

/**
 * Builds the PATCH payload as the diff between the current form snapshot and
 * the baseline. Only touched groups are included — a submit with no changes at
 * all returns `{}`, which the caller treats as "nothing to save".
 *
 * **THE ATOM RULE (HOS-278 D3) — read before touching this function.**
 * `PartnerService.updateOwn` treats "any one of `logoUrl` / `description` /
 * `websiteUrl` present in the request" as a content edit, and then OVERWRITES
 * all three pending columns from whatever it received:
 * `pendingLogoUrl: logoUrl ?? null`, and the same shape for the other two.
 * Sending ONLY a changed `description` would silently NULL the pending logo and
 * website that were never touched. So whenever ANY of the three content fields
 * is dirty, ALL THREE travel together in the payload — never a partial content
 * patch. Identical to the host-trade benefit rule, for an identical reason.
 *
 * The two JSONB groups behave differently from each other, and the difference
 * is forced by their schemas rather than chosen here:
 *
 * - `contactInfo` is MERGED by the model, so only the changed keys are sent and
 *   the six keys this form does not model survive untouched. Clearing works
 *   because every `ContactInfoSchema` field is `.nullish()` — an emptied input
 *   travels as an explicit `null`.
 * - `socialNetworks` is REPLACED wholesale, so the whole six-key object is sent
 *   whenever any one of them changes, with the empty ones OMITTED. That
 *   omission is what deletes them. It has to work this way: the schema's
 *   fields are `.optional()` but NOT `.nullable()`, so `null` is rejected and
 *   `''` fails the URL regex — under a merge there would be no way to express
 *   "remove this link" at all.
 *
 * Content empty strings become `null` for the same validator reason: `''`
 * fails `.url()`, so "I cleared my logo" would 400 instead of clearing.
 *
 * @param params - `{ current, baseline }` (RO-RO).
 * @returns The changed-fields-only payload for `partnersApi.updateMine`.
 */
export function buildPartnerOwnerPatch({
    current,
    baseline
}: {
    readonly current: PartnerEditSnapshot;
    readonly baseline: PartnerEditSnapshot;
}): MyPartnerUpdate {
    const payload: Record<string, unknown> = {};

    const contentDirty =
        current.logoUrl.trim() !== baseline.logoUrl.trim() ||
        current.description.trim() !== baseline.description.trim() ||
        current.websiteUrl.trim() !== baseline.websiteUrl.trim();

    if (contentDirty) {
        // All three, always — see the atom rule above.
        payload.logoUrl = current.logoUrl.trim() || null;
        payload.description = current.description.trim() || null;
        payload.websiteUrl = current.websiteUrl.trim() || null;
    }

    const contactChanges: Record<string, string | null> = {};
    for (const key of CONTACT_KEYS) {
        if (current[key].trim() !== baseline[key].trim()) {
            contactChanges[key] = current[key].trim() || null;
        }
    }
    if (Object.keys(contactChanges).length > 0) {
        payload.contactInfo = contactChanges;
    }

    const socialDirty = SOCIAL_KEYS.some((key) => current[key].trim() !== baseline[key].trim());
    if (socialDirty) {
        // The WHOLE object, not just the changed keys: the column is replaced
        // wholesale, so anything left out here is deleted. Empty values are
        // left out ON PURPOSE — that omission is how a link gets removed.
        const socialNetworks: Record<string, string> = {};
        for (const key of SOCIAL_KEYS) {
            const value = current[key].trim();
            if (value) {
                socialNetworks[key] = value;
            }
        }
        payload.socialNetworks = socialNetworks;
    }

    return payload as MyPartnerUpdate;
}
