/**
 * HOS-2410 AC-15 — the help catalog moved from a TS file in the API to Markdown
 * in `@repo/help`, and `get_help({ topicId })` must answer exactly as before.
 *
 * `fixtures/get-help-pre-migration.json` was captured from the TS catalog
 * (`apps/api/src/data/owner-help`) before it was deleted, in the same PR. For
 * each of the 16 ids and each audience (none, host, venue, experience,
 * provider) it holds `id`, `title`, `steps` and `links` as the tool returned
 * them, with the configured site URL replaced by `{SITE}`. This test runs the
 * tool again and compares the serialized answers byte for byte.
 *
 * HOS-2410 PR-12 made the answer richer, and the fixture is NOT rewritten for it:
 *
 * - The topic gained `summary`, `sections` and `related` (AC-17). AC-15 is about
 *   `id`, `title`, `steps` and `links` only, so the comparison projects the topic
 *   to those four fields, in the fixture's key order.
 * - `get_help` now resolves body tokens, and the pages a `{{link}}` or
 *   `{{limit}}` token names are APPENDED to the links (`docs/data-model.md`
 *   §5.2, AC-20). The links of the fixture must still be the first links, byte
 *   for byte and in order; anything after them must come from a token of the
 *   article. A link removed, reordered or relabelled still fails.
 *
 * @module test/mcp/tools/help/get-help.migration
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { findHelpArticle, parseHelpTokens } from '@repo/help';
import { PublicationStatusEnum } from '@repo/schemas';
import {
    AccommodationService,
    type Actor,
    ExperienceService,
    VenueService
} from '@repo/service-core';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { type GetHelpResult, getHelpTool } from '../../../../src/mcp/tools/help/get-help';
import { runTool } from '../../../../src/mcp/tools/run-tool';
import { env, validateApiEnv } from '../../../../src/utils/env';

const OWNER_ID = '1f2e3d4c-5b6a-4789-8abc-def012345678';
const ACC_ID = 'a1111111-1111-4111-8111-111111111111';
const VEN_ID = 'b1111111-1111-4111-8111-111111111111';
const EXP_ID = 'c1111111-1111-4111-8111-111111111111';

/** The audiences the fixture was captured for; `all` means no audience. */
const AUDIENCES = ['all', 'host', 'venue', 'experience', 'provider'] as const;

/** The 16 topic ids of the TS catalog (HOS-2410 `docs/data-model.md` §7). */
const LEGACY_IDS = [
    'photos',
    'create-listing',
    'publish-requirements',
    'pause-resume',
    'delete-listing',
    'amenities',
    'fix-request',
    'reviews',
    'change-plan',
    'addons',
    'ai-assistants',
    'inquiries',
    'calendar',
    'provider-directory',
    'benefit-usage',
    'benefit-usage-provider'
] as const;

/** One topic as the fixture holds it. */
interface FixtureTopic {
    readonly id: string;
    readonly title: string;
    readonly steps: readonly string[];
    readonly links: readonly { readonly label: string; readonly url: string }[];
}

type Fixture = Record<string, Record<(typeof AUDIENCES)[number], FixtureTopic>>;

const FIXTURE: Fixture = JSON.parse(
    readFileSync(resolve(import.meta.dirname, 'fixtures/get-help-pre-migration.json'), 'utf8')
);

const row = (id: string) => ({
    id,
    ownerId: OWNER_ID,
    name: 'X',
    slug: 'x',
    publicationStatus: PublicationStatusEnum.PUBLISHED
});

const actor = {
    id: OWNER_ID,
    roles: ['HOST'],
    permissions: [],
    emailVerified: true
} as unknown as Actor;

describe('get_help after the migration to @repo/help (HOS-2410 AC-15)', () => {
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

    it('has the 16 legacy ids in the fixture, and only those', () => {
        expect(Object.keys(FIXTURE).sort()).toEqual([...LEGACY_IDS].sort());
    });

    describe.each(LEGACY_IDS.map((id) => [id]))('%s', (id) => {
        it.each(
            AUDIENCES.map((audience) => [audience])
        )('answers byte-equal to the pre-migration output (audience: %s)', async (audience) => {
            // Arrange
            const input = audience === 'all' ? { topicId: id } : { topicId: id, audience };
            const site = env.HOSPEDA_SITE_URL.replace(/\/+$/, '');

            // Act
            const outcome = await runTool({
                definition: getHelpTool,
                actor,
                input,
                context: { channel: 'mcp' }
            });

            // Assert
            expect(outcome.ok).toBe(true);
            const data = (outcome as { readonly data: GetHelpResult }).data;
            expect(data.topics).toHaveLength(1);
            const topic = data.topics[0];
            const expected = FIXTURE[id]?.[audience];
            if (topic === undefined || expected === undefined) {
                throw new Error(`no topic or fixture for ${id}/${audience}`);
            }
            const unsited = (text: string) => text.split(site).join('{SITE}');
            const legacy = {
                id: topic.id,
                title: topic.title,
                steps: topic.steps,
                links: topic.links.slice(0, expected.links.length)
            };
            expect(unsited(JSON.stringify(legacy))).toBe(JSON.stringify(expected));

            // The links after the legacy ones come from the article's tokens: with
            // one listing per vertical, each link or limit token adds one link at most.
            const article = findHelpArticle({ id });
            const {
                canDo,
                howTo,
                expect: toExpect,
                notExpect,
                troubleshooting
            } = article?.sections ?? {
                canDo: '',
                howTo: { steps: [], after: '' },
                expect: '',
                notExpect: '',
                troubleshooting: ''
            };
            const linkTokens = [
                canDo,
                ...howTo.steps,
                howTo.after,
                toExpect,
                notExpect,
                troubleshooting
            ]
                .flatMap((text) => parseHelpTokens({ text }).tokens)
                .filter((token) => token.kind !== 'article');
            const extras = topic.links.slice(expected.links.length);
            expect(extras.length).toBeLessThanOrEqual(linkTokens.length);
            for (const extra of extras) {
                expect(extra.url.startsWith(`${site}/es/`)).toBe(true);
            }
        });
    });
});
