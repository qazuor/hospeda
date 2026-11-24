/**
 * HOS-2410 PR-12 (AC-17 to AC-20) — `get_help` returns the body of an article:
 * `summary`, `sections` and `related` on the topic that carries the body, tokens
 * resolved for the agent, and the `partner` audience.
 *
 * The listings are spied on the service prototypes, as in `get-help.test.ts`, so
 * the real `list_my_listings` read runs. The budget test (AC-18) is a property
 * over every three-article combination of the real index.
 *
 * @module test/mcp/tools/help/get-help.body
 */

import { HELP_ARTICLES, type HelpArticle } from '@repo/help';
import { PublicationStatusEnum } from '@repo/schemas';
import {
    AccommodationService,
    type Actor,
    ExperienceService,
    VenueService
} from '@repo/service-core';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    GetHelpInputSchema,
    type GetHelpResult,
    getHelpTool
} from '../../../../src/mcp/tools/help/get-help';
import {
    finishHelpTopic,
    type HelpTopicDepth,
    planHelpTopic
} from '../../../../src/mcp/tools/help/help-answer';
import type { HelpOwnListing } from '../../../../src/mcp/tools/help/help-links';
import {
    MCP_RESULT_MAX_CHARS,
    measureResultChars
} from '../../../../src/mcp/tools/response-budget';
import { runTool } from '../../../../src/mcp/tools/run-tool';
import { env, validateApiEnv } from '../../../../src/utils/env';

const OWNER_ID = '1f2e3d4c-5b6a-4789-8abc-def012345678';
const ACC_ID = 'a1111111-1111-4111-8111-111111111111';
const VEN_ID = 'b1111111-1111-4111-8111-111111111111';
const EXP_ID = 'c1111111-1111-4111-8111-111111111111';

const actor = {
    id: OWNER_ID,
    roles: ['HOST'],
    permissions: [],
    emailVerified: true
} as unknown as Actor;

const row = (id: string) => ({
    id,
    ownerId: OWNER_ID,
    name: 'X',
    slug: 'x',
    publicationStatus: PublicationStatusEnum.PUBLISHED
});

const site = () => env.HOSPEDA_SITE_URL.replace(/\/+$/, '');

/** The data of a successful call; fails the test otherwise. */
async function answer(input: Record<string, unknown>): Promise<GetHelpResult> {
    const outcome = await runTool({
        definition: getHelpTool,
        actor,
        input,
        context: { channel: 'mcp' }
    });
    if (!outcome.ok) {
        throw new Error(`get_help failed: ${JSON.stringify(outcome)}`);
    }
    return outcome.data as GetHelpResult;
}

/** A real article by id; fails the test when the index has none. */
function article(id: string): HelpArticle {
    const found = HELP_ARTICLES.find((candidate) => candidate.id === id);
    if (found === undefined) {
        throw new Error(`no article ${id}`);
    }
    return found;
}

/** A copy of a real article with one extra step. */
function withStep({ base, step }: { readonly base: HelpArticle; readonly step: string }) {
    return {
        ...base,
        sections: {
            ...base.sections,
            howTo: { ...base.sections.howTo, steps: [...base.sections.howTo.steps, step] }
        }
    };
}

/** Every raw token left in a value. */
const rawTokens = (value: unknown) => JSON.stringify(value).match(/\{\{[^}]*\}\}/g) ?? [];

describe('get_help body (HOS-2410 PR-12)', () => {
    beforeAll(() => {
        validateApiEnv();
    });

    beforeEach(() => {
        vi.spyOn(AccommodationService.prototype, 'list').mockImplementation((async () => ({
            data: { items: [row(ACC_ID)], total: 1 }
        })) as never);
        vi.spyOn(VenueService.prototype, 'listOwn').mockImplementation((async () => ({
            data: { listings: [row(VEN_ID)] }
        })) as never);
        vi.spyOn(ExperienceService.prototype, 'listOwn').mockImplementation((async () => ({
            data: { listings: [row(EXP_ID)] }
        })) as never);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('AC-17 a topic by id carries the body', () => {
        it('has summary, the four sections and related {id,title}', async () => {
            // Act
            const result = await answer({ topicId: 'photos' });

            // Assert
            const topic = result.topics[0];
            const source = article('photos');
            expect(topic?.summary).toBe(source.summary);
            expect(Object.keys(topic?.sections ?? {}).sort()).toEqual([
                'canDo',
                'expect',
                'notExpect',
                'troubleshooting'
            ]);
            expect(topic?.related).toEqual(
                source.related.map((id) => ({ id, title: article(id).title }))
            );
        });

        it.each(
            HELP_ARTICLES.map((entry) => [entry.id])
        )('leaves no raw token in %s', async (id) => {
            // Act
            const result = await answer({ topicId: id });

            // Assert
            expect(rawTokens(result)).toEqual([]);
        });

        it('turns an article token into its label and "(tema `<id>`)"', async () => {
            // Act: ai-assistants writes {{article:reviews|leer tus reseñas}}.
            const result = await answer({ topicId: 'ai-assistants' });

            // Assert
            expect(result.topics[0]?.sections?.canDo).toContain(
                'leer tus reseñas (tema `reviews`)'
            );
        });

        it('turns a link token into its label and appends its page to the links', async () => {
            // Act: addons writes {{link:addons|Complementos}}.
            const result = await answer({ topicId: 'addons' });

            // Assert
            expect(result.topics[0]?.sections?.canDo).toContain('desde Complementos.');
            expect(result.topics[0]?.links.map((link) => link.url)).toContain(
                `${site()}/es/mi-cuenta/complementos/`
            );
        });

        it('keeps the related topics of the audience that asked', async () => {
            // Act
            const host = await answer({ topicId: 'benefit-usage', audience: 'host' });

            // Assert: benefit-usage relates to a provider-only topic, left out for a host.
            expect(host.topics[0]?.related?.map((topic) => topic.id)).toEqual([
                'provider-directory'
            ]);
        });

        it('fills a section link token from the caller own listings', () => {
            // Arrange
            const base = article('calendar');
            const ownListings: readonly HelpOwnListing[] = [
                {
                    vertical: 'accommodation',
                    id: ACC_ID,
                    publicationStatus: PublicationStatusEnum.PUBLISHED
                }
            ];

            // Act
            const topic = finishHelpTopic({
                plan: planHelpTopic({ article: base, depth: 'full' }),
                ownListings,
                siteUrl: site()
            });

            // Assert
            expect(topic.links.map((link) => link.url)).toContain(
                `${site()}/es/mi-cuenta/propiedades/${ACC_ID}/editar/calendario/`
            );
        });
    });

    describe('AC-18 a question answers one body and the budget holds', () => {
        it('gives sections only to the first topic', async () => {
            // Act
            const result = await answer({ question: 'servicios y comodidades fotos publicar' });

            // Assert
            expect(result.topics.length).toBeGreaterThan(1);
            expect(result.topics[0]?.sections).toBeDefined();
            for (const topic of result.topics.slice(1)) {
                expect(topic.sections).toBeUndefined();
                expect(topic.related).toBeUndefined();
                expect(topic.summary.length).toBeGreaterThan(0);
                expect(topic.steps.length).toBeGreaterThan(0);
            }
        });

        it('stays within the budget for every three-article combination of the catalog', () => {
            // Arrange: three listings per vertical, the most one destination expands to.
            const ownListings: readonly HelpOwnListing[] = (
                ['accommodation', 'venue', 'experience'] as const
            ).flatMap((vertical, v) =>
                [0, 1, 2].map((index) => ({
                    vertical,
                    id: `${v}${index}111111-1111-4111-8111-111111111111`,
                    publicationStatus: PublicationStatusEnum.PUBLISHED
                }))
            );
            const articles = HELP_ARTICLES;
            const topicOf = (article: HelpArticle, depth: HelpTopicDepth) =>
                finishHelpTopic({
                    plan: planHelpTopic({ article, depth }),
                    ownListings,
                    siteUrl: site()
                });
            const sizeOf = (value: unknown) => measureResultChars({ value });

            // Act: the serialized answer is `{"topics":[a,b,c]}`, so its size is the
            // empty wrapper, plus each topic, plus two commas. The largest answer is
            // therefore the largest full topic with the two largest briefs of OTHER
            // articles: exact over every triple, in O(N) instead of O(N³).
            const full = articles.map((article) => topicOf(article, 'full'));
            const brief = articles.map((article) => topicOf(article, 'brief'));
            const fullSize = full.map(sizeOf);
            const briefSize = brief.map(sizeOf);
            const byBrief = briefSize
                .map((size, index) => ({ size, index }))
                .sort((left, right) => right.size - left.size)
                .slice(0, 3);
            const wrapper = sizeOf({ topics: [] }) + 2;
            let largest = 0;
            let worst: readonly number[] = [];
            for (const [index, size] of fullSize.entries()) {
                const others = byBrief.filter((entry) => entry.index !== index).slice(0, 2);
                const total = wrapper + size + others.reduce((sum, entry) => sum + entry.size, 0);
                if (total > largest) {
                    largest = total;
                    worst = [index, ...others.map((entry) => entry.index)];
                }
            }

            // Assert: the formula matches the real serialization of the worst triple.
            expect(articles.length).toBeGreaterThanOrEqual(3);
            expect(worst).toHaveLength(3);
            expect(new Set(worst).size).toBe(3);
            const [f, b1, b2] = worst as [number, number, number];
            expect(sizeOf({ topics: [full[f], brief[b1], brief[b2]] })).toBe(largest);
            expect(largest).toBeLessThanOrEqual(MCP_RESULT_MAX_CHARS);
        });
    });

    describe('AC-19 partner audience', () => {
        it('returns only articles whose audiences include partner', async () => {
            // Act
            const result = await answer({
                question: 'conectar un asistente de IA',
                audience: 'partner'
            });

            // Assert
            expect(result.topics.length).toBeGreaterThan(0);
            for (const topic of result.topics) {
                expect(article(topic.id).audiences).toContain('partner');
            }
        });

        it('rejects an unknown audience in the input schema', () => {
            expect(
                GetHelpInputSchema.safeParse({ question: 'fotos', audience: 'tourist' }).success
            ).toBe(false);
            expect(
                GetHelpInputSchema.safeParse({ question: 'fotos', audience: 'partner' }).success
            ).toBe(true);
        });
    });

    describe('AC-20 a limit token in a step', () => {
        it('reads "el tope de tu plan", carries no number, and links the plans page', () => {
            // Arrange
            const base = withStep({
                base: article('photos'),
                step: 'Subí hasta {{limit:max_photos_per_accommodation:accommodation}} fotos.'
            });

            // Act
            const topic = finishHelpTopic({
                plan: planHelpTopic({ article: base, depth: 'brief', audience: 'host' }),
                audience: 'host',
                ownListings: [],
                siteUrl: site()
            });

            // Assert
            const step = topic.steps.at(-1) ?? '';
            expect(step).toBe('Subí hasta el tope de tu plan fotos.');
            expect(step).not.toMatch(/\d/);
            expect(topic.links.map((link) => link.url)).toContain(
                `${site()}/es/planes/anfitriones/`
            );
        });

        it('defaults the vertical of an unqualified limit to the article only one', () => {
            // Arrange: calendar has the single vertical accommodation.
            const base = withStep({
                base: article('calendar'),
                step: 'Tenés {{limit:max_photos_per_accommodation}}.'
            });

            // Act
            const topic = finishHelpTopic({
                plan: planHelpTopic({ article: base, depth: 'brief' }),
                ownListings: [],
                siteUrl: site()
            });

            // Assert
            expect(topic.steps.at(-1)).toBe('Tenés el tope de tu plan.');
            expect(topic.links.map((link) => link.url)).toContain(
                `${site()}/es/planes/anfitriones/`
            );
        });
    });

    describe('description', () => {
        it('names the new fields and the partner audience', () => {
            for (const word of ['summary', 'sections', 'related', 'partner', '(tema']) {
                expect(getHelpTool.description).toContain(word);
            }
        });
    });
});
