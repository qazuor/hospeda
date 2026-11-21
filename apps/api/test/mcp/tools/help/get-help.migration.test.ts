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
 * @module test/mcp/tools/help/get-help.migration
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

type Fixture = Record<string, Record<(typeof AUDIENCES)[number], unknown>>;

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
            const actual = JSON.stringify(data.topics[0]).split(site).join('{SITE}');
            expect(actual).toBe(JSON.stringify(FIXTURE[id]?.[audience]));
        });
    });
});
