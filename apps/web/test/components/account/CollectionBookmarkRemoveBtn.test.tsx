/**
 * @file CollectionBookmarkRemoveBtn.test.tsx
 * @description HOS-957 — the confirmation actually GATES the removal.
 *
 * This island had no behavioural suite at all. `test/pages/coleccion-detail.test.ts`
 * covers it, but by READING its source as text and asserting substrings, which
 * cannot tell a gate that holds from a gate that is merely written down.
 *
 * The defect these two tests exist for is not "the native dialog came back" —
 * `scripts/check-no-native-dialogs.ts` owns that one, and it is completely
 * blind to this one. It is the dialog whose ANSWER is ignored: delete
 * `if (!confirmed) return` from the handler and the bookmark is removed on a
 * click of Cancel, with the guard still green and every source-reading
 * assertion still true.
 *
 * Both directions are asserted on purpose. "Cancel does not remove" alone is
 * satisfied by a button that never removes anything at all.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CollectionBookmarkRemoveBtn } from '@/components/account/CollectionBookmarkRemoveBtn.client';

vi.mock('@/components/account/CollectionBookmarkRemoveBtn.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (key: string, fallback?: string) => fallback ?? key
    })
}));

/**
 * The dialog itself belongs to `show-confirmation-dialog.test.tsx`; here it is
 * a knob so the two answers can be driven. Note that mocking it makes
 * "confirmed" the default, which is precisely what would hide a missing gate —
 * hence the explicit `false` case below.
 */
const showConfirmationDialogMock = vi.fn(async () => true);

vi.mock('@/lib/forms/show-confirmation-dialog', () => ({
    showConfirmationDialog: (...args: readonly unknown[]) => showConfirmationDialogMock(...args)
}));

const API_BASE = 'https://api.test';
const DELETE_URL = `${API_BASE}/api/v1/protected/user-bookmark-collections/col-1/bookmarks/bm-1`;

function renderButton() {
    return render(
        <CollectionBookmarkRemoveBtn
            collectionId="col-1"
            bookmarkId="bm-1"
            apiBase={API_BASE}
            locale="es"
        />
    );
}

describe('CollectionBookmarkRemoveBtn — the confirmation gates the removal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // `clearAllMocks` wipes the implementation too, so re-arm the default.
        showConfirmationDialogMock.mockResolvedValue(true);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('asks before removing anything', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        renderButton();
        fireEvent.click(screen.getByTestId('collection-bookmark-remove-btn'));

        await waitFor(() => {
            expect(showConfirmationDialogMock).toHaveBeenCalledTimes(1);
        });
    });

    it('does NOT call DELETE when the confirmation is cancelled', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        showConfirmationDialogMock.mockResolvedValue(false);

        renderButton();
        fireEvent.click(screen.getByTestId('collection-bookmark-remove-btn'));

        // Wait for the question to have been ASKED before asserting what did
        // not happen. A bare synchronous expect here passes even when the user
        // confirms, because the handler has not resumed off the microtask yet.
        await waitFor(() => {
            expect(showConfirmationDialogMock).toHaveBeenCalledTimes(1);
        });

        expect(fetchMock).not.toHaveBeenCalled();
        // And the button never entered its busy state.
        expect(screen.getByTestId('collection-bookmark-remove-btn')).not.toBeDisabled();
    });

    it('calls DELETE once the confirmation is accepted', async () => {
        // Answered NOT-ok on purpose: the component then shows its inline error
        // and returns, instead of reaching `window.location.reload()`, which
        // jsdom cannot perform. The request having been made is the assertion.
        const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
        vi.stubGlobal('fetch', fetchMock);

        renderButton();
        fireEvent.click(screen.getByTestId('collection-bookmark-remove-btn'));

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith(
                DELETE_URL,
                expect.objectContaining({ method: 'DELETE' })
            );
        });
    });
});
