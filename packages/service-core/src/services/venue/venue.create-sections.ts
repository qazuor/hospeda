/**
 * venue.create-sections.ts
 *
 * Create-time section-presence rule for venue listings (HOS-2052 / DEC-FAC-025).
 *
 * ## The rule
 *
 * A create body that touches a non-common listing section must be created with
 * business lines that actually offer that section. The section is decided from
 * the catalog, never by comparing business-line values by hand (G-FAC-03):
 * `sectionsTouchedByBody` names the sections the body touches and
 * `resolveListingSectionPresence` decides which of them the resulting business
 * lines leave absent.
 *
 * A `null` field is NOT a touch (`sections-touched.ts`): a body that only clears
 * a section declares no section, so clearing stays allowed on a listing whose
 * lines do not offer it.
 *
 * ## Why it lives in the service and not in step 4b
 *
 * The admin POST does not declare `listingSection`: declaring it would run the
 * full listing-access chain and lose the own-create shortcut
 * (`listing-access.ts`). Step 4b also answers 409 `ALREADY_EXISTS` because it
 * compares against a stored listing; a create has nothing stored. This is a
 * body that is internally inconsistent with itself, so it is a 400
 * `VALIDATION_ERROR` from the service, the same classification the review
 * dimension validation uses elsewhere in service-core.
 *
 * The rule is generic over the catalog sections: today only `nightInfo` is
 * reachable from the POST, but nothing here names a section or a business line.
 */

import { ServiceErrorCode, sectionsTouchedByBody } from '@repo/schemas';
import { resolveListingSectionPresence } from '@repo/verticals';
import { ServiceError } from '../../types';

/** Machine-readable reason carried when a touched section is absent. */
export const SECTION_ABSENT_REASON = 'SECTION_ABSENT' as const;

/**
 * Rejects a create body that touches a section its business lines do not offer.
 *
 * Runs after the base create hook has resolved the resulting business lines
 * (body selection or type preselection), so an invalid selection keeps its own
 * `BUSINESS_LINES_INVALID` failure instead of this one.
 *
 * @param args.body - Validated create body.
 * @param args.businessLines - The business lines the created listing will have.
 * @throws {ServiceError} `VALIDATION_ERROR` with `reason: 'SECTION_ABSENT'` and
 *   `details: { reason: 'SECTION_ABSENT', section }` for the first absent
 *   touched section.
 */
export function assertVenueCreateSectionsPresent({
    body,
    businessLines
}: {
    readonly body: Record<string, unknown> | undefined;
    readonly businessLines: readonly string[];
}): void {
    const requested = sectionsTouchedByBody({ vertical: 'venue', body });
    if (requested.length === 0) return;

    const absent = resolveListingSectionPresence({
        vertical: 'venue',
        businessLines,
        requested
    });

    for (const id of requested) {
        if (absent.get(id) === true) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'Section is not offered by the listing business lines',
                { reason: SECTION_ABSENT_REASON, section: id },
                SECTION_ABSENT_REASON
            );
        }
    }
}
