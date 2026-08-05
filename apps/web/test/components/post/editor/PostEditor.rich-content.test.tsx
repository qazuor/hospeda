/**
 * @file PostEditor.rich-content.test.tsx
 * @description Integration guard for the post body after it became a TipTap
 * editor (HOS-374 2C-2).
 *
 * Kept out of `PostEditor.test.tsx` on purpose: that suite shims
 * `RichTextEditor` with a `<textarea>` so the payload/lock tests stay fast, and
 * a shimmed editor cannot reproduce TipTap's mount-time update transaction —
 * which is exactly what this file exists to pin (HOS-371).
 *
 * @module test/components/post/editor/PostEditor.rich-content
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostEditor } from '../../../../src/components/post/editor/PostEditor.client';
import type { PostEditDetail } from '../../../../src/lib/api/types';

vi.mock('@/store/toast-store', () => ({ addToast: vi.fn() }));

vi.mock('../../../../src/lib/i18n', () => ({
    createTranslations: () => ({
        t: (key: string, fallback?: string) => fallback ?? `[MISSING:${key}]`
    })
}));

vi.mock('../../../../src/lib/api/endpoints-protected', () => ({
    postEditApi: {
        update: vi.fn(),
        softDelete: vi.fn(),
        setPublishState: vi.fn()
    }
}));

import { postEditApi } from '../../../../src/lib/api/endpoints-protected';

const mockUpdate = vi.mocked(postEditApi.update);

/**
 * Body text that is deliberately NOT in TipTap's canonical Markdown form: a
 * single newline inside a paragraph (which serializes back as a space) plus a
 * trailing newline (which is stripped).
 *
 * This matters. TipTap's mount-time update carries its NORMALIZED
 * serialization, so a seed that already round-trips unchanged is caught by the
 * `onUpdate` equality guard and the test passes whether or not the real fix
 * (`setEditable(x, false)`) is in place — a green that proves nothing. Stored
 * post bodies are written by the admin panel and by seed data migrations, so
 * non-canonical is the normal case, not a contrived one.
 *
 * It is also comfortably over the schema's 100-character minimum on purpose: a
 * shorter body would fail validation BEFORE the save call, so "the API was
 * never called" would hold for the wrong reason and the guard would go quiet
 * again.
 */
const NON_CANONICAL_BODY =
    'Cuerpo de la nota con un salto de línea simple en el medio del párrafo,\nque TipTap serializa de vuelta como un espacio, más un salto final.\n';

const POST: PostEditDetail = {
    id: 'post-1',
    slug: 'una-nota',
    title: 'Una nota',
    summary: 'Un resumen suficientemente largo',
    content: NON_CANONICAL_BODY,
    category: 'CULTURE',
    readingTimeMinutes: 5,
    relatedDestinationId: null,
    moderationState: 'PENDING',
    visibility: 'PRIVATE',
    lifecycleState: 'ACTIVE'
};

/** Renders the editor with the body seeded (or empty). */
function renderEditor(content: string) {
    return render(
        <PostEditor
            locale="es"
            initialData={{ ...POST, content }}
        />
    );
}

/**
 * Waits for the deferred (`immediatelyRender: false`) TipTap editor to mount.
 *
 * Gated on `.ProseMirror` — an element the RUNTIME creates. Gating on the
 * server-rendered wrapper would pass before TipTap ever booted, which would
 * make every assertion below vacuous.
 */
async function waitForEditorMount(): Promise<void> {
    await waitFor(() => expect(document.querySelector('.ProseMirror')).toBeTruthy());
    await new Promise((resolve) => setTimeout(resolve, 50));
}

describe('PostEditor — the body as a real rich text editor', () => {
    beforeEach(() => {
        mockUpdate.mockReset();
    });

    it('renders a formatting toolbar instead of a bare textarea', async () => {
        const { container } = renderEditor(NON_CANONICAL_BODY);
        await waitForEditorMount();

        expect(screen.getByRole('toolbar', { name: 'Formato' })).toBeInTheDocument();
        expect(container.querySelector('textarea#post-content')).toBeNull();
        expect(container.querySelector('#post-content')).not.toBeNull();
    });

    it('gives the editing surface an accessible name', async () => {
        renderEditor(NON_CANONICAL_BODY);
        await waitForEditorMount();

        // A `<label htmlFor>` only names form CONTROLS; the editing surface is
        // a contenteditable `role="textbox"`, so without the explicit ariaLabel
        // this field would be announced as unnamed.
        expect(screen.getByRole('textbox', { name: 'Contenido' })).toBeInTheDocument();
    });

    it('stays clean after mount when nothing was edited', async () => {
        renderEditor(NON_CANONICAL_BODY);
        await waitForEditorMount();

        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

        // TipTap fires an update transaction when it first parses `content`.
        // Before HOS-371 that reached the parent's onChange and left the form
        // dirty on load — here it would mean every visit re-serializing the
        // stored Markdown through TipTap on the first save.
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('stays clean after mount when the post has no body yet', async () => {
        renderEditor('');
        await waitForEditorMount();

        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

        // The empty case emitted onChange('') before the fix — the same false
        // dirty signal, and the one a brand-new post would always hit.
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('does not send content when an unrelated field is the only edit', async () => {
        mockUpdate.mockResolvedValueOnce({ ok: true, data: {} });
        renderEditor(NON_CANONICAL_BODY);
        await waitForEditorMount();

        fireEvent.change(screen.getByLabelText('Título *'), {
            target: { value: 'Un título nuevo' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

        await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
        const body = mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
        expect(body).toEqual({ title: 'Un título nuevo' });
    });
});
