/**
 * @file experience-contact.ts
 * @description Whether an experience listing has any contact channel a visitor
 * can actually use (HOS-1056).
 *
 * ## Why this is a shared function and not an inline check
 *
 * `ExperienceContactBlock` renders nothing at all when every published channel
 * is missing — and the private-groups CTA (HOS-1056) is an anchor INTO that
 * block. So the CTA's link is only real when the block exists, and the two
 * decisions have to be made from the same predicate: an inline copy in each file
 * would let them drift into a link pointing at an element that is not on the
 * page, which is a dead anchor with no error and no visible symptom.
 *
 * That failure mode is exactly the one HOS-363 measured on this very page — a
 * WhatsApp CTA that read a field the public payload never carried, and so never
 * rendered — and HOS-924's variant, an experience published with no visible
 * contact at all. A group CTA hung off a channel with that problem would be born
 * dead in the same way.
 *
 * ## What counts
 *
 * The four keys `ExperiencePublicContactInfoSchema` publishes, and nothing else.
 * A value counts only if it is a non-empty string after trimming: `contact_info`
 * is an unbounded JSONB blob, so a key can legitimately hold `null`, `''` or
 * whitespace, and a whitespace phone number would otherwise make the block
 * "present" while rendering an empty pill.
 *
 * The website counts, but only once it has survived `resolveSafeExternalUrl` —
 * the same allow-list the block itself applies (HOS-592 / F-02). Skipping that
 * here would make the two disagree in precisely one case: a `javascript:` URL
 * as the ONLY channel, where this said "there is contact", the block dropped
 * the link and rendered nothing, and the CTA pointed at an element that was not
 * on the page.
 */

import type { ExperienceContactInfo } from '@/data/types';
import { resolveSafeExternalUrl } from './safe-external-url';

/**
 * Normalizes a stored contact value to a usable string, or `undefined`.
 *
 * Kept private: the only question callers should ask is the one
 * {@link hasPublicContactChannel} answers.
 */
function usable(value: string | null | undefined): boolean {
    return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Whether the listing publishes at least one contact channel.
 *
 * @param contactInfo - The narrowed public contact object, or `null`.
 * @returns `true` when `ExperienceContactBlock` will render something.
 */
export function hasPublicContactChannel({
    contactInfo
}: {
    readonly contactInfo: ExperienceContactInfo | null;
}): boolean {
    if (!contactInfo) return false;
    return (
        usable(contactInfo.workPhone) ||
        usable(contactInfo.mobilePhone) ||
        usable(contactInfo.workEmail) ||
        resolveSafeExternalUrl(contactInfo.website) !== undefined
    );
}

/**
 * The DOM id `ExperienceContactBlock` renders on its wrapper, and the target of
 * the private-groups CTA (HOS-1056).
 *
 * Exported so the anchor and the element are written from ONE constant. A
 * hard-coded `href="#..."` on one side and a hard-coded `id` on the other is a
 * pair that can be renamed apart, and the browser reports nothing when they
 * disagree — the click simply does nothing.
 */
export const EXPERIENCE_CONTACT_ANCHOR_ID = 'experience-contact';
