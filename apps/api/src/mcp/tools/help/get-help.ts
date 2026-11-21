/**
 * @file get-help.ts
 * @description Tool `get_help` (HOS-2333, spec HOS-2335 §6.8, AC-C40 to AC-C43):
 * "how do I do X in Hospeda" for the people who run a listing.
 *
 * It answers from the curated owner help catalog (`data/owner-help`), never from
 * the model's memory: each topic carries the real steps and the portal pages to
 * do them in. It is a read with no resource of its own, so there is nothing to
 * own (`READ_OWN`, like the other owner reads).
 *
 * - **Search.** A normalized keyword match over the catalog, best three topics
 *   (`help-search.ts`). `topicId` fetches one topic directly.
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
 */

import type { PortalLocale } from '@repo/portal-routes';
import type { Actor } from '@repo/service-core';
import { z } from 'zod';
import { OWNER_HELP_TOPICS } from '../../../data/owner-help/owner-help';
import {
    OWNER_HELP_CALLER_AUDIENCES,
    type OwnerHelpCallerAudience,
    type OwnerHelpTopic
} from '../../../data/owner-help/owner-help.types';
import { env } from '../../../utils/env';
import { apiLogger } from '../../../utils/logger';
import { readMyListings } from '../listing/list-my-listings';
import { defineTool, type ToolHandlerResult } from '../tool-definition';
import {
    buildFallbackHelpLinks,
    buildHelpLinks,
    type HelpLink,
    type HelpOwnListing,
    topicNeedsOwnListings
} from './help-links';
import { findOwnerHelpTopic, HELP_MAX_TOPICS, searchOwnerHelp } from './help-search';

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
                'The kind of user asking, to keep only the topics and links that apply: host (accommodation owner), venue, experience or provider (directory provider). Omit it when unknown.'
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

/** One topic in the answer. */
export interface HelpTopicAnswer {
    /** The topic id, the `topicId` input to fetch it again. */
    readonly id: string;
    /** Spanish title. */
    readonly title: string;
    /** Spanish steps, in order. */
    readonly steps: readonly string[];
    /** Portal pages to do the steps in. */
    readonly links: readonly HelpLink[];
}

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
function topicById({ id }: { readonly id: string }): readonly OwnerHelpTopic[] {
    const topic = findOwnerHelpTopic({ topics: OWNER_HELP_TOPICS, id });
    return topic === undefined ? [] : [topic];
}

/** Projects the topics to the answer, filling in their links. */
function toAnswer({
    topics,
    audience,
    ownListings,
    locale
}: {
    readonly topics: readonly OwnerHelpTopic[];
    readonly audience?: OwnerHelpCallerAudience;
    readonly ownListings: readonly HelpOwnListing[] | undefined;
    readonly locale?: PortalLocale;
}): GetHelpResult {
    const siteUrl = env.HOSPEDA_SITE_URL;
    if (topics.length === 0) {
        return {
            topics: [],
            fallbackLinks: buildFallbackHelpLinks({ siteUrl, locale }),
            note: GET_HELP_NO_MATCH_NOTE
        };
    }
    return {
        topics: topics.map((topic) => ({
            id: topic.id,
            title: topic.title,
            steps: topic.steps,
            links: buildHelpLinks({ topic, audience, ownListings, siteUrl, locale })
        }))
    };
}

/**
 * `get_help`: read-only, available to an unverified email exactly as the other
 * owner reads are (`READ_OWN`).
 */
export const getHelpTool = defineTool({
    name: 'get_help',
    title: 'Ayuda para usar Hospeda',
    description: `Answers "how do I do X in Hospeda" for the people who run a listing (accommodation, venue or experience owners and directory providers), from a curated Spanish help catalog. Send the user's question in "question" (up to ${GET_HELP_QUESTION_MAX_CHARS} characters), or a "topicId" from an earlier answer to fetch that topic directly, and optionally "audience" (host = accommodation owner, venue, experience, provider) to keep only the topics and links that apply to them. It returns at most ${HELP_MAX_TOPICS} topics, each with an id, a title, the ordered "steps" and the "links" to the portal pages where the steps are done; links to an editor section point at the user's own listings. Relay the steps and links as they are, in Spanish: do not add, reorder or invent steps, buttons, prices, plan names or limits that are not in the result (plans and prices are never in the help: use the plan links). If "topics" is empty there is no guide for that question: do not improvise an answer, tell the user so and give them the "fallbackLinks" (the FAQ and the contact page). It covers owners and providers only; a traveler's question finds nothing. The question is only used to search the catalog.`,
    inputSchema: GetHelpInputSchema,
    isWrite: false,
    emailUnverifiedOperation: 'READ_OWN',
    handler: async ({ actor, input, context }): Promise<ToolHandlerResult<GetHelpResult>> => {
        const { question, topicId, audience } = input;

        const topics =
            topicId === undefined
                ? searchOwnerHelp({ topics: OWNER_HELP_TOPICS, question: question ?? '', audience })
                : topicById({ id: topicId });

        const ownListings = topics.some((topic) => topicNeedsOwnListings({ topic, audience }))
            ? await readHelpOwnListings({ actor })
            : undefined;

        return { data: toAnswer({ topics, audience, ownListings, locale: context.locale }) };
    }
});
