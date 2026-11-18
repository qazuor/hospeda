/**
 * @module data/owner-help
 *
 * The curated owner help catalog (HOS-2333, spec HOS-2335 §5.4, owner decision
 * D-3): how-to topics for the people who run a listing on Hospeda, in Spanish,
 * each with its steps, the portal pages it links to and the day it was last
 * checked. `get_help` answers from it. It is a typed catalog in the API, in the
 * style of `data/whats-new`, until the web gets a help page and it moves to
 * `@repo/i18n`.
 *
 * ## Authoring conventions
 *
 * - **Say what the portal does today.** Every step names a button, a section or a
 *   page that exists, with the label the portal shows. Verify against the web
 *   pages, never from memory. A flow you cannot verify stays out.
 * - **Never write a price, a plan name or a plan limit.** They are DB rows and
 *   change without a deploy (the commercial-values guard forbids price
 *   constants). Point to the plans page or to the subscription page.
 * - **Changed a portal flow? Update its topic in the same PR**, and bump its
 *   `reviewedAt`. A topic older than {@link OWNER_HELP_STALE_DAYS} days is
 *   reported by `pnpm check:owner-help`.
 * - **Links name a destination, never a URL.** `destinations` go through the
 *   portal route map (`mcp/portal/`), and `scripts/check-owner-help.ts` fails
 *   when one stops resolving to a page in `apps/web`.
 * - **`faqKey` extends the FAQ, it does not copy it.** The guard checks the item
 *   exists in the es FAQ.
 * - **ids are stable.** Never reuse a retired id: a refusal may carry it.
 * - **Validation**: the catalog is parsed at import time. A malformed topic
 *   throws and stops the API from starting, which is intended.
 *
 * @see apps/api/src/mcp/tools/help/get-help.ts
 */

import { z } from 'zod';
import { OWNER_HELP_MAX_STEPS, type OwnerHelpTopic } from './owner-help.types';
import { ACCOUNT_HELP_TOPICS } from './topics/account-topics';
import { COMMUNITY_HELP_TOPICS } from './topics/community-topics';
import { LISTING_HELP_TOPICS } from './topics/listing-topics';

export type {
    OwnEditorSectionDestination,
    OwnerHelpAudience,
    OwnerHelpCallerAudience,
    OwnerHelpDestination,
    OwnerHelpTopic
} from './owner-help.types';
export {
    OWNER_HELP_CALLER_AUDIENCES,
    OWNER_HELP_MAX_STEPS,
    OWNER_HELP_STALE_DAYS
} from './owner-help.types';

/** Shape every topic must have. The destinations are typed by the compiler and checked by the guard. */
export const OwnerHelpTopicSchema = z
    .object({
        id: z
            .string()
            .max(64)
            .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
        audience: z.enum(['host', 'venue', 'experience', 'provider', 'any']),
        title: z.string().min(1).max(120),
        keywords: z.array(z.string().min(1)).min(1),
        steps: z.array(z.string().min(1)).min(1).max(OWNER_HELP_MAX_STEPS),
        destinations: z.array(z.looseObject({ kind: z.string() })),
        faqKey: z
            .string()
            .regex(/^[a-z]+\.[A-Za-z0-9]+$/)
            .optional(),
        reviewedAt: z.iso.date()
    })
    .strict();

/** The whole catalog: topic ids are unique. */
export const OwnerHelpCatalogSchema = z.array(OwnerHelpTopicSchema).superRefine((topics, ctx) => {
    const seen = new Set<string>();
    for (const [index, topic] of topics.entries()) {
        if (seen.has(topic.id)) {
            ctx.addIssue({
                code: 'custom',
                path: [index, 'id'],
                message: `Duplicate owner help topic id: ${topic.id}`
            });
        }
        seen.add(topic.id);
    }
});

const CATALOG: readonly OwnerHelpTopic[] = [
    ...LISTING_HELP_TOPICS,
    ...ACCOUNT_HELP_TOPICS,
    ...COMMUNITY_HELP_TOPICS
];

OwnerHelpCatalogSchema.parse(CATALOG);

/** Every owner help topic, in the order `get_help` ranks ties. */
export const OWNER_HELP_TOPICS: readonly OwnerHelpTopic[] = CATALOG;
