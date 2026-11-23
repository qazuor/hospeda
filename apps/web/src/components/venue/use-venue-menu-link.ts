/**
 * @file use-venue-menu-link.ts
 * @description The carta's external link as part of the carta's save bar
 * (owner decision 14, Mi cuenta UI epic, superseding the separate «Guardar
 * enlace» button of DEC-FAC-062).
 *
 * The link keeps its OWN endpoint — a one-key `PATCH /protected/venues/:id`
 * with `{ menuUrl }` — and never rides in the carta's `PUT .../menu`, which
 * re-creates every dish (DEC-FAC-062 still holds there). What changed is who
 * triggers it: the draft is tracked here, «Guardar cambios» sends it when it
 * differs from the stored value, «Descartar» restores it, and the leave guard
 * sees it through the bar's `isDirty`.
 */

import { useCallback, useState } from 'react';
import { apiClient } from '@/lib/api/client';

/** Input of {@link useVenueMenuLink}. RO-RO. */
export interface UseVenueMenuLinkInput {
    readonly listingId: string;
    /** The stored link, or `null` when the venue has none. */
    readonly menuUrl: string | null;
}

/**
 * Normalizes a typed link: blank is an explicit clear (`null`).
 *
 * @param params - The raw `draft`.
 * @returns The value the PATCH sends.
 */
export function normalizeMenuUrl({ draft }: { readonly draft: string }): string | null {
    const trimmed = draft.trim();
    return trimmed === '' ? null : trimmed;
}

/**
 * Draft, stored value and save of the carta's external link.
 *
 * @param input - See {@link UseVenueMenuLinkInput}.
 * @returns The draft and its setter, the stored value, dirtiness, and the
 *   `save` / `discard` the carta's bar composes.
 */
export function useVenueMenuLink({ listingId, menuUrl }: UseVenueMenuLinkInput) {
    const [currentMenuUrl, setStoredMenuUrl] = useState<string | null>(menuUrl);
    const [menuUrlDraft, setMenuUrlDraft] = useState(menuUrl ?? '');
    const isLinkDirty = normalizeMenuUrl({ draft: menuUrlDraft }) !== currentMenuUrl;

    /** Replaces the stored value and the draft at once («Vaciar», a reload). */
    const setCurrentMenuUrl = useCallback((next: string | null) => {
        setStoredMenuUrl(next);
        setMenuUrlDraft(next ?? '');
    }, []);

    const discardLink = useCallback(() => {
        setMenuUrlDraft(currentMenuUrl ?? '');
    }, [currentMenuUrl]);

    /** Sends the draft; resolves whether the API stored it. */
    const saveLink = useCallback(async (): Promise<boolean> => {
        const next = normalizeMenuUrl({ draft: menuUrlDraft });
        try {
            const result = await apiClient.patch<unknown>({
                path: `/api/v1/protected/venues/${listingId}`,
                // ONE key: the link's own edit, never the whole form.
                body: { menuUrl: next }
            });
            if (!result.ok) return false;
        } catch {
            return false;
        }
        setCurrentMenuUrl(next);
        return true;
    }, [listingId, menuUrlDraft, setCurrentMenuUrl]);

    return {
        currentMenuUrl,
        setCurrentMenuUrl,
        menuUrlDraft,
        setMenuUrlDraft,
        isLinkDirty,
        saveLink,
        discardLink
    };
}
