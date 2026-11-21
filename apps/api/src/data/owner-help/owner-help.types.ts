/**
 * @file owner-help.types.ts
 * @description Types and limits of the owner help catalog (HOS-2333, spec
 * HOS-2335 §5.4, owner decision D-3).
 *
 * `import type` only, on purpose: the catalog guard (`scripts/check-owner-help.ts`)
 * loads the catalog directly and must not drag the API runtime in.
 */

import type {
    PortalDestination,
    PortalListingVertical,
    PortalSectionId
} from '@repo/portal-routes';

/**
 * Who a topic is for. `any` topics answer every owner. `host` is an
 * accommodation owner, `venue` and `experience` their own vertical, `provider` a
 * directory provider.
 */
export type OwnerHelpAudience = 'host' | 'venue' | 'experience' | 'provider' | 'any';

/** Audiences a caller can ask for. `any` is a property of topics, not of callers. */
export const OWNER_HELP_CALLER_AUDIENCES = ['host', 'venue', 'experience', 'provider'] as const;

/** An audience a caller can ask for. */
export type OwnerHelpCallerAudience = (typeof OWNER_HELP_CALLER_AUDIENCES)[number];

/**
 * A section of the editor of one of the OWNER'S OWN listings. A help topic is
 * static, so it cannot name a listing id; `get_help` fills it in from the
 * owner's listings of that vertical. The guard checks the section's page exists.
 */
export interface OwnEditorSectionDestination {
    readonly kind: 'ownEditorSection';
    /** The vertical whose editor the section belongs to. */
    readonly vertical: PortalListingVertical;
    /** A catalog section id of that vertical. */
    readonly section: PortalSectionId;
}

/**
 * Where a topic sends the owner: any portal destination that names no record,
 * or an editor section of the owner's own listings. `label` overrides the
 * destination's default Spanish label.
 */
export type OwnerHelpDestination = (
    | Exclude<PortalDestination, { readonly kind: 'listingEditor' }>
    | OwnEditorSectionDestination
) & { readonly label?: string };

/** One how-to topic. */
export interface OwnerHelpTopic {
    /** Stable id (`kebab-case`), the `topicId` input of `get_help`. Never reused. */
    readonly id: string;
    /** Who the topic is for. */
    readonly audience: OwnerHelpAudience;
    /** Spanish title. */
    readonly title: string;
    /** Spanish words and short phrases a question is matched against. */
    readonly keywords: readonly string[];
    /** Spanish steps, at most {@link OWNER_HELP_MAX_STEPS}. */
    readonly steps: readonly string[];
    /** The pages the topic links to. */
    readonly destinations: readonly OwnerHelpDestination[];
    /**
     * The FAQ item this topic extends, as `<category>.<item>` (for example
     * `owners.pause`), so the prose is not duplicated. The guard checks it exists
     * in the es FAQ.
     */
    readonly faqKey?: string;
    /** The day the topic was last checked against the portal (`YYYY-MM-DD`). */
    readonly reviewedAt: string;
}

/** Most steps a topic may have. */
export const OWNER_HELP_MAX_STEPS = 8;

/** A topic whose `reviewedAt` is older than this many days is reported as stale. */
export const OWNER_HELP_STALE_DAYS = 180;
