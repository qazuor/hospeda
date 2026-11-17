/**
 * HOS-2333 (spec HOS-2335 §5.4, D-3, AC-C41, AC-C43) — the owner help catalog:
 * about fifteen es topics, each with steps, links that resolve through the portal
 * route map, a `reviewedAt`, and a `faqKey` that exists. The guard
 * (`scripts/check-owner-help.ts`, tested in `scripts/__tests__`) holds the same
 * facts against the real web pages; these tests hold them against the route map.
 *
 * @module test/data/owner-help/owner-help
 */

import { trans } from '@repo/i18n';
import { describe, expect, it } from 'vitest';
import {
    OWNER_HELP_CALLER_AUDIENCES,
    OWNER_HELP_MAX_STEPS,
    OWNER_HELP_TOPICS,
    OwnerHelpCatalogSchema,
    OwnerHelpTopicSchema
} from '../../../src/data/owner-help/owner-help';
import type { OwnerHelpDestination } from '../../../src/data/owner-help/owner-help.types';
import {
    buildPortalUrl,
    portalDestinationTemplate
} from '../../../src/mcp/portal/build-portal-url';
import {
    EDITOR_SECTION_SLUGS,
    PORTAL_ROUTE_TEMPLATES,
    PORTAL_SECTION_PLACEHOLDER
} from '../../../src/mcp/portal/portal-routes';
import { topicServesAudience } from '../../../src/mcp/tools/help/help-search';

const SITE = 'https://hospeda.test';
const ID = '9a1f5c2e-6b7d-4e8f-a0b1-c2d3e4f5a6b7';

/** The destination as the route map takes it: an editor section gets an id. */
function toPortalDestination(destination: OwnerHelpDestination) {
    return destination.kind === 'ownEditorSection'
        ? {
              kind: 'listingEditor' as const,
              vertical: destination.vertical,
              id: ID,
              section: destination.section
          }
        : destination;
}

/** The route templates a template resolves to, with the section placeholder filled by any slug. */
const KNOWN_TEMPLATES: ReadonlySet<string> = new Set(
    Object.values(PORTAL_ROUTE_TEMPLATES).flatMap((template) =>
        template.includes(PORTAL_SECTION_PLACEHOLDER)
            ? Object.values(EDITOR_SECTION_SLUGS).flatMap((slugs) =>
                  Object.values(slugs).map((slug) =>
                      template.replace(PORTAL_SECTION_PLACEHOLDER, slug)
                  )
              )
            : [template]
    )
);

const A_TOPIC = OWNER_HELP_TOPICS[0];
if (A_TOPIC === undefined) {
    throw new Error('the help catalog is empty');
}

describe('the owner help catalog', () => {
    it('has about fifteen topics (D-3)', () => {
        expect(OWNER_HELP_TOPICS.length).toBeGreaterThanOrEqual(12);
        expect(OWNER_HELP_TOPICS.length).toBeLessThanOrEqual(20);
    });

    it('is valid as a whole, with unique kebab-case ids', () => {
        // Act
        const result = OwnerHelpCatalogSchema.safeParse(OWNER_HELP_TOPICS);

        // Assert
        expect(result.success).toBe(true);
        const ids = OWNER_HELP_TOPICS.map((topic) => topic.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('rejects a catalog with a duplicated id', () => {
        // Act
        const result = OwnerHelpCatalogSchema.safeParse([A_TOPIC, A_TOPIC]);

        // Assert
        expect(result.success).toBe(false);
    });

    it('has no tourist audience and a topic for every kind of owner that can ask (NG-4)', () => {
        // Assert
        expect(new Set(OWNER_HELP_TOPICS.map((topic) => topic.audience))).toEqual(
            new Set(['any', 'host', 'provider'])
        );
        for (const audience of OWNER_HELP_CALLER_AUDIENCES) {
            expect(
                OWNER_HELP_TOPICS.some((topic) => topicServesAudience({ topic, audience })),
                audience
            ).toBe(true);
        }
    });

    describe.each(
        OWNER_HELP_TOPICS.map((topic) => [topic.id, topic] as const)
    )('%s', (_id, topic) => {
        it(`has a title, keywords and between 1 and ${OWNER_HELP_MAX_STEPS} steps`, () => {
            expect(topic.title.trim()).not.toBe('');
            expect(topic.keywords.length).toBeGreaterThan(0);
            expect(topic.steps.length).toBeGreaterThanOrEqual(1);
            expect(topic.steps.length).toBeLessThanOrEqual(OWNER_HELP_MAX_STEPS);
        });

        it('has a reviewedAt that is a real date and not in the future (AC-C43)', () => {
            // Assert
            expect(topic.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            expect(Number.isNaN(Date.parse(topic.reviewedAt))).toBe(false);
            expect(Date.parse(`${topic.reviewedAt}T00:00:00Z`)).toBeLessThanOrEqual(Date.now());
        });

        it('links only pages the route map resolves, and every editor section of its own vertical (AC-C41)', () => {
            for (const destination of topic.destinations) {
                // Act
                const template = portalDestinationTemplate({
                    destination: toPortalDestination(destination)
                });
                const url = buildPortalUrl({
                    destination: toPortalDestination(destination),
                    siteUrl: SITE
                });

                // Assert
                expect(KNOWN_TEMPLATES.has(template), `${topic.id}: ${template}`).toBe(true);
                expect(url.startsWith(`${SITE}/es/`)).toBe(true);
                expect(url.endsWith('/')).toBe(true);
                if (destination.kind === 'ownEditorSection') {
                    const slug = (
                        EDITOR_SECTION_SLUGS[destination.vertical] as Record<string, string>
                    )[destination.section];
                    expect(
                        slug,
                        `${topic.id}: ${destination.vertical}/${destination.section}`
                    ).toBeDefined();
                    expect(url).toContain(`/editar/${slug}/`);
                }
            }
        });

        it('extends a FAQ item that exists in the es FAQ (AC-C41)', () => {
            if (topic.faqKey === undefined) {
                return;
            }
            // Arrange
            const [category, item] = topic.faqKey.split('.');

            // Assert
            expect(
                trans.es[`faq.categories.${category}.items.${item}.question`],
                `${topic.id}: ${topic.faqKey}`
            ).toBeTypeOf('string');
        });

        it('states no price and no plan limit', () => {
            // Assert: plan values are DB rows; the help points to the plans page.
            for (const step of topic.steps) {
                expect(step).not.toMatch(/\$\s*\d|\bAR\$|\d\s*(ARS|USD|pesos)\b|\d\s*%/i);
            }
        });
    });
});

describe('a topic', () => {
    const complete = { ...A_TOPIC };

    it('is valid as it is', () => {
        expect(OwnerHelpTopicSchema.safeParse(complete).success).toBe(true);
    });

    it('is rejected without a reviewedAt (AC-C43)', () => {
        // Arrange
        const { reviewedAt: _reviewedAt, ...withoutDate } = complete;

        // Assert
        expect(OwnerHelpTopicSchema.safeParse(withoutDate).success).toBe(false);
    });

    it.each([
        ['a date that is not real', '2026-13-45'],
        ['a date with a time', '2026-11-17T00:00:00Z'],
        ['free text', 'ayer']
    ])('is rejected with %s as reviewedAt', (_label, reviewedAt) => {
        expect(OwnerHelpTopicSchema.safeParse({ ...complete, reviewedAt }).success).toBe(false);
    });

    it.each([
        [
            'more steps than the limit',
            { steps: Array.from({ length: OWNER_HELP_MAX_STEPS + 1 }, () => 'Paso') }
        ],
        ['no steps', { steps: [] }],
        ['no keywords', { keywords: [] }],
        ['an id that is not kebab-case', { id: 'Subir Fotos' }],
        ['an unknown audience', { audience: 'tourist' }],
        ['an unknown field', { price: 100 }]
    ])('is rejected with %s', (_label, change) => {
        expect(OwnerHelpTopicSchema.safeParse({ ...complete, ...change }).success).toBe(false);
    });
});
