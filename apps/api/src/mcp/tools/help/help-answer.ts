/**
 * @file help-answer.ts
 * @description Projects a help article to one topic of a `get_help` answer
 * (HOS-2410 PR-12, AC-17 to AC-20).
 *
 * A topic is built in two steps so the listings read stays conditional:
 * {@link planHelpTopic} resolves the tokens of the text the topic returns and
 * collects the destinations they name; once the handler knows whether any of
 * those needs the caller's listings, {@link finishHelpTopic} builds the links.
 *
 * Tokens resolve as `docs/data-model.md` §5.2 fixes for `get_help`:
 * - `{{limit:…}}` reads "el tope de tu plan" (never a number), and the plans
 *   page of its vertical is appended to the links;
 * - `{{link:…}}` reads its label (or the destination's default label), and its
 *   destination is appended to the links;
 * - `{{article:<id>}}` reads its label (or the target's title) followed by
 *   "(tema `<id>`)", so the agent can fetch it with `topicId`.
 *
 * Depth: a `full` topic (the one fetched by `topicId`, or the best match of a
 * question) carries `sections` and `related`; a `brief` one carries `summary`
 * and `steps` only, which keeps a three-topic answer inside the budget (AC-18).
 */

import {
    findHelpArticle,
    HELP_NEUTRAL_LIMIT_TEXT,
    type HelpArticle,
    type HelpDestination,
    helpDestinationLabel,
    resolveHelpText
} from '@repo/help';
import type { PortalLocale } from '@repo/portal-routes';
import type { OwnerHelpCallerAudience } from './help-audience';
import {
    appendTokenHelpLinks,
    buildHelpLinks,
    type HelpLink,
    type HelpOwnListing,
    topicNeedsOwnListings
} from './help-links';

/** How much of an article a topic carries. */
export type HelpTopicDepth = 'full' | 'brief';

/** The authored body of a full topic, tokens resolved. */
export interface HelpTopicSections {
    /** «Qué podés hacer». */
    readonly canDo: string;
    /** «Qué esperar». */
    readonly expect: string;
    /** «Qué NO esperar». */
    readonly notExpect: string;
    /** «Problemas comunes». */
    readonly troubleshooting: string;
    /** The prose after the steps of «Cómo se hace», present only when the article has some. */
    readonly howToNotes?: string;
}

/** One related topic of a full topic. */
export interface HelpRelatedTopic {
    /** The topic id, the `topicId` input to fetch it. */
    readonly id: string;
    /** Spanish title. */
    readonly title: string;
}

/** One topic in the answer. */
export interface HelpTopicAnswer {
    /** The topic id, the `topicId` input to fetch it again. */
    readonly id: string;
    /** Spanish title. */
    readonly title: string;
    /** One Spanish sentence saying what the topic covers. */
    readonly summary: string;
    /** Spanish steps, in order, tokens resolved. */
    readonly steps: readonly string[];
    /** The rest of the body; only on a full topic. */
    readonly sections?: HelpTopicSections;
    /** The topics the article relates to, for the caller's audience; only on a full topic. */
    readonly related?: readonly HelpRelatedTopic[];
    /** Portal pages to do the steps in, then the pages the returned text links to. */
    readonly links: readonly HelpLink[];
}

/** A topic whose text is resolved but whose links are not built yet. */
export interface PlannedHelpTopic {
    /** The article. */
    readonly article: HelpArticle;
    /** The answer without its links. */
    readonly answer: Omit<HelpTopicAnswer, 'links'>;
    /** The destinations the returned text names through its tokens, in text order. */
    readonly tokenDestinations: readonly HelpDestination[];
}

/** The verticals that have a public plans page. */
const PLANS_PAGE_VERTICALS = ['accommodation', 'venue', 'experience'] as const;

/** The plans-page destination for a vertical, or `undefined` when it has no plans page. */
function plansDestinationFor(vertical: string | undefined): HelpDestination | undefined {
    const match = PLANS_PAGE_VERTICALS.find((candidate) => candidate === vertical);
    if (match === undefined) {
        return undefined;
    }
    return { kind: 'plans', vertical: match };
}

/** Resolves one text for the agent, collecting the destinations its tokens name. */
function resolveForAgent({
    text,
    article,
    destinations
}: {
    readonly text: string;
    readonly article: HelpArticle;
    readonly destinations: HelpDestination[];
}): string {
    return resolveHelpText({
        text,
        article,
        findArticle: ({ id }) => findHelpArticle({ id }),
        resolvers: {
            limit: ({ vertical }) => {
                const plans = plansDestinationFor(vertical);
                if (plans !== undefined) {
                    destinations.push(plans);
                }
                return HELP_NEUTRAL_LIMIT_TEXT;
            },
            link: ({ destination, label }) => {
                destinations.push(label === undefined ? destination : { ...destination, label });
                return label ?? helpDestinationLabel({ destination });
            },
            article: ({ id, target, label }) => `${label ?? target?.title ?? id} (tema \`${id}\`)`
        }
    });
}

/** Whether an article serves the audience; every article when there is none. */
function servesAudience({
    article,
    audience
}: {
    readonly article: HelpArticle;
    readonly audience?: OwnerHelpCallerAudience;
}): boolean {
    return audience === undefined || article.audiences.includes(audience);
}

/**
 * Resolves the text a topic returns and collects the destinations it names.
 *
 * @param args.article - The article
 * @param args.depth - `full` for the topic that carries the body, `brief` otherwise
 * @param args.audience - The kind of owner asking; filters `related`
 * @returns The topic without links, and its token destinations
 */
export function planHelpTopic({
    article,
    depth,
    audience
}: {
    readonly article: HelpArticle;
    readonly depth: HelpTopicDepth;
    readonly audience?: OwnerHelpCallerAudience;
}): PlannedHelpTopic {
    const destinations: HelpDestination[] = [];
    const resolve = (text: string) => resolveForAgent({ text, article, destinations });
    const steps = article.sections.howTo.steps.map(resolve);
    const base = { id: article.id, title: article.title, summary: article.summary, steps };
    if (depth === 'brief') {
        return { article, answer: base, tokenDestinations: destinations };
    }
    const { canDo, howTo, expect, notExpect, troubleshooting } = article.sections;
    const notes = howTo.after.trim();
    const sections: HelpTopicSections = {
        canDo: resolve(canDo),
        expect: resolve(expect),
        notExpect: resolve(notExpect),
        troubleshooting: resolve(troubleshooting),
        ...(notes.length > 0 ? { howToNotes: resolve(notes) } : {})
    };
    const related = article.related.flatMap((id) => {
        const target = findHelpArticle({ id });
        return target !== undefined && servesAudience({ article: target, audience })
            ? [{ id: target.id, title: target.title }]
            : [];
    });
    return {
        article,
        answer: { ...base, sections, related },
        tokenDestinations: destinations
    };
}

/**
 * Whether building a planned topic's links needs the caller's listings: one of
 * its own destinations or of its token destinations is an editor section of
 * the audience.
 *
 * @param args.plan - The planned topic
 * @param args.audience - The kind of owner asking
 * @returns `true` when the listings are needed
 */
export function planNeedsOwnListings({
    plan,
    audience
}: {
    readonly plan: PlannedHelpTopic;
    readonly audience?: OwnerHelpCallerAudience;
}): boolean {
    return topicNeedsOwnListings({
        topic: { destinations: [...plan.article.destinations, ...plan.tokenDestinations] },
        audience
    });
}

/**
 * Builds the links of a planned topic: the article's own links first, exactly
 * as before PR-12, then the destinations its returned text named.
 *
 * @param args - The planned topic, the audience, the caller's listings, the site URL and locale
 * @returns The finished topic
 */
export function finishHelpTopic({
    plan,
    audience,
    ownListings,
    siteUrl,
    locale
}: {
    readonly plan: PlannedHelpTopic;
    readonly audience?: OwnerHelpCallerAudience;
    readonly ownListings: readonly HelpOwnListing[] | undefined;
    readonly siteUrl: string;
    readonly locale?: PortalLocale;
}): HelpTopicAnswer {
    const own = buildHelpLinks({ topic: plan.article, audience, ownListings, siteUrl, locale });
    const links = appendTokenHelpLinks({
        links: own,
        tokenDestinations: plan.tokenDestinations,
        audience,
        ownListings,
        siteUrl,
        locale
    });
    return { ...plan.answer, links };
}
