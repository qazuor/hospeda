import { describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { ExperienceService } from '../../../src/services/experience/experience.service';
import { resolveBusinessLinesOnCreate } from '../../../src/services/listing/base-listing.service';
import { VenueService } from '../../../src/services/venue/venue.service';
import type { Actor } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';

/**
 * The protected create collaborators this test replaces, so the real `create`
 * path (and its `_beforeCreate` hook) runs against an in-memory model.
 */
interface CreateHarness {
    model: { create: (data: unknown, tx?: unknown) => Promise<unknown> };
    _canCreate: () => Promise<void>;
    _afterCreate: (entity: unknown) => Promise<unknown>;
    _refetchWithWriteRelations: (entity: unknown) => Promise<unknown>;
    _assertDestinationIsCity: () => Promise<void>;
    create: (
        actor: Actor,
        input: Record<string, unknown>,
        ctx: { tx: unknown; hookState: Record<string, unknown> }
    ) => Promise<unknown>;
}

describe('TEST:2.3:3 AC:2:11 create business line preselection', () => {
    it.each([
        ['venue', 'BOLICHE', ['nightlife']],
        ['venue', 'CAFE', ['food']],
        ['venue', 'BAR', ['food', 'nightlife']],
        ['accommodation', 'CABIN', ['standard']],
        ['experience', 'EXCURSION', ['standard']]
    ] as const)('%s %s defaults to its catalog preselection', (vertical, type, expected) => {
        expect(resolveBusinessLinesOnCreate({ vertical, type })).toEqual(expected);
    });

    it('preserves explicitly supplied create values for the later validator', () => {
        expect(
            resolveBusinessLinesOnCreate({
                vertical: 'venue',
                type: 'BOLICHE',
                businessLines: ['food']
            })
        ).toEqual(['food']);
    });

    it('preselects venue business lines before validating and persisting the create', async () => {
        const service = new VenueService({}) as unknown as CreateHarness;
        const model = { create: vi.fn(async (data: unknown) => data) };
        service.model = model;
        service._canCreate = async () => {};
        service._afterCreate = async (entity: unknown) => entity;
        service._refetchWithWriteRelations = async (entity: unknown) => entity;
        service._assertDestinationIsCity = async () => {};
        const input = {
            type: 'BOLICHE',
            name: 'Test venue',
            slug: 'test-venue',
            ownerId: '00000000-0000-4000-a000-000000000001',
            destinationId: '00000000-0000-4000-a000-000000000002',
            summary: 'A sufficiently long summary for this service create test.',
            description: 'A sufficiently long description for this service create test.'
        };

        await service.create(createActor({ id: input.ownerId }), input, {
            tx: {},
            hookState: {}
        });

        expect(model.create).toHaveBeenCalledWith(
            expect.objectContaining({ businessLines: ['nightlife'] }),
            expect.anything()
        );
    });

    it.each([
        ['venue', VenueService, 'BOLICHE', ['nightlife']],
        ['experience', ExperienceService, 'EXCURSION', ['standard']],
        ['accommodation', AccommodationService, 'CABIN', ['standard']]
    ] as const)('%s create persists its preselection and explicit value', async (vertical, Service, type, fallback) => {
        const service = new Service({}) as unknown as CreateHarness;
        const model = { create: vi.fn(async (data: unknown) => data) };
        service.model = model;
        service._canCreate = async () => {};
        service._afterCreate = async (entity: unknown) => entity;
        service._refetchWithWriteRelations = async (entity: unknown) => entity;
        service._assertDestinationIsCity = async () => {};
        const input =
            vertical === 'accommodation'
                ? {
                      type,
                      name: 'Test place',
                      slug: 'test-place',
                      ownerId: '00000000-0000-4000-a000-000000000001',
                      destinationId: '00000000-0000-4000-a000-000000000002',
                      summary: 'A sufficiently long summary for this service create test.',
                      description: 'A sufficiently long description for this service create test.',
                      priceFrom: 1000
                  }
                : {
                      type,
                      name: 'Test place',
                      slug: 'test-place',
                      ownerId: '00000000-0000-4000-a000-000000000001',
                      destinationId: '00000000-0000-4000-a000-000000000002',
                      summary: 'A sufficiently long summary for this service create test.',
                      description: 'A sufficiently long description for this service create test.',
                      ...(vertical === 'experience' ? { priceFrom: 1000 } : {})
                  };
        const actor = createActor({ id: input.ownerId });
        const ctx = { tx: {}, hookState: {} };

        await service.create(actor, input, ctx);
        expect(model.create).toHaveBeenLastCalledWith(
            expect.objectContaining({ businessLines: fallback }),
            ctx.tx
        );

        const explicitLines = vertical === 'venue' ? ['nightlife'] : ['standard'];
        await service.create(actor, { ...input, businessLines: explicitLines }, ctx);
        expect(model.create).toHaveBeenLastCalledWith(
            expect.objectContaining({ businessLines: explicitLines }),
            ctx.tx
        );
    });
});
