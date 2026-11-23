/**
 * @file use-venue-menu.ts
 * @description State and persistence of the carta panel (HOS-895), split out
 * of `VenueMenuManager.client.tsx` (HOS-2490). The panel renders; this hook
 * loads, edits the draft and talks to the API.
 *
 * ## Draft and bar (HOS-2487)
 *
 * The structured carta is a LOCAL DRAFT committed by the editor save bar in
 * one `PUT` of the whole document: `isDirty` compares it with the last saved
 * copy, `discard` restores that copy, and `saveMenu` resolves the
 * `SaveOutcome` the bar expects. The uploaded photo/PDF is NOT part of the
 * draft: it persists on its own request.
 *
 * The external link IS on the bar since owner decision 14 (superseding the
 * separate «Guardar enlace» of DEC-FAC-062): `useVenueMenuLink` tracks it and
 * the same «Guardar cambios» sends it to its own one-key PATCH. A save that
 * stores one of the two and not the other says so in the bar, and only the
 * part that failed stays dirty.
 */

import { useCallback, useEffect, useState } from 'react';
import type { SaveOutcome } from '@/components/account/ui/use-save-bar';
import { type ListingPlanGate, useListingPlanGate } from '@/hooks/useListingPlanGate';
import { useSectionVaciar } from '@/hooks/useSectionVaciar';
import { apiClient } from '@/lib/api/client';
import { getApiUrl } from '@/lib/env';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import type { VenueUpsellPlans } from '@/lib/venue/section-upsell-plan';
import { useVenueMenuLink } from './use-venue-menu-link';
import { translateUpsell } from './VenueSectionLockedPanel.client';
import {
    buildMenuPayload,
    draftFromEnvelope,
    EMPTY_ITEM,
    EMPTY_SECTION,
    isEntitlementRefusal,
    MENU_ENTITLEMENT,
    type MenuEnvelope,
    type MenuFile,
    type MenuItemDraft,
    type MenuItemPhotoUpload,
    type MenuSectionDraft,
    movedBy,
    PHOTO_UPSELL_COPY,
    readErrorCode,
    refusedGateOf,
    sameMenuDraft,
    TRANSLATION_UPSELL_COPY
} from './venue-menu-draft';

/** What the panel is doing right now. */
export type MenuPanelState = 'loading' | 'idle' | 'saving' | 'uploading';

/** Input of {@link useVenueMenu}. */
export interface UseVenueMenuInput {
    readonly listingId: string;
    readonly locale: SupportedLocale;
    readonly menuUrl: string | null;
    readonly upsellPlans?: Pick<VenueUpsellPlans, 'menu' | 'itemPhotos' | 'translations'>;
}

/**
 * Loads the carta and exposes its draft, its locks and every write.
 *
 * @param input - See {@link UseVenueMenuInput}.
 * @returns The panel state and actions.
 */
export function useVenueMenu({ listingId, locale, menuUrl, upsellPlans }: UseVenueMenuInput) {
    const { t } = createTranslations(locale);
    const [sections, setSections] = useState<readonly MenuSectionDraft[]>([]);
    const [savedSections, setSavedSections] = useState<readonly MenuSectionDraft[]>([]);
    const [file, setFile] = useState<MenuFile | null>(null);
    const link = useVenueMenuLink({ listingId, menuUrl });
    const { currentMenuUrl, setCurrentMenuUrl } = link;
    /** HOS-1763. The name of the file chosen in THIS session (the input is cleared). */
    const [pickedFileName, setPickedFileName] = useState<string | null>(null);
    const [state, setState] = useState<MenuPanelState>('loading');
    const [message, setMessage] = useState<string | null>(null);
    /** The carta gate refused a save: no further carta save is possible. */
    const [isLocked, setIsLocked] = useState(false);
    /** HOS-1045. Separate lock: removing the photos and saving is the way out. */
    const [isPhotoLocked, setIsPhotoLocked] = useState(false);
    /** HOS-1043. Separate lock: clearing EN/PT and saving is the way out. */
    const [isTranslationLocked, setIsTranslationLocked] = useState(false);
    const { gate: readGate } = useListingPlanGate({
        vertical: 'venue',
        entitlementKey: MENU_ENTITLEMENT
    });
    const [refusedGate, setRefusedGate] = useState<Exclude<ListingPlanGate, 'open'> | null>(null);
    const menuGate: ListingPlanGate = refusedGate ?? readGate;
    const basePath = `/api/v1/protected/venues/${listingId}/menu`;

    // The read is PROTECTED (HOS-1854): the API is another origin, and without
    // the session cookie it answers 401 and the stored dishes stay invisible.
    useEffect(() => {
        let cancelled = false;
        void (async () => {
            const result = await apiClient.getProtected<MenuEnvelope>({ path: basePath });
            if (cancelled) return;
            if (result.ok) {
                const draft = draftFromEnvelope(result.data);
                setSections(draft);
                setSavedSections(draft);
                setFile(result.data.file);
            }
            setState('idle');
        })();
        return () => {
            cancelled = true;
        };
    }, [basePath]);

    const lockToGate = useCallback(() => {
        setRefusedGate(readGate === 'open' ? 'plan' : readGate);
    }, [readGate]);

    // ── Draft edits ─────────────────────────────────────────────────────────

    const addSection = useCallback(() => {
        setSections((prev) => [...prev, { ...EMPTY_SECTION }]);
    }, []);

    const removeSection = useCallback((index: number) => {
        setSections((prev) => prev.filter((_, i) => i !== index));
    }, []);

    const moveSection = useCallback((index: number, delta: number) => {
        setSections((prev) => movedBy(prev, index, delta));
    }, []);

    const patchSection = useCallback((index: number, patch: Partial<MenuSectionDraft>) => {
        setSections((prev) =>
            prev.map((section, i) => (i === index ? { ...section, ...patch } : section))
        );
    }, []);

    const updateItems = useCallback(
        (sectionIndex: number, update: (items: readonly MenuItemDraft[]) => MenuItemDraft[]) => {
            setSections((prev) =>
                prev.map((section, i) =>
                    i === sectionIndex ? { ...section, items: update(section.items) } : section
                )
            );
        },
        []
    );

    const addItem = useCallback(
        (sectionIndex: number) =>
            updateItems(sectionIndex, (items) => [...items, { ...EMPTY_ITEM }]),
        [updateItems]
    );

    const removeItem = useCallback(
        (sectionIndex: number, itemIndex: number) =>
            updateItems(sectionIndex, (items) => items.filter((_, j) => j !== itemIndex)),
        [updateItems]
    );

    const moveItem = useCallback(
        (sectionIndex: number, itemIndex: number, delta: number) =>
            updateItems(sectionIndex, (items) => movedBy(items, itemIndex, delta)),
        [updateItems]
    );

    const patchItem = useCallback(
        (sectionIndex: number, itemIndex: number, patch: Partial<MenuItemDraft>) =>
            updateItems(sectionIndex, (items) =>
                items.map((item, j) => (j === itemIndex ? { ...item, ...patch } : item))
            ),
        [updateItems]
    );

    /**
     * Uploads ONE dish photo and parks it on that dish's draft (HOS-1045). The
     * bytes leave immediately; the ASSOCIATION rides in the next save, because
     * `PUT .../menu` re-creates every dish row and there is no id to bind to.
     */
    const uploadItemPhoto = useCallback(
        async (sectionIndex: number, itemIndex: number, selected: File) => {
            setState('uploading');
            setMessage(null);
            const body = new FormData();
            body.append('file', selected);
            let response: Response | undefined;
            try {
                // Multipart across origins: `credentials: 'include'` carries the cookie.
                response = await fetch(`${getApiUrl()}${basePath}-item-photo`, {
                    method: 'POST',
                    credentials: 'include',
                    body
                });
            } catch {
                response = undefined;
            }
            setState('idle');

            if (response?.status === 403) {
                setIsPhotoLocked(true);
                setMessage(
                    translateUpsell({ t, planName: upsellPlans?.itemPhotos, ...PHOTO_UPSELL_COPY })
                );
                return;
            }
            const failed = t(
                'venue.owner.editor.menuManager.photoUploadError',
                'No se pudo subir la foto del plato.'
            );
            if (!response?.ok) {
                setMessage(failed);
                return;
            }
            const parsed = (await response.json()) as { data?: MenuItemPhotoUpload };
            if (!parsed.data?.url) {
                setMessage(failed);
                return;
            }
            patchItem(sectionIndex, itemIndex, {
                photoUrl: parsed.data.url,
                photoPublicId: parsed.data.publicId ?? null
            });
            setMessage(
                t(
                    'venue.owner.editor.menuManager.photoAttached',
                    'Foto agregada. Acordate de guardar la carta.'
                )
            );
        },
        [basePath, patchItem, t, upsellPlans?.itemPhotos]
    );

    /** Detaches a dish photo; the alt goes with it (it described that picture). */
    const removeItemPhoto = useCallback(
        (sectionIndex: number, itemIndex: number) =>
            patchItem(sectionIndex, itemIndex, {
                photoUrl: null,
                photoPublicId: null,
                photoAlt: null
            }),
        [patchItem]
    );

    // ── Bar ─────────────────────────────────────────────────────────────────

    const areSectionsDirty = !sameMenuDraft(sections, savedSections);
    const isDirty = areSectionsDirty || link.isLinkDirty;
    const { discardLink, saveLink, isLinkDirty } = link;

    const discard = useCallback(() => {
        setSections(savedSections);
        discardLink();
        setMessage(null);
    }, [discardLink, savedSections]);

    const saveSections = useCallback(async (): Promise<SaveOutcome> => {
        const payload = buildMenuPayload(sections);
        const result = await apiClient.put<MenuEnvelope>({ path: basePath, body: payload });

        if (result.ok) {
            setSavedSections(sections);
            setMessage(t('venue.owner.editor.menuManager.saved', 'Carta guardada.'));
            return { ok: true };
        }

        // A refusal here is the plan speaking, not a failure: the payload decides
        // which of the three gates it was (see `refusedGateOf`).
        if (isEntitlementRefusal(result.error.status, result.error.code)) {
            const gate = refusedGateOf(payload);
            if (gate === 'photo') {
                setIsPhotoLocked(true);
                setMessage(
                    translateUpsell({ t, planName: upsellPlans?.itemPhotos, ...PHOTO_UPSELL_COPY })
                );
            } else if (gate === 'translation') {
                setIsTranslationLocked(true);
                setMessage(
                    translateUpsell({
                        t,
                        planName: upsellPlans?.translations,
                        ...TRANSLATION_UPSELL_COPY
                    })
                );
            } else {
                setIsLocked(true);
                lockToGate();
            }
            return { ok: false };
        }

        // Told by the save bar alone (owner decision 7), never repeated below.
        return {
            ok: false,
            message: t('venue.owner.editor.menuManager.saveError', 'No se pudo guardar la carta.')
        };
    }, [basePath, lockToGate, sections, t, upsellPlans?.itemPhotos, upsellPlans?.translations]);

    const saveMenu = useCallback(async (): Promise<SaveOutcome> => {
        setState('saving');
        setMessage(null);
        const [sectionsOutcome, linkSaved] = await Promise.all([
            areSectionsDirty ? saveSections() : Promise.resolve<SaveOutcome>({ ok: true }),
            isLinkDirty ? saveLink() : Promise.resolve(true)
        ]);
        setState('idle');
        if (sectionsOutcome.ok && linkSaved) return { ok: true };
        if (sectionsOutcome.ok) {
            // The carta (if it changed) is stored; the link is the part left dirty.
            return {
                ok: false,
                message: areSectionsDirty
                    ? t(
                          'venue.owner.editor.menuManager.savedMenuNotLink',
                          'Se guardó la carta, pero no el enlace al menú. Probá guardar de nuevo.'
                      )
                    : t(
                          'venue.owner.editor.menuManager.linkSaveError',
                          'No se pudo guardar el enlace.'
                      )
            };
        }
        if (isLinkDirty && linkSaved) {
            // The link is stored; the carta is the part left dirty.
            return {
                ok: false,
                message: t(
                    'venue.owner.editor.menuManager.savedLinkNotMenu',
                    'Se guardó el enlace al menú, pero no la carta. Probá guardar de nuevo.'
                )
            };
        }
        return sectionsOutcome;
    }, [areSectionsDirty, isLinkDirty, saveLink, saveSections, t]);

    // ── The uploaded photo / PDF (persists on its own request) ─────────────

    const uploadFile = useCallback(
        async (selected: File) => {
            setPickedFileName(selected.name);
            setState('uploading');
            setMessage(null);
            const body = new FormData();
            body.append('file', selected);
            let response: Response | undefined;
            try {
                response = await fetch(`${getApiUrl()}${basePath}-file`, {
                    method: 'POST',
                    credentials: 'include',
                    body
                });
            } catch {
                response = undefined;
            }
            setState('idle');

            if (
                response?.status === 403 &&
                isEntitlementRefusal(response.status, await readErrorCode(response))
            ) {
                lockToGate();
                return;
            }
            if (!response?.ok) {
                setMessage(
                    t(
                        'venue.owner.editor.menuManager.uploadError',
                        'No se pudo subir el archivo del menú.'
                    )
                );
                return;
            }
            const parsed = (await response.json()) as { data?: { file?: MenuFile } };
            if (parsed.data?.file) {
                setFile(parsed.data.file);
                setMessage(
                    t('venue.owner.editor.menuManager.uploaded', 'Archivo del menú subido.')
                );
            }
        },
        [basePath, lockToGate, t]
    );

    const deleteFile = useCallback(async () => {
        setState('saving');
        setMessage(null);
        const result = await apiClient.delete<{ success: boolean }>({ path: `${basePath}-file` });
        setState('idle');
        if (result.ok) {
            setFile(null);
            setPickedFileName(null);
            setMessage(
                t('venue.owner.editor.menuManager.fileRemoved', 'Archivo del menú eliminado.')
            );
            return;
        }
        if (isEntitlementRefusal(result.error.status, result.error.code)) {
            lockToGate();
            return;
        }
        setMessage(
            t(
                'venue.owner.editor.menuManager.deleteError',
                'No se pudo eliminar el archivo del menú.'
            )
        );
    }, [basePath, lockToGate, t]);

    /**
     * HOS-1854. Empties a locked carta through the API's `delete` intent (an
     * empty `sections` array, DEC-FAC-041), then the file and the link — the
     * link through a one-key PATCH (HOS-2038), never the whole form.
     */
    const clearMenu = useCallback(async (): Promise<boolean> => {
        setState('saving');
        setMessage(null);
        const fail = (): false => {
            setState('idle');
            setMessage(
                t('venue.owner.editor.lockedSection.vaciarError', 'No se pudo vaciar la sección.')
            );
            return false;
        };

        const result = await apiClient.put<MenuEnvelope>({
            path: basePath,
            body: { sections: [] }
        });
        if (!result.ok) return fail();

        if (file) {
            const removed = await apiClient.delete<{ success: boolean }>({
                path: `${basePath}-file`
            });
            if (!removed.ok) return fail();
        }

        if (currentMenuUrl) {
            const cleared = await apiClient.patch<unknown>({
                path: `/api/v1/protected/venues/${listingId}`,
                body: { menuUrl: null }
            });
            if (!cleared.ok) return fail();
        }

        setSections([]);
        setSavedSections([]);
        setFile(null);
        setCurrentMenuUrl(null);
        setPickedFileName(null);
        setState('idle');
        setMessage(t('venue.owner.editor.lockedSection.vaciarSuccess', 'Se vació la sección.'));
        return true;
    }, [basePath, currentMenuUrl, file, listingId, setCurrentMenuUrl, t]);

    const vaciar = useSectionVaciar({ clear: clearMenu });

    return {
        sections,
        file,
        currentMenuUrl,
        setCurrentMenuUrl,
        menuUrlDraft: link.menuUrlDraft,
        setMenuUrlDraft: link.setMenuUrlDraft,
        pickedFileName,
        state,
        message,
        isLocked,
        isPhotoLocked,
        isTranslationLocked,
        readGate,
        menuGate,
        isDirty,
        discard,
        saveMenu,
        addSection,
        removeSection,
        moveSection,
        patchSection,
        addItem,
        removeItem,
        moveItem,
        patchItem,
        uploadItemPhoto,
        removeItemPhoto,
        uploadFile,
        deleteFile,
        vaciar
    };
}

/** What {@link useVenueMenu} returns. */
export type VenueMenuState = ReturnType<typeof useVenueMenu>;
