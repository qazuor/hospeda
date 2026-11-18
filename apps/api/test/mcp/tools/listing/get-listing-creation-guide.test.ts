/**
 * HOS-2329 — `get_listing_creation_guide`: steps, limits read from the create
 * schemas, labelled options, destinations, the owner's drafts and the
 * informational publish quota.
 *
 * @module test/mcp/tools/listing/get-listing-creation-guide
 */

import { BUSINESS_LINE_RULES, VerticalEnum } from '@repo/schemas';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationCreateFieldsSchema } from '../../../../src/mcp/tools/listing/create-listing-input';
import {
    getListingCreationGuideTool,
    readFieldLimits
} from '../../../../src/mcp/tools/listing/get-listing-creation-guide';
import { runTool } from '../../../../src/mcp/tools/run-tool';
import { validateApiEnv } from '../../../../src/utils/env';
import {
    actorFor,
    context,
    DESTINATION_ID,
    givenDestinations,
    givenPrecheck,
    mocks,
    OWNER_ID
} from './create-listing.harness';

vi.mock('../../../../src/services/publish-precheck.service', async () => {
    const { mocks } = await import('./create-listing.harness');
    return { resolvePublishPrecheck: mocks.precheck };
});
vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/service-core')>())
}));

const DRAFT_ID = 'e1111111-1111-4111-8111-111111111111';

const guide = async (vertical: string, actor = actorFor()) => {
    const outcome = await runTool({
        definition: getListingCreationGuideTool,
        actor,
        input: { vertical },
        context
    });
    if (!outcome.ok) throw new Error(outcome.failure.message);
    return outcome.data;
};

describe('get_listing_creation_guide', () => {
    beforeAll(() => {
        validateApiEnv();
    });

    beforeEach(() => {
        mocks.precheck.mockReset();
        givenPrecheck();
        givenDestinations();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('reads each field limit from the create schema, so the guide never drifts', () => {
        const limits = readFieldLimits({ schema: AccommodationCreateFieldsSchema });
        expect(limits.get('name')).toEqual({
            name: 'name',
            required: true,
            minLength: 3,
            maxLength: 100
        });
        expect(limits.get('summary')).toMatchObject({
            required: true,
            minLength: 10,
            maxLength: 300
        });
        expect(limits.get('description')).toMatchObject({ required: false, minLength: 30 });
    });

    it('accommodation: steps in order, labelled types, destinations, quota', async () => {
        const data = await guide(VerticalEnum.ACCOMMODATION);
        expect(data.steps.map((s) => s.step)).toEqual([
            'basics',
            'destination',
            'description',
            'capacity',
            'location'
        ]);
        expect(data.types).toContainEqual({ value: 'CABIN', label: expect.any(String) });
        expect(data.types.find((t) => t.value === 'CABIN')?.label).not.toBe('CABIN');
        expect(data.destinations).toEqual([{ id: DESTINATION_ID, name: 'Concepción del Uruguay' }]);
        expect(data.publishQuota).toMatchObject({ hasFreeSlot: true });
        expect(data.createPageUrl).toMatch(/^https?:\/\//);
        expect(mocks.precheck).toHaveBeenCalledWith({
            actor: expect.objectContaining({ id: OWNER_ID }),
            vertical: VerticalEnum.ACCOMMODATION
        });
    });

    it('venue: business lines per type come from BUSINESS_LINE_RULES', async () => {
        const data = await guide(VerticalEnum.VENUE);
        expect(data.businessLinesByType).toHaveLength(
            Object.keys(BUSINESS_LINE_RULES.venue.typeRules).length
        );
        expect(data.businessLinesByType).toContainEqual({
            type: 'PARRILLA',
            allowed: [...BUSINESS_LINE_RULES.venue.typeRules.PARRILLA.allowed],
            preselect: [...BUSINESS_LINE_RULES.venue.typeRules.PARRILLA.preselect]
        });
        const location = data.steps.find((s) => s.step === 'location');
        expect(location?.fields).toContainEqual({
            name: 'street',
            required: false,
            minLength: 2,
            maxLength: 50
        });
    });

    it('experience: price units with labels, meeting point step', async () => {
        const data = await guide(VerticalEnum.EXPERIENCE);
        expect(data.priceUnits?.map((u) => u.value)).toEqual([
            'per_day',
            'per_hour',
            'per_person',
            'per_group'
        ]);
        expect(data.steps.map((s) => s.step)).toContain('meetingPoint');
    });

    it('lists the open drafts with their editor links, and the at-limit note never blocks', async () => {
        mocks.precheck.mockResolvedValue({
            currentCount: 1,
            maxAllowed: 1,
            hasQuota: false,
            draftCount: 1,
            drafts: [{ id: DRAFT_ID, slug: 'mi-cabana', name: 'Mi cabaña' }],
            decision: 'pick_draft_delete_or_upgrade'
        });
        const data = await guide(VerticalEnum.ACCOMMODATION);
        expect(data.existingDrafts).toEqual([
            { id: DRAFT_ID, name: 'Mi cabaña', editorUrl: expect.stringContaining(DRAFT_ID) }
        ]);
        expect(data.publishQuota.note).toContain('liberar un lugar');
    });

    it('answers with null destinations when the catalog cannot be read', async () => {
        const { DestinationService } = await import('@repo/service-core');
        vi.spyOn(DestinationService.prototype, 'search').mockResolvedValue({
            error: { code: 'INTERNAL_ERROR', message: 'x' }
        } as never);
        const data = await guide(VerticalEnum.VENUE);
        expect(data.destinations).toBeNull();
    });

    it('serves an unverified email (READ_OWN)', async () => {
        const data = await guide(VerticalEnum.VENUE, actorFor(OWNER_ID, { emailVerified: false }));
        expect(data.vertical).toBe(VerticalEnum.VENUE);
    });
});
