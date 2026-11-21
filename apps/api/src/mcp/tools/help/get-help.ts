/**
 * @file get-help.ts
 * @description Tool `get_help` (HOS-2333, spec HOS-2335 §6.8, AC-C40 to AC-C43):
 * "how do I do X in Hospeda" for the people who run a listing.
 *
 * It answers from the curated help catalog (`@repo/help`, Markdown articles
 * compiled to a committed index, HOS-2410), never from the model's memory: each
 * article carries the real steps («Cómo se hace») and the portal pages to do
 * them in. It is a read with no resource of its own, so there is nothing to
 * own (`READ_OWN`, like the other owner reads).
 *
 * - **Search.** A normalized keyword match over the catalog, best three topics
 *   (the shared search of `@repo/help`, which the web help center also uses). `topicId` fetches one topic directly.
 * - **Links.** Built by `help-links.ts` through the portal route map. The editor
 *   links are filled in from the caller's own listings, which `list_my_listings`
 *   already exposes, so no new access is involved. A listing list that cannot be
 *   read never fails the answer: the links fall back to the list pages.
 * - **No match.** An empty `topics` plus the FAQ and contact links, and the
 *   description forbids inventing steps.
 * - **Untrusted input.** The question is only compared against the catalog. It
 *   is never echoed in the result, in a link or in a log.
 * - **Tourists.** The catalog holds no tourist topic, so a traveler's question
 *   finds nothing (NG-4).
 * - **Audience.** An article lists its audiences; a caller only gets the ones
 *   listing theirs (HOS-2410 data-model §7: a provider no longer gets the
 *   listing topics the old `any` audience gave it). `partner` is an audience
 *   since HOS-2410 PR-12 (AC-19).
 * - **Body (HOS-2410 PR-12).** Every topic carries its `summary`; the topic
 *   fetched by `topicId`, or the best match of a question, also carries the
 *   other `sections` and the `related` topics (AC-17, AC-18). Tokens are
 *   resolved by `help-answer.ts`; the pages they name are appended to the
 *   topic's links after the ones it always had, so those keep their positions.
 */

import {
    findHelpArticle,
    HELP_ARTICLES,
    HELP_MAX_TOPICS,
    type HelpArticle,
    searchOwnerHelp
} from '@repo/help';
import type { PortalLocale } from '@repo/portal-routes';
import type { Actor } from '@repo/service-core';
import { z } from 'zod';
import { env } from '../../../utils/env';
import { apiLogger } from '../../../utils/logger';
import { readMyListings } from '../listing/list-my-listings';
import { defineTool, type ToolHandlerResult } from '../tool-definition';
import {
    finishHelpTopic,
    type HelpTopicAnswer,
    type PlannedHelpTopic,
    planHelpTopic,
    planNeedsOwnListings
} from './help-answer';
import { OWNER_HELP_CALLER_AUDIENCES, type OwnerHelpCallerAudience } from './help-audience';
import { buildFallbackHelpLinks, type HelpLink, type HelpOwnListing } from './help-links';

export type { HelpRelatedTopic, HelpTopicAnswer, HelpTopicSections } from './help-answer';

/** Longest question the tool accepts. */
export const GET_HELP_QUESTION_MAX_CHARS = 300;

/** Longest topic id the tool accepts. The catalog's ids are far shorter. */
const TOPIC_ID_MAX_CHARS = 64;

/**
 * Input schema of `get_help`. One flat object (C-2); "exactly one of `question`
 * and `topicId`" lives in the `superRefine`.
 */
export const GetHelpInputSchema = z
    .object({
        question: z
            .string()
            .trim()
            .min(1)
            .max(GET_HELP_QUESTION_MAX_CHARS)
            .optional()
            .describe(
                `What the user wants to do or understand, in their own words (up to ${GET_HELP_QUESTION_MAX_CHARS} characters). Send this or topicId.`
            ),
        topicId: z
            .string()
            .max(TOPIC_ID_MAX_CHARS)
            .regex(/^[a-z0-9-]+$/)
            .optional()
            .describe(
                'The id of a help topic, to fetch it directly (ids come from earlier get_help answers). Send this or question.'
            ),
        audience: z
            .enum(OWNER_HELP_CALLER_AUDIENCES)
            .optional()
            .describe(
                'The kind of user asking, to keep only the topics and links that apply: host (accommodation owner), venue, experience, provider (directory provider) or partner (Hospeda partner). Omit it when unknown.'
            )
    })
    .strict()
    .superRefine((input, ctx) => {
        if ((input.question === undefined) === (input.topicId === undefined)) {
            ctx.addIssue({
                code: 'custom',
                path: ['question'],
                message: 'send exactly one of question and topicId'
            });
        }
    });

/** Result of `get_help`. */
export interface GetHelpResult {
    /** The matching topics, best first; empty when there is no guide for the question. */
    readonly topics: readonly HelpTopicAnswer[];
    /** Present only when `topics` is empty: the FAQ and the contact page. */
    readonly fallbackLinks?: readonly HelpLink[];
    /** Present only when `topics` is empty: what to do instead. */
    readonly note?: string;
}

/** What the model is told when nothing matched. */
export const GET_HELP_NO_MATCH_NOTE =
    'No help topic matches this. Do not improvise steps: tell the user there is no guide for it yet and give them fallbackLinks.';

/**
 * The caller's own listings for the editor links, or `undefined` when they
 * cannot be read. Never throws: help must not fail because a list did.
 */
async function readHelpOwnListings({
    actor
}: {
    readonly actor: Actor;
}): Promise<readonly HelpOwnListing[] | undefined> {
    try {
        const mine = await readMyListings({ actor });
        if (mine.error) {
            return undefined;
        }
        return mine.data.listings.map((listing) => ({
            vertical: listing.vertical,
            id: listing.id,
            publicationStatus: listing.publicationStatus
        }));
    } catch (error) {
        apiLogger.warn(
            { error: error instanceof Error ? error.message : String(error) },
            'get_help could not read the owner listings; falling back to list links'
        );
        return undefined;
    }
}

/** The topic with this id as a list: empty when the catalog has none. */
function topicById({ id }: { readonly id: string }): readonly HelpArticle[] {
    const topic = findHelpArticle({ id });
    return topic === undefined ? [] : [topic];
}

/**
 * Plans the topics of an answer: a topic fetched by id, or the best match of a
 * question, carries the whole body; the other matches are brief (AC-18).
 */
function planTopics({
    topics,
    audience
}: {
    readonly topics: readonly HelpArticle[];
    readonly audience?: OwnerHelpCallerAudience;
}): readonly PlannedHelpTopic[] {
    return topics.map((article, index) =>
        planHelpTopic({ article, depth: index === 0 ? 'full' : 'brief', audience })
    );
}

/** Builds the answer from the planned topics, filling in their links. */
function toAnswer({
    plans,
    audience,
    ownListings,
    locale
}: {
    readonly plans: readonly PlannedHelpTopic[];
    readonly audience?: OwnerHelpCallerAudience;
    readonly ownListings: readonly HelpOwnListing[] | undefined;
    readonly locale?: PortalLocale;
}): GetHelpResult {
    const siteUrl = env.HOSPEDA_SITE_URL;
    if (plans.length === 0) {
        return {
            topics: [],
            fallbackLinks: buildFallbackHelpLinks({ siteUrl, locale }),
            note: GET_HELP_NO_MATCH_NOTE
        };
    }
    return {
        topics: plans.map((plan) =>
            finishHelpTopic({ plan, audience, ownListings, siteUrl, locale })
        )
    };
}

/**
 * `get_help`: read-only, available to an unverified email exactly as the other
 * owner reads are (`READ_OWN`).
 */
export const getHelpTool = defineTool({
    name: 'get_help',
    title: 'Ayuda para usar Hospeda',
    description: `Answers "how do I do X in Hospeda" for the people who run a listing or an account (accommodation, venue or experience owners, directory providers and Hospeda partners), from a curated Spanish help catalog. Send the user's question in "question" (up to ${GET_HELP_QUESTION_MAX_CHARS} characters), or a "topicId" from an earlier answer to fetch that topic directly, and optionally "audience" (host = accommodation owner, venue, experience, provider, partner) to keep only the topics and links that apply to them. It returns at most ${HELP_MAX_TOPICS} topics. Each has an id, a title, a one-sentence "summary", the ordered "steps" and the "links" to the portal pages where the steps are done; links to an editor section point at the user's own listings. The topic fetched by topicId, or the first topic of a question, also has "sections" (canDo: what the user can do; expect: what to expect; notExpect: what NOT to expect; troubleshooting: common problems; Markdown) and "related" topics ({id, title}); fetch the others with topicId when the user needs more. A text that says "(tema \`<id>\`)" names another topic you can fetch with that topicId. Relay the steps and links as they are, in Spanish: do not add, reorder or invent steps, buttons, prices, plan names or limits that are not in the result (plans and prices are never in the help: "el tope de tu plan" means the limit depends on the user's plan, so use the plan links or get_my_plan). If "topics" is empty there is no guide for that question: do not improvise an answer, tell the user so and give them the "fallbackLinks" (the FAQ and the contact page). It covers owners, providers and partners only; a traveler's question finds nothing. The question is only used to search the catalog.`,
    inputSchema: GetHelpInputSchema,
    isWrite: false,
    emailUnverifiedOperation: 'READ_OWN',
    handler: async ({ actor, input, context }): Promise<ToolHandlerResult<GetHelpResult>> => {
        const { question, topicId, audience } = input;

        const topics =
            topicId === undefined
                ? searchOwnerHelp({ topics: HELP_ARTICLES, question: question ?? '', audience })
                : topicById({ id: topicId });

        const plans = planTopics({ topics, audience });
        const ownListings = plans.some((plan) => planNeedsOwnListings({ plan, audience }))
            ? await readHelpOwnListings({ actor })
            : undefined;

        return { data: toAnswer({ plans, audience, ownListings, locale: context.locale }) };
    }
});
