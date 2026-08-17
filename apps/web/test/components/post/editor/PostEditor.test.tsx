/**
 * @file PostEditor.test.tsx
 * @description Behaviour tests for the post editor island (HOS-374 Phase 2
 * 2C-2): the PATCH diff that reaches the API, the capability-gated controls,
 * and the moderation edit lock.
 *
 * `RichTextEditor` is shimmed with a `<textarea>` here so these stay fast — the
 * REAL TipTap editor is exercised in `PostEditor.rich-content.test.tsx`, which
 * is the only place that can reproduce its mount-time update transaction.
 *
 * @module test/components/post/editor/PostEditor
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostEditor } from '../../../../src/components/post/editor/PostEditor.client';
import type { PostEditDetail } from '../../../../src/lib/api/types';

vi.mock('@/store/toast-store', () => ({ addToast: vi.fn() }));

vi.mock('@/components/host/editor/RichTextEditor.client', () => ({
    RichTextEditor: ({
        value,
        onChange,
        ariaLabel,
        id,
        disabled
    }: {
        value: string;
        onChange: (value: string) => void;
        ariaLabel?: string;
        id?: string;
        disabled?: boolean;
    }) => (
        <textarea
            id={id}
            aria-label={ariaLabel}
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
        />
    )
}));

vi.mock('../../../../src/lib/i18n', () => ({
    createTranslations: () => ({
        t: (key: string, fallback?: string) => fallback ?? `[MISSING:${key}]`,
        tPlural: (key: string, count: number) => `[MISSING:${key}] ${count}`
    })
}));

vi.mock('../../../../src/lib/api/endpoints-protected', () => ({
    postEditApi: {
        update: vi.fn(),
        softDelete: vi.fn(),
        setPublishState: vi.fn()
    },
    /*
     * HOS-390: the editor now renders `ContentMediaSection`, which reaches for
     * `contentMediaApi` at module load. A mock without it fails the whole file
     * at import time, not at the assertion — `listMedia` resolving empty keeps
     * the section inert so these tests stay about the form.
     */
    contentMediaApi: {
        listMedia: vi.fn().mockResolvedValue({ ok: true, data: { media: [] } }),
        addMedia: vi.fn(),
        removeMedia: vi.fn(),
        setFeaturedMedia: vi.fn(),
        reorderMedia: vi.fn()
    }
}));

import { postEditApi } from '../../../../src/lib/api/endpoints-protected';
import { addToast } from '../../../../src/store/toast-store';

const mockUpdate = vi.mocked(postEditApi.update);
const mockSoftDelete = vi.mocked(postEditApi.softDelete);
const mockSetPublishState = vi.mocked(postEditApi.setPublishState);

const DESTINATION_ID = '11111111-1111-4111-8111-111111111111';

const BASE_POST: PostEditDetail = {
    id: 'post-1',
    slug: 'una-nota',
    title: 'Una nota',
    summary: 'Un resumen suficientemente largo',
    content: 'x'.repeat(150),
    category: 'CULTURE',
    readingTimeMinutes: 5,
    relatedDestinationId: DESTINATION_ID,
    moderationState: 'PENDING',
    visibility: 'PRIVATE',
    lifecycleState: 'ACTIVE'
};

/** Renders the editor with the given post overrides and capability flags. */
function renderEditor({
    post,
    canPublish = false,
    canDelete = false,
    isEditLocked = false
}: {
    post?: Partial<PostEditDetail>;
    canPublish?: boolean;
    canDelete?: boolean;
    isEditLocked?: boolean;
} = {}) {
    return render(
        <PostEditor
            locale="es"
            initialData={{ ...BASE_POST, ...post }}
            destinations={[{ id: DESTINATION_ID, name: 'Concepción del Uruguay' }]}
            canPublish={canPublish}
            canDelete={canDelete}
            isEditLocked={isEditLocked}
        />
    );
}

describe('PostEditor — saving', () => {
    beforeEach(() => {
        mockUpdate.mockReset();
        mockSoftDelete.mockReset();
        mockSetPublishState.mockReset();
        vi.mocked(addToast).mockReset();
    });
    afterEach(() => vi.clearAllMocks());

    it('sends only the edited field', async () => {
        mockUpdate.mockResolvedValueOnce({ ok: true, data: {} });
        renderEditor();

        fireEvent.change(screen.getByLabelText('Título *'), {
            target: { value: 'Un título nuevo' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

        await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
        expect(mockUpdate.mock.calls[0]?.[0]).toEqual({
            id: 'post-1',
            data: { title: 'Un título nuevo' }
        });
    });

    it('never sends a publication-state field, whatever was edited', async () => {
        mockUpdate.mockResolvedValueOnce({ ok: true, data: {} });
        renderEditor();

        fireEvent.change(screen.getByLabelText('Contenido *'), {
            target: { value: 'y'.repeat(200) }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

        await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
        const body = mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
        expect(body).not.toHaveProperty('isPublished');
        expect(body).not.toHaveProperty('visibility');
        expect(body).not.toHaveProperty('moderationState');
    });

    it('does not call the API when nothing changed, and says so', () => {
        renderEditor();

        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

        expect(mockUpdate).not.toHaveBeenCalled();
        expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'info' }));
    });

    it('blocks the save and flags the field when the title exceeds the domain limit', () => {
        renderEditor();

        // 180 chars passes `PostUpdateHttpSchema` (max 200) but fails
        // `PostSchema` (max 150), which the service validates afterwards — so
        // without the client-side tightening this would 400 server-side with
        // no field ever marked invalid.
        fireEvent.change(screen.getByLabelText('Título *'), {
            target: { value: 'a'.repeat(180) }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

        expect(mockUpdate).not.toHaveBeenCalled();
    });
});

describe('PostEditor — capability-gated controls', () => {
    beforeEach(() => {
        mockUpdate.mockReset();
        mockSoftDelete.mockReset();
        mockSetPublishState.mockReset();
    });
    afterEach(() => vi.clearAllMocks());

    it('renders NO publish or delete control for a plain editor', () => {
        renderEditor({ canPublish: false, canDelete: false });

        // OQ-3: absent, not disabled — a disabled button only invites the
        // question of how to enable it, and the answer is an admin grant.
        expect(screen.queryByTestId('content-publish-toggle')).not.toBeInTheDocument();
        expect(screen.queryByTestId('content-delete')).not.toBeInTheDocument();
    });

    it('renders the delete control alone when only deletion is granted', () => {
        // The two capabilities are separate flags, and the section only gates
        // the whole action row on `canPublish || canDelete`. Without this
        // mixed case, dropping the inner `canPublish` guard would go unnoticed:
        // with both flags false the row is absent either way.
        renderEditor({ canPublish: false, canDelete: true });

        expect(screen.getByTestId('content-delete')).toBeInTheDocument();
        expect(screen.queryByTestId('content-publish-toggle')).not.toBeInTheDocument();
    });

    it('renders the publish control alone when only publishing is granted', () => {
        renderEditor({ canPublish: true, canDelete: false });

        expect(screen.getByTestId('content-publish-toggle')).toBeInTheDocument();
        expect(screen.queryByTestId('content-delete')).not.toBeInTheDocument();
    });

    it('publishes through the publish-state endpoint, never through the PATCH', async () => {
        mockSetPublishState.mockResolvedValueOnce({ ok: true, data: {} });
        renderEditor({ canPublish: true });

        fireEvent.click(screen.getByTestId('content-publish-toggle'));

        await waitFor(() => expect(mockSetPublishState).toHaveBeenCalledTimes(1));
        expect(mockSetPublishState).toHaveBeenCalledWith({
            id: 'post-1',
            visibility: 'PUBLIC'
        });
        expect(mockUpdate).not.toHaveBeenCalled();
        // The control reflects the new state without a page reload.
        await waitFor(() =>
            expect(screen.getByTestId('content-publish-toggle')).toHaveTextContent('Despublicar')
        );
    });

    it('unpublishes an already-public post', async () => {
        mockSetPublishState.mockResolvedValueOnce({ ok: true, data: {} });
        renderEditor({ post: { visibility: 'PUBLIC' }, canPublish: true });

        fireEvent.click(screen.getByTestId('content-publish-toggle'));

        await waitFor(() =>
            expect(mockSetPublishState).toHaveBeenCalledWith({
                id: 'post-1',
                visibility: 'PRIVATE'
            })
        );
    });

    it('blocks publishing while the form holds unsaved edits', () => {
        renderEditor({ canPublish: true });

        fireEvent.change(screen.getByLabelText('Título *'), {
            target: { value: 'Otro título' }
        });

        // Publishing now would push the PERSISTED version live, not what is on
        // screen. Disabled WITH a visible reason, unlike the permission case.
        expect(screen.getByTestId('content-publish-toggle')).toBeDisabled();
        expect(
            screen.getByText('Guardá los cambios antes de cambiar la publicación.')
        ).toBeInTheDocument();
    });

    it('requires confirmation before deleting', async () => {
        mockSoftDelete.mockResolvedValueOnce({ ok: true, data: {} });
        Object.defineProperty(window, 'location', { value: { href: '' }, writable: true });
        renderEditor({ canDelete: true });

        fireEvent.click(screen.getByTestId('content-delete'));
        expect(mockSoftDelete).not.toHaveBeenCalled();

        fireEvent.click(screen.getByTestId('content-delete-confirm'));
        await waitFor(() => expect(mockSoftDelete).toHaveBeenCalledWith({ id: 'post-1' }));
    });
});

describe('PostEditor — moderation edit lock (§7.6.3)', () => {
    beforeEach(() => {
        mockUpdate.mockReset();
    });
    afterEach(() => vi.clearAllMocks());

    it('warns up front and removes the save control', () => {
        renderEditor({ isEditLocked: true });

        expect(screen.getByTestId('post-editor-lock-notice')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument();
    });

    it('disables the plain fields', () => {
        renderEditor({ isEditLocked: true });

        expect(screen.getByLabelText('Título *')).toBeDisabled();
        expect(screen.getByLabelText('Categoría *')).toBeDisabled();
    });

    it('disables the rich-text body too', () => {
        renderEditor({ isEditLocked: true });

        // `fieldset[disabled]` does not reach a contenteditable, so the body
        // needs its own flag — without it every field but the one that matters
        // most would be locked.
        expect(screen.getByLabelText('Contenido *')).toBeDisabled();
    });

    it('shows no lock notice when the post is editable', () => {
        renderEditor({ isEditLocked: false });

        expect(screen.queryByTestId('post-editor-lock-notice')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Guardar' })).toBeInTheDocument();
    });
});
