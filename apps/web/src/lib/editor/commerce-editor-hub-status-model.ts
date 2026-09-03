/**
 * @file commerce-editor-hub-status-model.ts
 * @description Per-section status lines for the commerce editor hub (HOS-1080).
 *
 * The commerce counterpart of `editor-hub-status-model.ts`, and it inherits that
 * file's hardest-won rule verbatim (H-101): **never warn about what does not
 * block while staying silent about what does.** The accommodation hub once
 * shouted "⚠ Sin fotos" — which did not block publishing — while `bathrooms` and
 * `minNights`, which did, appeared nowhere in the editor. The fix there was to
 * READ the blocking requirements from the module the server rejects from rather
 * than hand-copying them.
 *
 * So this file does the same: the blocking lines come from
 * `resolveListingCompleteness` (`@repo/schemas`), the exact function the publish
 * path evaluates and the checkout route answers 422 from. The only thing written
 * here is which SECTION each missing field belongs to, which is a routing fact
 * this module is the right owner of.
 *
 * The two other rules carry over unchanged:
 *
 * 1. **Never render a misleading zero.** A section with nothing meaningful to
 *    report gets NO second line, rather than "0 fotos".
 * 2. **Never signal by colour alone.** A warning carries its own words, so it
 *    survives greyscale, colour blindness and a screen reader.
 */

import {
    CommerceEntityTypeEnum,
    type CommerceListingCompletenessListing,
    resolveListingCompleteness
} from '@repo/schemas';
import { MISSING_FIELD_I18N_SUFFIX } from '@/lib/commerce/missing-field-labels';
import type { CommerceVertical } from '@/lib/commerce/owner-listings';
import type { EditorSectionStatus } from '@/lib/editor/editor-hub-status-model';

/**
 * Which editor section owns each `missing` entry `resolveListingCompleteness`
 * can produce.
 *
 * `ownerId` is deliberately absent: it is not owner-editable anywhere in this
 * editor, so pinning it to a section would send the owner to a page that cannot
 * fix it. A listing missing it has a data problem, not an editing problem.
 */
export const COMMERCE_MISSING_FIELD_SECTION: Readonly<Record<string, string>> = {
    name: 'basicInfo',
    summary: 'basicInfo',
    description: 'basicInfo',
    destinationId: 'basicInfo',
    type: 'basicInfo',
    'media.featuredImage': 'media',
    contactInfo: 'contact',
    openingHours: 'openingHours',
    priceRange: 'price',
    priceFrom: 'price'
};

/** The facts the commerce hub needs beyond the completeness verdict. */
export interface CommerceEditorStatusInput {
    /**
     * The vertical, which decides which fields the completeness check requires.
     *
     * Taken as the ROUTE's vocabulary (`'gastronomy' | 'experience'`) and mapped
     * to `CommerceEntityTypeEnum` here. The two spell the same two strings, but
     * only one of them is what the route param actually is, and a cast at every
     * call site is how a third spelling eventually appears.
     */
    readonly vertical: CommerceVertical;
    /**
     * The listing row as loaded. Passed straight through to
     * `resolveListingCompleteness`, so the hub and the server reach the same
     * verdict by running the same code rather than two similar-looking copies.
     */
    readonly listing: CommerceListingCompletenessListing;
    /** Photos already uploaded, featured image included. */
    readonly photoCount: number;
    /** FAQs already stored for this listing. */
    readonly faqCount: number;
    /** Amenities plus features currently ticked. */
    readonly selectedCatalogCount: number;
}

/**
 * Resolves the status line for every commerce section that has one.
 *
 * Sections absent from the returned map render no second line at all.
 *
 * @param params - The facts gathered from the loaded listing.
 * @returns Status lines keyed by section id. A missing key means "say nothing".
 */
export function resolveCommerceEditorSectionStatuses({
    input
}: {
    readonly input: CommerceEditorStatusInput;
}): Readonly<Record<string, EditorSectionStatus>> {
    const statuses: Record<string, EditorSectionStatus> = {};

    if (input.photoCount > 0) {
        statuses.media = {
            labelKey: 'commerce.owner.editor.hub.status.photos',
            tone: 'neutral',
            params: { count: input.photoCount }
        };
    }

    if (input.faqCount > 0) {
        statuses.faqs = {
            labelKey: 'commerce.owner.editor.hub.status.faqs',
            tone: 'neutral',
            params: { count: input.faqCount }
        };
    }

    // A zero here is a real absence, not a measurement — so it says nothing
    // instead of reporting "0 seleccionados".
    if (input.selectedCatalogCount > 0) {
        statuses.amenities = {
            labelKey: 'commerce.owner.editor.hub.status.selected',
            tone: 'neutral',
            params: { count: input.selectedCatalogCount }
        };
    }

    // Blocking lines are applied LAST and overwrite whatever neutral line the
    // section already had. That precedence is the point (H-101): a calm,
    // complete-looking "6 fotos" must never sit on top of the very field
    // refusing the publish.
    return { ...statuses, ...resolveBlockingStatuses({ input }) };
}

/**
 * Builds one `blocking` status per section that owns an unmet publish
 * requirement.
 *
 * Several requirements can land on the same section (`name`, `summary`,
 * `description`, `type` and `destinationId` all live in basic info), so they are
 * grouped: one line naming every missing field, rather than five lines.
 *
 * @param params - The listing and its vertical.
 * @returns Blocking statuses keyed by section id; empty when nothing blocks.
 */
function resolveBlockingStatuses({
    input
}: {
    readonly input: CommerceEditorStatusInput;
}): Record<string, EditorSectionStatus> {
    const { missing } = resolveListingCompleteness({
        entityType:
            input.vertical === 'gastronomy'
                ? CommerceEntityTypeEnum.GASTRONOMY
                : CommerceEntityTypeEnum.EXPERIENCE,
        listing: input.listing
    });
    if (missing.length === 0) return {};

    const bySection = new Map<string, string[]>();
    for (const field of missing) {
        const sectionId = COMMERCE_MISSING_FIELD_SECTION[field];
        const suffix = MISSING_FIELD_I18N_SUFFIX[field];
        // An unmapped field (today only `ownerId`) is skipped rather than
        // guessed at: a blocking line the owner cannot act on is worse than no
        // line, because it names a page that will not contain the field.
        if (!sectionId || !suffix) continue;

        const labelKeys = bySection.get(sectionId) ?? [];
        labelKeys.push(`commerce.owner.checklist.field.${suffix}`);
        bySection.set(sectionId, labelKeys);
    }

    const statuses: Record<string, EditorSectionStatus> = {};
    for (const [sectionId, labelKeys] of bySection) {
        statuses[sectionId] = {
            labelKey: 'commerce.owner.editor.hub.status.blockedFromPublishing',
            tone: 'blocking',
            missingRequirementLabelKeys: labelKeys
        };
    }
    return statuses;
}
