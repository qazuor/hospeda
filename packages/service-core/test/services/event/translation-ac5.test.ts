/**
 * @fileoverview
 * SPEC-212 AC-5: update re-translates ONLY changed fields — Event variant.
 *
 * Verifies that EventService._afterUpdate emits a translate call containing
 * ONLY the fields whose Spanish source value changed during the update —
 * and that _afterCreate still translates all non-empty fields.
 *
 * Quirk: EventService has an update() override that stores ctx.hookState.updateId
 * before delegating to super.update(). The model is passed via ctx (constructor
 * option ctx & { model?: EventModel }) rather than as a second positional argument.
 * Both patterns are handled here.
 */

import { EventModel } from '@repo/db';
import { EventCategoryEnum, PermissionEnum, RoleEnum } from '@repo/schemas';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventService } from '../../../src/services/event/event.service';
import {
    _resetTranslationService,
    initializeTranslationService
} from '../../../src/translation/translation-init';
import { createAdminActor } from '../../factories/actorFactory';
import { createMockEvent } from '../../factories/eventFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

// Stub out revalidation so it never throws or makes real calls.
vi.mock('../../../src/revalidation/revalidation-init.js', () => ({
    getRevalidationService: () => undefined
}));

// generateEventSlug queries the DB to ensure uniqueness — stub it out so
// tests don't require a running database when the update payload includes `name`.
vi.mock('../../../src/services/event/event.helpers', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('../../../src/services/event/event.helpers')>();
    return {
        ...actual,
        generateEventSlug: vi.fn().mockResolvedValue('mocked-event-slug')
    };
});

describe('EventService — SPEC-212 AC-5: translation diff on update', () => {
    let modelMock: EventModel;
    let service: EventService;
    let translateMock: Mock;

    const actor = createAdminActor({
        permissions: [PermissionEnum.EVENT_UPDATE],
        role: RoleEnum.ADMIN
    });

    beforeEach(() => {
        vi.clearAllMocks();
        // EventService receives its model via ctx.model (not as a second positional arg)
        modelMock = createTypedModelMock(EventModel, ['findById', 'update', 'findOne']);
        service = new EventService({ logger: createLoggerMock(), model: modelMock });

        translateMock = vi.fn().mockResolvedValue(undefined);
        initializeTranslationService({ translate: translateMock });
    });

    afterEach(() => {
        _resetTranslationService();
    });

    // -----------------------------------------------------------------------
    // _afterCreate: all non-empty fields are translated (unchanged behaviour)
    // -----------------------------------------------------------------------

    it('create: translates name, summary, and description', async () => {
        const event = createMockEvent({
            name: 'Fiesta Nacional del Litoral',
            summary: 'El festival más importante de la región',
            description:
                'Una celebración anual que reúne música, gastronomía y tradiciones de todo el litoral argentino.'
        });

        // _afterCreate is called by the base write layer after model.create.
        // @ts-expect-error: protected hook called directly for isolation
        await service._afterCreate(event, actor, { hookState: {} });

        expect(translateMock).toHaveBeenCalledOnce();
        const firstCallCreate = translateMock.mock.calls[0];
        expect(firstCallCreate).toBeDefined();
        const callCreate = (
            firstCallCreate as [{ entityType: string; fields: Record<string, string> }]
        )[0];
        expect(callCreate.entityType).toBe('event');
        expect(callCreate.fields).toHaveProperty('name', 'Fiesta Nacional del Litoral');
        expect(callCreate.fields).toHaveProperty(
            'summary',
            'El festival más importante de la región'
        );
        expect(callCreate.fields).toHaveProperty('description');
    });

    // -----------------------------------------------------------------------
    // _afterUpdate: only CHANGED fields are translated
    // -----------------------------------------------------------------------

    it('update: translates only the field that changed (name)', async () => {
        const event = createMockEvent({
            name: 'Evento Original',
            summary: 'Resumen sin cambios',
            description: 'Descripción sin cambios',
            category: EventCategoryEnum.FESTIVAL,
            date: { start: new Date('2026-07-01'), end: new Date('2026-07-01') }
        });
        const updatedEvent = { ...event, name: 'Evento Modificado' };

        // findById is called twice:
        //   (1) in _beforeUpdate for the pre-update snapshot (ctx.hookState.updateId is set by update())
        //   (2) by the base write layer for entity-exists check before update
        (modelMock.findById as Mock)
            .mockResolvedValueOnce(event) // pre-update snapshot in _beforeUpdate
            .mockResolvedValueOnce(event); // base write entity check
        (modelMock.update as Mock).mockResolvedValue(updatedEvent);

        // Updating `name` triggers slug regeneration in _beforeUpdate.
        // Provide category + date so the guard doesn't throw; category/date are
        // not tracked translatable fields so they don't appear in the translate call.
        const result = await service.update(actor, event.id, {
            name: 'Evento Modificado',
            category: EventCategoryEnum.FESTIVAL,
            date: { start: new Date('2026-07-01'), end: new Date('2026-07-01') }
        });

        expect(result.error).toBeUndefined();
        expect(translateMock).toHaveBeenCalledOnce();
        const firstCallUpdate = translateMock.mock.calls[0];
        expect(firstCallUpdate).toBeDefined();
        const callUpdate = (firstCallUpdate as [{ fields: Record<string, string> }])[0];
        expect(callUpdate.fields).toEqual({ name: 'Evento Modificado' });
        expect(callUpdate.fields).not.toHaveProperty('summary');
        expect(callUpdate.fields).not.toHaveProperty('description');
    });

    it('update: does NOT call translate when the field value did not change', async () => {
        const event = createMockEvent({
            name: 'Evento Original',
            summary: 'Resumen sin cambios',
            description: 'Descripción sin cambios',
            category: EventCategoryEnum.FESTIVAL,
            date: { start: new Date('2026-07-01'), end: new Date('2026-07-01') }
        });
        const updatedEvent = { ...event };

        (modelMock.findById as Mock).mockResolvedValueOnce(event).mockResolvedValueOnce(event);
        (modelMock.update as Mock).mockResolvedValue(updatedEvent);

        // Same name value — no actual change. Provide category + date so
        // _beforeUpdate's slug-regen guard doesn't throw.
        await service.update(actor, event.id, {
            name: 'Evento Original',
            category: EventCategoryEnum.FESTIVAL,
            date: { start: new Date('2026-07-01'), end: new Date('2026-07-01') }
        });

        expect(translateMock).not.toHaveBeenCalled();
    });

    it('update: translates multiple changed fields when both name and summary change', async () => {
        const event = createMockEvent({
            name: 'Evento Original',
            summary: 'Resumen viejo',
            description: 'Descripción fija',
            category: EventCategoryEnum.FESTIVAL,
            date: { start: new Date('2026-07-01'), end: new Date('2026-07-01') }
        });
        const updatedEvent = {
            ...event,
            name: 'Evento Nuevo',
            summary: 'Resumen nuevo'
        };

        (modelMock.findById as Mock).mockResolvedValueOnce(event).mockResolvedValueOnce(event);
        (modelMock.update as Mock).mockResolvedValue(updatedEvent);

        // Provide category + date so _beforeUpdate's slug-regen guard doesn't throw.
        await service.update(actor, event.id, {
            name: 'Evento Nuevo',
            summary: 'Resumen nuevo',
            category: EventCategoryEnum.FESTIVAL,
            date: { start: new Date('2026-07-01'), end: new Date('2026-07-01') }
        });

        expect(translateMock).toHaveBeenCalledOnce();
        const firstCallMulti = translateMock.mock.calls[0];
        expect(firstCallMulti).toBeDefined();
        const callMulti = (firstCallMulti as [{ fields: Record<string, string> }])[0];
        expect(callMulti.fields).toEqual({
            name: 'Evento Nuevo',
            summary: 'Resumen nuevo'
        });
        expect(callMulti.fields).not.toHaveProperty('description');
    });

    it('update: does NOT call translate when no translatable field changed', async () => {
        const event = createMockEvent({
            name: 'Evento Original',
            summary: 'Resumen sin cambios',
            description: 'Descripción sin cambios'
        });
        const updatedEvent = { ...event, isFeatured: true };

        (modelMock.findById as Mock).mockResolvedValueOnce(event).mockResolvedValueOnce(event);
        (modelMock.update as Mock).mockResolvedValue(updatedEvent);

        await service.update(actor, event.id, { isFeatured: true });

        expect(translateMock).not.toHaveBeenCalled();
    });
});
