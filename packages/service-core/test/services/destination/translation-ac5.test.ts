/**
 * @fileoverview
 * SPEC-212 AC-5: update re-translates ONLY changed fields — Destination variant.
 *
 * Verifies that DestinationService._afterUpdate emits a translate call
 * containing ONLY the fields whose Spanish source value changed during the
 * update — and that _afterCreate still translates all non-empty fields.
 *
 * Quirk: DestinationService._beforeUpdate has an early-return for non-hierarchy
 * updates (when neither parentDestinationId nor slug is in the payload), but the
 * previousTranslatableFields snapshot is captured BEFORE that early-return.
 * Driving through service.update() exercises the full hook chain reliably.
 */

import type { DestinationModel } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DestinationService } from '../../../src/services/destination/destination.service';
import {
    _resetTranslationService,
    initializeTranslationService
} from '../../../src/translation/translation-init';
import { createAdminActor } from '../../factories/actorFactory';
import { createMockBaseModel } from '../../factories/baseServiceFactory';
import { createMockDestination } from '../../factories/destinationFactory';
import { createLoggerMock } from '../../utils/modelMockFactory';

// Stub out revalidation so it never throws or makes real calls.
vi.mock('../../../src/revalidation/revalidation-init.js', () => ({
    getRevalidationService: () => undefined
}));

const mockLogger = createLoggerMock();

/** Sets up a minimal DestinationService with a mock model. */
function makeService(model: ReturnType<typeof createMockBaseModel>) {
    return new DestinationService({ logger: mockLogger }, model as unknown as DestinationModel);
}

describe('DestinationService — SPEC-212 AC-5: translation diff on update', () => {
    let model: ReturnType<typeof createMockBaseModel>;
    let service: DestinationService;
    let translateMock: Mock;

    const actor = createAdminActor({
        permissions: [PermissionEnum.DESTINATION_UPDATE],
        role: RoleEnum.ADMIN
    });

    beforeEach(() => {
        vi.clearAllMocks();
        model = createMockBaseModel();
        service = makeService(model);

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
        const destination = createMockDestination({
            name: 'Concepción del Uruguay',
            summary: 'Ciudad histórica del litoral argentino',
            description: 'Una ciudad con historia y naturaleza.'
        });

        // _afterCreate is called by the base write layer after model.create.
        // @ts-expect-error: protected hook called directly for isolation
        await service._afterCreate(destination, actor, { hookState: {} });

        expect(translateMock).toHaveBeenCalledOnce();
        const firstCallCreate = translateMock.mock.calls[0];
        expect(firstCallCreate).toBeDefined();
        const callCreate = (
            firstCallCreate as [{ entityType: string; fields: Record<string, string> }]
        )[0];
        expect(callCreate.entityType).toBe('destination');
        expect(callCreate.fields).toHaveProperty('name', 'Concepción del Uruguay');
        expect(callCreate.fields).toHaveProperty(
            'summary',
            'Ciudad histórica del litoral argentino'
        );
        expect(callCreate.fields).toHaveProperty(
            'description',
            'Una ciudad con historia y naturaleza.'
        );
    });

    // -----------------------------------------------------------------------
    // _afterUpdate: only CHANGED fields are translated
    // -----------------------------------------------------------------------

    it('update: translates only the field that changed (name)', async () => {
        const before = createMockDestination({
            name: 'Destino Original',
            summary: 'Resumen sin cambios',
            description: 'Descripción sin cambios'
        });
        const after = { ...before, name: 'Destino Actualizado' };

        // findById is called twice:
        //   (1) in _beforeUpdate for the pre-update snapshot (ctx.hookState.updateId is set by update())
        //   (2) by the base write layer for entity-exists check before update
        (model.findById as Mock)
            .mockResolvedValueOnce(before) // pre-update snapshot in _beforeUpdate
            .mockResolvedValueOnce(before); // base write entity check
        (model.update as Mock).mockResolvedValue(after);

        const result = await service.update(actor, before.id, { name: 'Destino Actualizado' });

        expect(result.error).toBeUndefined();
        expect(translateMock).toHaveBeenCalledOnce();
        const firstCallUpdate = translateMock.mock.calls[0];
        expect(firstCallUpdate).toBeDefined();
        const callUpdate = (firstCallUpdate as [{ fields: Record<string, string> }])[0];
        expect(callUpdate.fields).toEqual({ name: 'Destino Actualizado' });
        expect(callUpdate.fields).not.toHaveProperty('summary');
        expect(callUpdate.fields).not.toHaveProperty('description');
    });

    it('update: does NOT call translate when the field value did not change', async () => {
        const destination = createMockDestination({
            name: 'Destino Original',
            summary: 'Resumen sin cambios',
            description: 'Descripción sin cambios'
        });
        const after = { ...destination };

        (model.findById as Mock)
            .mockResolvedValueOnce(destination)
            .mockResolvedValueOnce(destination);
        (model.update as Mock).mockResolvedValue(after);

        await service.update(actor, destination.id, { name: 'Destino Original' });

        expect(translateMock).not.toHaveBeenCalled();
    });

    it('update: translates multiple changed fields when both name and summary change', async () => {
        const before = createMockDestination({
            name: 'Destino Original',
            summary: 'Resumen viejo',
            description: 'Descripción fija'
        });
        const after = {
            ...before,
            name: 'Destino Nuevo',
            summary: 'Resumen nuevo'
        };

        (model.findById as Mock).mockResolvedValueOnce(before).mockResolvedValueOnce(before);
        (model.update as Mock).mockResolvedValue(after);

        await service.update(actor, before.id, {
            name: 'Destino Nuevo',
            summary: 'Resumen nuevo'
        });

        expect(translateMock).toHaveBeenCalledOnce();
        const firstCallMulti = translateMock.mock.calls[0];
        expect(firstCallMulti).toBeDefined();
        const callMulti = (firstCallMulti as [{ fields: Record<string, string> }])[0];
        expect(callMulti.fields).toEqual({
            name: 'Destino Nuevo',
            summary: 'Resumen nuevo'
        });
        expect(callMulti.fields).not.toHaveProperty('description');
    });

    it('update: does NOT call translate when no translatable field changed', async () => {
        const destination = createMockDestination({
            name: 'Destino Original',
            summary: 'Resumen sin cambios',
            description: 'Descripción sin cambios'
        });
        // Only update a non-translatable field
        const after = { ...destination, isFeatured: true };

        (model.findById as Mock)
            .mockResolvedValueOnce(destination)
            .mockResolvedValueOnce(destination);
        (model.update as Mock).mockResolvedValue(after);

        await service.update(actor, destination.id, { isFeatured: true });

        expect(translateMock).not.toHaveBeenCalled();
    });
});
