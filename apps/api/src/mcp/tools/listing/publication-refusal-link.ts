/**
 * @file publication-refusal-link.ts
 * @description Where a refused `set_listing_publication` call points the owner
 * (HOS-2326, spec HOS-2335 §5.1, AC-C2), and the two reasons it names.
 *
 * | refusal (`reason`) | page |
 * |---|---|
 * | `LISTING_INCOMPLETE` (and `PUBLISH_REQUIREMENTS_MISSING_*`) | the editor section of the first missing requirement, or the hub |
 * | `LISTING_MODERATED` | the editor hub (the fix-request banner lives there) |
 * | `DUPLICATE_LOCATION` | the editor's location section |
 * | `NO_COVERAGE`, `SUBSCRIPTION_REQUIRED` | the plans of the vertical |
 * | `NO_CAPABILITY`, `LISTING_LIMIT_REACHED` | the subscription |
 *
 * Every other publication refusal (no plans offered, paid signups paused, a lost
 * race) has no page that fixes it, so it carries no link.
 */

import { DUPLICATE_LOCATION_REASON, parsePublishRequirementsReason } from '@repo/schemas';
import { z } from 'zod';
import type { PortalDestination } from '../../portal/portal-routes';
import type { ToolErrorPayload } from '../tool-definition';
import {
    editorLink,
    firstMissingSection,
    type ListingRef,
    sectionForField
} from './listing-refusal-actions';

/** Tool-local reason: resuming a listing Hospeda moderated. */
export const LISTING_MODERATED_REASON = 'LISTING_MODERATED';

/** Tool-local reason: the listing lacks data it needs to go online. */
export const LISTING_INCOMPLETE_REASON = 'LISTING_INCOMPLETE';

/** The message prefix of the venue/experience completeness refusal. */
export const LISTING_INCOMPLETE_MESSAGE_PREFIX = 'Listing incomplete';

/**
 * The unmet publish requirements behind a completeness refusal, in the order
 * the service reported them.
 *
 * - Accommodation carries them in the `reason`
 *   (`PUBLISH_REQUIREMENTS_MISSING:<ids>`).
 * - Venue and experience carry the completeness field names in the internal
 *   message (`Listing incomplete: a, b`).
 *
 * @param args - The refusal's `reason` and internal `message`
 * @returns The requirement ids or field names; empty when none can be read
 */
export function missingRequirementsOf(args: {
    readonly reason: string | undefined;
    readonly message: string;
}): readonly string[] {
    const ids = parsePublishRequirementsReason({ reason: args.reason });
    if (ids.length > 0) {
        return ids;
    }
    if (!args.message.startsWith(LISTING_INCOMPLETE_MESSAGE_PREFIX)) {
        return [];
    }
    const list = args.message.slice(args.message.indexOf(':') + 1);
    return list
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item !== '');
}

/** Reads the unmet requirements a `LISTING_INCOMPLETE` payload carries in `details`. */
function readMissing(details: unknown): readonly string[] {
    const parsed = z.object({ missing: z.array(z.string()) }).safeParse(details);
    return parsed.success ? parsed.data.missing : [];
}

/**
 * Plan refusals and the page each one points at, keyed by `reason`.
 *
 * - No title and no trial (`NO_COVERAGE`, `SUBSCRIPTION_REQUIRED`): the plans of
 *   the vertical, where the owner picks one.
 * - A plan that exists but is not enough (`NO_CAPABILITY`,
 *   `LISTING_LIMIT_REACHED`): the subscription, where it is changed.
 */
const PLAN_REFUSAL_TARGET: Readonly<Record<string, 'plans' | 'subscription'>> = {
    NO_COVERAGE: 'plans',
    SUBSCRIPTION_REQUIRED: 'plans',
    NO_CAPABILITY: 'subscription',
    LISTING_LIMIT_REACHED: 'subscription'
};

/**
 * Where a `set_listing_publication` refusal points.
 *
 * @param args - The refusal (as the tool returned it) and the listing
 * @returns The destination, or `undefined` when no page helps
 */
export function publicationRefusalLink(args: {
    readonly error: ToolErrorPayload;
    readonly ref: ListingRef;
}): PortalDestination | undefined {
    const { error, ref } = args;
    switch (error.reason) {
        case LISTING_INCOMPLETE_REASON:
            return editorLink({
                ref,
                section: firstMissingSection({
                    vertical: ref.vertical,
                    missing: readMissing(error.details)
                })
            });
        case LISTING_MODERATED_REASON:
            return editorLink({ ref });
        case DUPLICATE_LOCATION_REASON:
            return editorLink({
                ref,
                section: sectionForField({ vertical: ref.vertical, field: 'location' })
            });
        default: {
            const target =
                error.reason === undefined ? undefined : PLAN_REFUSAL_TARGET[error.reason];
            if (target === 'plans') {
                return { kind: 'plans', vertical: ref.vertical };
            }
            return target === 'subscription' ? { kind: 'subscription' } : undefined;
        }
    }
}
