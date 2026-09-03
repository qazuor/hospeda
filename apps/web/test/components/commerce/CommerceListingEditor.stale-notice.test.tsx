/**
 * @file CommerceListingEditor.stale-notice.test.tsx
 * @description Regression guard (HOS-816): a notice belongs to the operation
 * that produced it, and must not outlive it.
 *
 * The bug was one missing line. `handleApiError` only ever SETS the form-level
 * banner, and the success branch never cleared it, so a save that failed and
 * then succeeded put the green "Cambios guardados" toast and the red
 * "something went wrong" banner on screen at the same time — and the banner is
 * the one a person believes. In an editor whose sections save independently
 * (FAQs have their own endpoints) that stale red text also sat next to
 * unrelated successes, which is how it was reported.
 *
 * What makes this a real guard is the SEQUENCE: fail, then succeed, then assert
 * the FIRST notice is GONE. A test that only checked the success toast on the
 * second save passed with the bug fully present — the defect is that the first
 * notice survives, not that the second one is missing.
 *
 * @module test/components/commerce/CommerceListingEditor.stale-notice
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addToast } from '@/store/toast-store';
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
        t: (key: string, fallback?: string, params?: Record<string, unknown>) => {
            const raw =
                key === 'commerce.owner.editor.validation.summaryHint'
                    ? '{{count}}/300'
                    : (fallback ?? `[MISSING:${key}]`);
            if (!params) return raw;
            return Object.keys(params).reduce(
                (acc, k) => acc.replaceAll(`{{${k}}}`, String(params[k])),
                raw
            );
        }
    })
}));

// Booting real TipTap in this suite buys nothing: what is under test is the
// notice lifecycle, which only needs a controlled field to dirty the form.
vi.mock('@/components/host/editor/RichTextEditor.client', () => ({
    RichTextEditor: ({
        value,
        onChange,
        ariaLabel
    }: {
        value: string;
        onChange: (value: string) => void;
        ariaLabel?: string;
    }) => (
        <textarea
            aria-label={ariaLabel}
            value={value}
            onChange={(event) => onChange(event.target.value)}
        />
    )
}));

// `get` is stubbed because the gastronomy branch of the editor mounts
// `CommerceMenuManager`, which reads its own carta on mount (HOS-895).
vi.mock('../../../src/lib/api/client', () => ({
    apiClient: {
        get: vi.fn().mockResolvedValue({ ok: true, data: { sections: [], file: null } }),
        patch: vi.fn()
    }
}));

vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    protectedMediaApi: { deleteMedia: vi.fn().mockResolvedValue({ ok: true, data: {} }) },
    commerceMediaApi: {
        listMedia: vi.fn().mockResolvedValue({ ok: true, data: { media: [] } }),
        addMedia: vi.fn().mockResolvedValue({ ok: true, data: { media: {} } }),
        removeMedia: vi.fn().mockResolvedValue({ ok: true, data: {} }),
        setFeaturedMedia: vi.fn().mockResolvedValue({ ok: true, data: { media: {} } })
    }
}));

vi.mock('../../../src/lib/env', () => ({ getApiUrl: () => 'http://api.test' }));

vi.mock('../../../src/lib/logger', () => ({ webLogger: { warn: vi.fn() } }));

import { apiClient } from '../../../src/lib/api/client';

const mockPatch = vi.mocked(apiClient.patch);

const DESTINATION_1 = '11111111-1111-4111-8111-111111111111';

/** The 500 the smoke actually hit, verbatim. */
const SERVER_ERROR = {
    status: 500,
    code: 'INTERNAL_ERROR',
    message: 'Algo salió mal del lado nuestro. Intentá de nuevo en un momento.'
};

const baseData = {
    id: 'abc',
    ownerId: 'owner-1',
    name: 'La Parrilla',
    slug: 'la-parrilla',
    destinationId: DESTINATION_1,
    description: 'Descripción original con suficiente longitud para pasar validación.',
    richDescription: 'old text'
} as unknown as CommerceListingDetail;

function renderEditor() {
    return render(
        <CommerceListingEditor
            vertical="gastronomy"
            listingId="abc"
            locale="es"
            initialData={baseData}
            destinations={[{ id: DESTINATION_1, name: 'Concepción del Uruguay' }]}
        />
    );
}

/**
 * The form-level banner, or `null`.
 *
 * Selected by "a `role="alert"` paragraph with NO id": `FieldError` always
 * renders an `id` (`<field>-error`), the form banner never does. Matching every
 * alert instead would let a per-field message stand in for the banner and make
 * the "it is gone" assertion pass for the wrong reason.
 *
 * @param container - The rendered container.
 * @returns The banner's text, or `null` when no banner is on screen.
 */
function bannerText(container: HTMLElement): string | null {
    const banners = container.querySelectorAll('p[role="alert"]:not([id])');
    expect(banners.length).toBeLessThanOrEqual(1);
    return banners[0]?.textContent ?? null;
}

/** Dirties the form and presses Save. */
function saveWith(value: string): void {
    fireEvent.change(screen.getByLabelText('Descripción ampliada'), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
}

describe('CommerceListingEditor — a notice does not outlive its operation (HOS-816)', () => {
    beforeEach(() => {
        mockPatch.mockReset();
        vi.mocked(addToast).mockClear();
    });

    it('drops the failed save’s banner once the next save succeeds', async () => {
        const { container } = renderEditor();

        // --- operation 1: fails ---
        mockPatch.mockResolvedValueOnce({ ok: false, error: SERVER_ERROR } as never);
        saveWith('primer intento');

        await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
        // Captured, not hardcoded: the exact wording comes from the shared
        // api-error translator, and this guard is about the banner's LIFETIME,
        // not its copy.
        const firstNotice = await waitFor(() => {
            const text = bannerText(container);
            expect(text).toBeTruthy();
            return text as string;
        });

        // --- operation 2: succeeds ---
        mockPatch.mockResolvedValueOnce({ ok: true, data: {} } as never);
        saveWith('segundo intento');

        await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(2));
        await waitFor(() =>
            expect(addToast).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'success', message: 'Cambios guardados.' })
            )
        );

        // THE assertion. With the bug present the success toast above fires all
        // the same and this line is the only one that fails.
        expect(bannerText(container)).toBeNull();
        expect(container.textContent).not.toContain(firstNotice);
    });

    it('clears the banner as the next attempt STARTS, not only when it resolves', async () => {
        const { container } = renderEditor();

        mockPatch.mockResolvedValueOnce({ ok: false, error: SERVER_ERROR } as never);
        saveWith('primer intento');
        await waitFor(() => expect(bannerText(container)).toBeTruthy());

        // A request that never settles: the banner must already be gone while
        // the second save is in flight. Otherwise the owner watches the previous
        // failure's message during an attempt that has not answered yet.
        mockPatch.mockReturnValueOnce(new Promise(() => {}) as never);
        saveWith('segundo intento');

        await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(2));
        expect(bannerText(container)).toBeNull();
    });

    it('clears it on the no-changes path too', async () => {
        const { container } = renderEditor();

        mockPatch.mockResolvedValueOnce({ ok: false, error: SERVER_ERROR } as never);
        saveWith('primer intento');
        await waitFor(() => expect(bannerText(container)).toBeTruthy());

        // Restore the original value: the form is clean again, so Save answers
        // with the "nothing to save" toast and sends no request. The stale
        // banner must not survive that branch either.
        fireEvent.change(screen.getByLabelText('Descripción ampliada'), {
            target: { value: 'old text' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

        await waitFor(() =>
            expect(addToast).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'info', message: 'No hay cambios para guardar' })
            )
        );
        expect(mockPatch).toHaveBeenCalledTimes(1);
        expect(bannerText(container)).toBeNull();
    });
});
