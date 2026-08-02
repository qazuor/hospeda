/**
 * @file CommerceListingEditor.rich-description.test.tsx
 * @description Integration guard (HOS-371) for the `richDescription` field
 * after it became a TipTap editor.
 *
 * Kept out of `CommerceListingEditor.test.tsx` on purpose: that suite mocks
 * `RichTextEditor` with a `<textarea>` shim so the payload/dirty-tracking tests
 * stay fast, and a mocked editor cannot reproduce TipTap's mount-time update
 * transaction — which is the whole point of this file.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommerceListingEditor } from '../../../src/components/commerce/CommerceListingEditor.client';
import type { CommerceListingDetail } from '../../../src/lib/commerce/owner-listings';

vi.mock('@/store/toast-store', () => ({ addToast: vi.fn() }));

vi.mock('../../../src/components/commerce/CommerceListingEditor.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('../../../src/components/commerce/CommerceTranslationPanel.client', () => ({
    CommerceTranslationPanel: () => null,
    parseCommerceI18nValues: () => ({
        nameI18n: { es: '', en: '', pt: '' },
        summaryI18n: { es: '', en: '', pt: '' },
        descriptionI18n: { es: '', en: '', pt: '' },
        richDescriptionI18n: { es: '', en: '', pt: '' }
    })
}));

vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: () => ({
        t: (key: string, fallback?: string) => fallback ?? `[MISSING:${key}]`
    })
}));

vi.mock('../../../src/lib/api/client', () => ({ apiClient: { patch: vi.fn() } }));

vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    protectedMediaApi: { deleteMedia: vi.fn() }
}));

vi.mock('../../../src/lib/env', () => ({ getApiUrl: () => 'http://api.test' }));

vi.mock('../../../src/lib/logger', () => ({ webLogger: { warn: vi.fn() } }));

import { apiClient } from '../../../src/lib/api/client';

const mockPatch = vi.mocked(apiClient.patch);

const DESTINATION_1 = '11111111-1111-4111-8111-111111111111';

/** Renders the editor with `richDescription` seeded (or not). */
function renderEditor(richDescription: string | undefined) {
    return render(
        <CommerceListingEditor
            vertical="gastronomy"
            listingId="abc"
            locale="es"
            initialData={
                {
                    id: 'abc',
                    ownerId: 'owner-1',
                    name: 'La Parrilla',
                    slug: 'la-parrilla',
                    destinationId: DESTINATION_1,
                    richDescription
                } as unknown as CommerceListingDetail
            }
            destinations={[{ id: DESTINATION_1, name: 'Concepción del Uruguay' }]}
        />
    );
}

/** Waits for the deferred (`immediatelyRender: false`) TipTap editor to mount. */
async function waitForEditorMount(): Promise<void> {
    await waitFor(() => expect(document.querySelector('.ProseMirror')).toBeTruthy());
    await new Promise((resolve) => setTimeout(resolve, 50));
}

describe('CommerceListingEditor — richDescription as a rich text editor', () => {
    beforeEach(() => {
        mockPatch.mockReset();
    });

    it('renders a rich text editor with a toolbar instead of a bare textarea', async () => {
        renderEditor('Texto existente');
        await waitForEditorMount();

        expect(screen.getByRole('toolbar', { name: 'Formato' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /negrita/i })).toBeInTheDocument();
    });

    it('exposes the field with an accessible name (the label cannot reach a contenteditable)', async () => {
        renderEditor('Texto existente');
        await waitForEditorMount();

        // A `<label htmlFor>` only names form controls; the editing surface is a
        // contenteditable `role="textbox"`, so without the explicit ariaLabel
        // this field would be announced as unnamed.
        expect(screen.getByRole('textbox', { name: 'Descripción ampliada' })).toBeInTheDocument();
    });

    it('keeps Save disabled after mount when nothing was edited', async () => {
        renderEditor('Texto existente');
        await waitForEditorMount();

        // Regression guard: TipTap fires an update transaction when it first
        // parses `content`. That reached `markDirty('richDescription')` and left
        // the form dirty on load — Save enabled with zero edits, and every
        // subsequent save re-serializing the stored Markdown through TipTap.
        expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
    });

    it('keeps Save disabled after mount when the listing has no rich description yet', async () => {
        renderEditor(undefined);
        await waitForEditorMount();

        // The empty case emitted onChange('') before the fix — same false-dirty
        // signal, and the one every brand-new listing would hit.
        expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
    });

    it('does not send richDescription when an unrelated field is the only edit', async () => {
        mockPatch.mockResolvedValueOnce({ ok: true, data: {} });
        renderEditor('Texto existente');
        await waitForEditorMount();

        fireEvent.change(screen.getByLabelText('Nombre del comercio'), {
            target: { value: 'La Nueva Parrilla' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
        const body = mockPatch.mock.calls[0]?.[0]?.body as Record<string, unknown>;
        expect(body).not.toHaveProperty('richDescription');
        expect(body).toEqual({ name: 'La Nueva Parrilla' });
    });
});
