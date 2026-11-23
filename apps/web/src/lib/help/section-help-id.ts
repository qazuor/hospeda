/**
 * @file section-help-id.ts
 * @description Typed `data-help` anchor of an editor section (HOS-2488).
 *
 * The kit `Section` requires a {@link HelpAnchor}; `sectionHelpAnchor` returns a
 * plain string. This wraps it with the kit's own shape check so an island never
 * casts by hand, and the anchor stays identical to the one the editor shell
 * renders for the same page (AC-13).
 */

import { type HelpAnchor, isHelpAnchor } from '@/components/account/ui/help-anchor';
import { sectionHelpAnchor } from './help-entry';

/**
 * Builds the anchor an editor section carries as `data-help`.
 *
 * @param args.vertical - The registry id of the editor (`accommodation`, `venue`, `experience`)
 * @param args.slug - The web editor slug of the page, e.g. `datos`
 * @returns The anchor, for example `section:venue.datos`
 * @throws Error when the pair does not form a valid anchor (a programming error)
 */
export function sectionHelpId({
    vertical,
    slug
}: {
    readonly vertical: string;
    readonly slug: string;
}): HelpAnchor {
    const anchor = sectionHelpAnchor({ vertical, slug });
    if (!isHelpAnchor(anchor)) {
        throw new Error(`Invalid help anchor: ${anchor}`);
    }
    return anchor;
}
