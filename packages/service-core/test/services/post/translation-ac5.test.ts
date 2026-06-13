/**
 * @fileoverview
 * SPEC-212 AC-5: update re-translates ONLY changed fields — Post variant.
 *
 * Post uses `title` and `content` instead of `name` and `description`.
 * These tests confirm that the diff logic handles the alternate field shapes
 * correctly for both create and update paths.
 */

import { PostModel } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostService } from '../../../src/services/post/post.service';
import {
    _resetTranslationService,
    initializeTranslationService
} from '../../../src/translation/translation-init';
import { createAdminActor } from '../../factories/actorFactory';
import { createMockPost } from '../../factories/postFactory';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createTypedModelMock } from '../../utils/modelMockFactory';

describe('PostService — SPEC-212 AC-5: translation diff on update', () => {
    let service: PostService;
    let modelMock: PostModel;
    let translateMock: Mock;

    const actor = createAdminActor({
        permissions: [PermissionEnum.POST_UPDATE],
        role: RoleEnum.ADMIN
    });

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createTypedModelMock(PostModel, ['findById', 'update', 'findOne']);
        service = createServiceTestInstance(PostService, modelMock);

        translateMock = vi.fn().mockResolvedValue(undefined);
        initializeTranslationService({ translate: translateMock });
    });

    afterEach(() => {
        _resetTranslationService();
    });

    // -----------------------------------------------------------------------
    // _afterCreate: all non-empty fields are translated (unchanged behaviour)
    // -----------------------------------------------------------------------

    it('create: translates title, summary, and content', async () => {
        const post = createMockPost({
            title: 'Artículo inicial',
            summary: 'Resumen inicial',
            content:
                'Contenido inicial que cumple el mínimo requerido de longitud para que pase la validación del campo content del post en este contexto de prueba.'
        });

        // _afterCreate is called by the base write layer after model.create
        // @ts-expect-error: protected hook called directly for isolation
        await service._afterCreate(post, actor, { hookState: {} });

        expect(translateMock).toHaveBeenCalledOnce();
        const firstCallCreate = translateMock.mock.calls[0];
        expect(firstCallCreate).toBeDefined();
        const callCreate = (
            firstCallCreate as [{ entityType: string; fields: Record<string, string> }]
        )[0];
        expect(callCreate.entityType).toBe('post');
        expect(callCreate.fields).toHaveProperty('title', 'Artículo inicial');
        expect(callCreate.fields).toHaveProperty('summary', 'Resumen inicial');
        expect(callCreate.fields).toHaveProperty('content');
    });

    // -----------------------------------------------------------------------
    // _afterUpdate: only CHANGED fields are translated
    // -----------------------------------------------------------------------

    it('update: translates only the title when only title changed', async () => {
        const post = createMockPost({
            title: 'Artículo original',
            summary: 'Resumen sin cambios',
            content:
                'Contenido sin cambios que cumple el mínimo de longitud para este test de integración de la traducción.'
        });
        const updatedPost = { ...post, title: 'Artículo modificado' };

        // findById is called: (1) by _beforeUpdate for pre-update snapshot,
        // (2) by base write layer for entity-exists check before update.
        (modelMock.findById as Mock)
            .mockResolvedValueOnce(post) // _beforeUpdate snapshot
            .mockResolvedValueOnce(post); // base write entity check
        (modelMock.update as Mock).mockResolvedValue(updatedPost);

        const result = await service.update(actor, post.id, { title: 'Artículo modificado' });

        expect(result.error).toBeUndefined();
        expect(translateMock).toHaveBeenCalledOnce();
        const firstCallUpdate = translateMock.mock.calls[0];
        expect(firstCallUpdate).toBeDefined();
        const callUpdate = (firstCallUpdate as [{ fields: Record<string, string> }])[0];
        expect(callUpdate.fields).toEqual({ title: 'Artículo modificado' });
        expect(callUpdate.fields).not.toHaveProperty('summary');
        expect(callUpdate.fields).not.toHaveProperty('content');
    });

    it('update: does NOT call translate when title is unchanged', async () => {
        const post = createMockPost({
            title: 'Artículo original',
            summary: 'Resumen sin cambios',
            content:
                'Contenido sin cambios que cumple el mínimo de longitud para este test de integración de la traducción.'
        });
        // Same title value — no actual change
        const updatedPost = { ...post };

        (modelMock.findById as Mock).mockResolvedValueOnce(post).mockResolvedValueOnce(post);
        (modelMock.update as Mock).mockResolvedValue(updatedPost);

        await service.update(actor, post.id, { title: 'Artículo original' });

        expect(translateMock).not.toHaveBeenCalled();
    });

    it('update: translates multiple fields when both title and summary change', async () => {
        const post = createMockPost({
            title: 'Artículo original',
            summary: 'Resumen viejo',
            content:
                'Contenido fijo que cumple el mínimo de longitud para este test de integración de la traducción automática.'
        });
        const updatedPost = {
            ...post,
            title: 'Artículo nuevo',
            summary: 'Resumen nuevo'
        };

        (modelMock.findById as Mock).mockResolvedValueOnce(post).mockResolvedValueOnce(post);
        (modelMock.update as Mock).mockResolvedValue(updatedPost);

        await service.update(actor, post.id, {
            title: 'Artículo nuevo',
            summary: 'Resumen nuevo'
        });

        expect(translateMock).toHaveBeenCalledOnce();
        const firstCallMulti = translateMock.mock.calls[0];
        expect(firstCallMulti).toBeDefined();
        const callMulti = (firstCallMulti as [{ fields: Record<string, string> }])[0];
        expect(callMulti.fields).toEqual({
            title: 'Artículo nuevo',
            summary: 'Resumen nuevo'
        });
        expect(callMulti.fields).not.toHaveProperty('content');
    });

    it('update: does NOT call translate when no translatable field changed', async () => {
        const post = createMockPost();
        const updatedPost = { ...post, isFeatured: true };

        (modelMock.findById as Mock).mockResolvedValueOnce(post).mockResolvedValueOnce(post);
        (modelMock.update as Mock).mockResolvedValue(updatedPost);

        await service.update(actor, post.id, { isFeatured: true });

        expect(translateMock).not.toHaveBeenCalled();
    });
});
