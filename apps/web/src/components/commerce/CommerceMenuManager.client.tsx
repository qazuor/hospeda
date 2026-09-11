/**
 * @file CommerceMenuManager.client.tsx
 * @description The owner's carta editor for a gastronomy listing (HOS-895).
 *
 * ## Three ways to show a menu, side by side
 *
 * A small restaurant rarely has a published menu page, and before HOS-895 a
 * link to one was the only thing this product could store. This panel offers
 * the two others next to it:
 *
 *  - the **structured carta** — courses and dishes, typed;
 *  - an **uploaded photo or PDF** of the printed menu.
 *
 * The external link stays where it already was, in `PriceSection`. Nothing here
 * is mandatory and nothing here excludes anything else: an owner may publish
 * with a photo alone, and is never made to type forty dishes.
 *
 * ## Why this manager persists on its own, like `CommerceFaqManager`
 *
 * The parent editor's PATCH body is a diff of `CommerceEditData`, and a carta is
 * a nested document with its own endpoints. It is mounted inside the form for
 * layout, exactly as the FAQ manager is, but nothing here reaches the parent's
 * dirty tracking (HOS-811).
 *
 * The two halves persist DIFFERENTLY, and deliberately:
 *
 *  - the carta is saved by an explicit button, in one `PUT` of the whole
 *    document — a course renamed, a dish moved and two deleted is one thought
 *    and one transaction;
 *  - the file is persisted by the upload request ITSELF, with no Save, because
 *    it is a real Cloudinary asset. HOS-372 measured what deferring that costs:
 *    an owner who uploads and walks away leaves the asset billing with nothing
 *    pointing at it.
 *
 * ## The photo per dish (HOS-1045)
 *
 * Uploaded from the dish's own row, never from a gallery elsewhere on the page.
 * That is the whole point of the issue: a picture chosen in one list and later
 * matched to a dish in another is a matching task the owner has to redo every
 * time either list moves.
 *
 * It persists in TWO steps, and the split is forced by the carta's own write
 * model rather than chosen: the BYTES go up immediately
 * (`POST .../menu-item-photo`, because an upload is an upload), and the
 * ASSOCIATION rides in the next "Guardar carta" like every other field of the
 * dish — because `PUT .../menu` mints a new id for every dish it writes, so
 * there is no id an upload could have attached itself to. The consequence is
 * visible and is worth stating: a photo uploaded and not saved is lost from the
 * carta, exactly as a dish name typed and not saved is.
 *
 * ## The 403 is a real state, not an error
 *
 * The structured carta is a `gastronomy-pro` capability, and the page this
 * mounts on carries no entitlement information — the same situation
 * `BrochureDownloadButton` is in. So the fields render for every owner and the
 * API decides; a refusal is shown as the upsell sentence it is, never as
 * "something went wrong". The uploaded file and the link are NOT gated and stay
 * usable on every tier.
 *
 * ## Translations (HOS-1043)
 *
 * `nameEn`/`namePt`/`descriptionEn`/`descriptionPt` are plain draft fields,
 * unlike the photo: there is no separate upload endpoint to gate ahead of
 * time, because a translation has no bytes of its own. So the fields are
 * always editable and the gate fires only at "Guardar carta", the same way the
 * carta's OWN gate does — the API decides, and a refusal is shown as the
 * upsell sentence it is (`isTranslationLocked`). A translation is submitted
 * ONLY when BOTH `en` and `pt` are filled (the ES leg comes from the legacy
 * `name`/`description` at save time): the write schema requires all three
 * locales together, so a half-filled pair would 400 rather than silently
 * publish an empty string as "the English name".
 */

import type { JSX } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { centsToPesosInputValue, parsePesosInputToCents } from '@/lib/commerce/price-units';
import { getApiUrl } from '@/lib/env';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { resolveSafeExternalUrl } from '@/lib/safe-external-url';
import styles from './CommerceMenuManager.module.css';
import { MenuTranslationFields } from './MenuTranslationFields.client';

/** What the API returns for the uploaded photo/PDF. */
interface MenuFile {
    readonly url: string;
    readonly kind: 'image' | 'pdf';
}

/** A localized `{es,en,pt}` value, or `null` when never translated. */
interface I18nTextValue {
    readonly es: string;
    readonly en: string;
    readonly pt: string;
}

/** One dish, as held in form state. Ids are not carried — see the payload schema. */
interface MenuItemDraft {
    name: string;
    description: string;
    /** Price in CENTAVOS, or `null` for "a consultar". */
    priceCents: number | null;
    isAvailable: boolean;
    /** Delivery URL of the dish photo (HOS-1045), or `null` for none. */
    photoUrl: string | null;
    /** Cloudinary id of that asset, round-tripped so the server can destroy it. */
    photoPublicId: string | null;
    /** Alt text; `null` lets the public page fall back to the dish's name. */
    photoAlt: string | null;
    /** English translation of {@link name} (HOS-1043). Empty means "not translated". */
    nameEn: string;
    /** Portuguese translation of {@link name} (HOS-1043). */
    namePt: string;
    /** English translation of {@link description} (HOS-1043). */
    descriptionEn: string;
    /** Portuguese translation of {@link description} (HOS-1043). */
    descriptionPt: string;
}

/** One course, as held in form state. */
interface MenuSectionDraft {
    name: string;
    description: string;
    /** English translation of {@link name} (HOS-1043). Empty means "not translated". */
    nameEn: string;
    /** Portuguese translation of {@link name} (HOS-1043). */
    namePt: string;
    /** English translation of {@link description} (HOS-1043). */
    descriptionEn: string;
    /** Portuguese translation of {@link description} (HOS-1043). */
    descriptionPt: string;
    items: MenuItemDraft[];
}

/** Shape of `GET /{id}/menu`. */
interface MenuEnvelope {
    readonly sections: ReadonlyArray<{
        readonly name: string;
        readonly description: string | null;
        readonly nameI18n: I18nTextValue | null;
        readonly descriptionI18n: I18nTextValue | null;
        readonly items: ReadonlyArray<{
            readonly name: string;
            readonly description: string | null;
            readonly nameI18n: I18nTextValue | null;
            readonly descriptionI18n: I18nTextValue | null;
            readonly priceCents: number | null;
            readonly isAvailable: boolean;
            readonly photoUrl: string | null;
            readonly photoPublicId: string | null;
            readonly photoAlt: string | null;
        }>;
    }>;
    readonly file: MenuFile | null;
}

export interface CommerceMenuManagerProps {
    /** UUID of the gastronomy listing. */
    readonly listingId: string;
    /** Active UI locale. */
    readonly locale: SupportedLocale;
}

const EMPTY_ITEM: MenuItemDraft = {
    name: '',
    description: '',
    priceCents: null,
    isAvailable: true,
    photoUrl: null,
    photoPublicId: null,
    photoAlt: null,
    nameEn: '',
    namePt: '',
    descriptionEn: '',
    descriptionPt: ''
};

/** A fresh section draft — see {@link EMPTY_ITEM} for the translation fields. */
const EMPTY_SECTION: MenuSectionDraft = {
    name: '',
    description: '',
    nameEn: '',
    namePt: '',
    descriptionEn: '',
    descriptionPt: '',
    items: []
};

/** What the per-dish photo upload route answers with. */
interface MenuItemPhotoUpload {
    readonly url: string;
    readonly publicId: string;
}

/** MIME types the per-dish photo input and the API both accept — images only. */
const ACCEPTED_ITEM_PHOTO_TYPES = 'image/jpeg,image/png,image/webp';

/** What the panel is doing right now. */
type PanelState = 'loading' | 'idle' | 'saving' | 'uploading';

/** MIME types the upload input and the API both accept. */
const ACCEPTED_MENU_FILE_TYPES = 'image/jpeg,image/png,image/webp,application/pdf';

/**
 * Builds the `{es,en,pt}` payload for a translated field (HOS-1043), or
 * `null` when there is nothing to submit.
 *
 * Requires BOTH `en` and `pt` non-empty before building anything: the write
 * schema (`i18nText`) requires all three locales together whenever the object
 * is present, so a half-filled pair would 400 instead of quietly publishing
 * the untranslated legacy text as "the English name" — which `en: ''` would
 * do if it were allowed through.
 *
 * @param legacy - The `es` source (the section/item's own `name`/`description`).
 * @param en - The draft English translation.
 * @param pt - The draft Portuguese translation.
 * @returns The `{es,en,pt}` object, or `null`.
 */
function buildI18nField(legacy: string, en: string, pt: string): I18nTextValue | null {
    const trimmedEn = en.trim();
    const trimmedPt = pt.trim();
    if (!trimmedEn || !trimmedPt) {
        return null;
    }
    return { es: legacy.trim(), en: trimmedEn, pt: trimmedPt };
}

/** Moves one entry of an array, returning a new array. Out-of-range is a no-op. */
function movedBy<T>(list: readonly T[], index: number, delta: number): T[] {
    const target = index + delta;
    if (target < 0 || target >= list.length) {
        return [...list];
    }
    const next = [...list];
    const [moved] = next.splice(index, 1);
    if (moved !== undefined) {
        next.splice(target, 0, moved);
    }
    return next;
}

export function CommerceMenuManager({ listingId, locale }: CommerceMenuManagerProps): JSX.Element {
    const { t } = createTranslations(locale);

    const [sections, setSections] = useState<MenuSectionDraft[]>([]);
    const [file, setFile] = useState<MenuFile | null>(null);
    const [state, setState] = useState<PanelState>('loading');
    const [message, setMessage] = useState<string | null>(null);
    const [isLocked, setIsLocked] = useState(false);
    /**
     * HOS-1045. A SECOND lock, and deliberately not folded into `isLocked`:
     * the carta lock disables Save (a `-basico` owner cannot save a carta at
     * all), while this one must leave Save working — the way out of it is to
     * remove the photos and save the carta without them, which a disabled Save
     * would make impossible.
     */
    const [isPhotoLocked, setIsPhotoLocked] = useState(false);
    /**
     * HOS-1043. A THIRD lock, same reasoning as `isPhotoLocked`: the way out
     * is to clear the EN/PT fields and save the carta in Spanish only, so Save
     * must stay enabled.
     */
    const [isTranslationLocked, setIsTranslationLocked] = useState(false);

    const basePath = `/api/v1/protected/gastronomies/${listingId}/menu`;

    // ── Load ────────────────────────────────────────────────────────────────
    // The panel reads its own state rather than receiving it from the SSR page:
    // the carta is not part of the listing payload the editor is built from, and
    // adding it there would make every editor load pay for a nested document
    // most owners will not open.
    useEffect(() => {
        let cancelled = false;

        void (async () => {
            const result = await apiClient.get<MenuEnvelope>({ path: basePath });
            if (cancelled) {
                return;
            }
            if (result.ok) {
                setSections(
                    result.data.sections.map((section) => ({
                        name: section.name,
                        description: section.description ?? '',
                        nameEn: section.nameI18n?.en ?? '',
                        namePt: section.nameI18n?.pt ?? '',
                        descriptionEn: section.descriptionI18n?.en ?? '',
                        descriptionPt: section.descriptionI18n?.pt ?? '',
                        items: section.items.map((item) => ({
                            name: item.name,
                            description: item.description ?? '',
                            nameEn: item.nameI18n?.en ?? '',
                            namePt: item.nameI18n?.pt ?? '',
                            descriptionEn: item.descriptionI18n?.en ?? '',
                            descriptionPt: item.descriptionI18n?.pt ?? '',
                            priceCents: item.priceCents,
                            isAvailable: item.isAvailable,
                            photoUrl: item.photoUrl ?? null,
                            photoPublicId: item.photoPublicId ?? null,
                            photoAlt: item.photoAlt ?? null
                        }))
                    }))
                );
                setFile(result.data.file);
            }
            setState('idle');
        })();

        return () => {
            cancelled = true;
        };
    }, [basePath]);

    // ── Structured carta ────────────────────────────────────────────────────

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

    const addItem = useCallback((sectionIndex: number) => {
        setSections((prev) =>
            prev.map((section, i) =>
                i === sectionIndex
                    ? { ...section, items: [...section.items, { ...EMPTY_ITEM }] }
                    : section
            )
        );
    }, []);

    const removeItem = useCallback((sectionIndex: number, itemIndex: number) => {
        setSections((prev) =>
            prev.map((section, i) =>
                i === sectionIndex
                    ? { ...section, items: section.items.filter((_, j) => j !== itemIndex) }
                    : section
            )
        );
    }, []);

    const patchItem = useCallback(
        (sectionIndex: number, itemIndex: number, patch: Partial<MenuItemDraft>) => {
            setSections((prev) =>
                prev.map((section, i) =>
                    i === sectionIndex
                        ? {
                              ...section,
                              items: section.items.map((item, j) =>
                                  j === itemIndex ? { ...item, ...patch } : item
                              )
                          }
                        : section
                )
            );
        },
        []
    );

    /**
     * Uploads ONE dish photo and parks it on that dish's draft.
     *
     * The bytes leave immediately; the ASSOCIATION does not — it is written by
     * the next "Guardar carta", because `PUT .../menu` re-creates every dish
     * row and there is no id an upload could bind to. So this sets draft state
     * and nothing more, and a photo added without saving is lost exactly as a
     * dish name typed without saving is.
     *
     * @param sectionIndex - Index of the course.
     * @param itemIndex - Index of the dish within it.
     * @param selected - The chosen file.
     */
    const uploadItemPhoto = useCallback(
        async (sectionIndex: number, itemIndex: number, selected: File) => {
            setState('uploading');
            setMessage(null);

            // A raw `fetch` rather than `apiClient`, for the reason the menu
            // file upload states: multipart across origins needs
            // `credentials: 'include'` to carry the session cookie.
            const body = new FormData();
            body.append('file', selected);

            let response: Response | undefined;
            try {
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
                    t(
                        'commerce.owner.editor.menuManager.photoLocked',
                        'Las fotos por plato están disponibles en el plan Premium. Podés quitar las fotos y guardar la carta igual.'
                    )
                );
                return;
            }

            if (!response?.ok) {
                setMessage(
                    t(
                        'commerce.owner.editor.menuManager.photoUploadError',
                        'No se pudo subir la foto del plato.'
                    )
                );
                return;
            }

            const parsed = (await response.json()) as { data?: MenuItemPhotoUpload };
            if (!parsed.data?.url) {
                setMessage(
                    t(
                        'commerce.owner.editor.menuManager.photoUploadError',
                        'No se pudo subir la foto del plato.'
                    )
                );
                return;
            }

            patchItem(sectionIndex, itemIndex, {
                photoUrl: parsed.data.url,
                photoPublicId: parsed.data.publicId ?? null
            });
            setMessage(
                t(
                    'commerce.owner.editor.menuManager.photoAttached',
                    'Foto agregada. Acordate de guardar la carta.'
                )
            );
        },
        [basePath, patchItem, t]
    );

    /**
     * Detaches the photo from a dish's draft.
     *
     * Clears the alt text along with the URL: an alt describing a picture that
     * is no longer there would be published against whatever photo is attached
     * next.
     *
     * @param sectionIndex - Index of the course.
     * @param itemIndex - Index of the dish within it.
     */
    const removeItemPhoto = useCallback(
        (sectionIndex: number, itemIndex: number) => {
            patchItem(sectionIndex, itemIndex, {
                photoUrl: null,
                photoPublicId: null,
                photoAlt: null
            });
        },
        [patchItem]
    );

    const saveMenu = useCallback(async () => {
        setState('saving');
        setMessage(null);

        // Sections without a heading are DROPPED rather than rejected: an empty
        // row is what an owner leaves behind after clicking "add course" and
        // changing their mind, and failing the whole save over it would lose the
        // forty dishes they did type. Same for a nameless dish.
        const payload = {
            sections: sections
                .filter((section) => section.name.trim().length > 0)
                .map((section) => ({
                    name: section.name.trim(),
                    description: section.description.trim() || null,
                    // HOS-1043 — submitted ONLY when BOTH en and pt are filled.
                    // The write schema requires all three locales together
                    // whenever the object is present at all, so a half-filled
                    // pair is not sent rather than 400ing on a save the owner
                    // has no field to fix from here.
                    nameI18n: buildI18nField(section.name, section.nameEn, section.namePt),
                    descriptionI18n: buildI18nField(
                        section.description,
                        section.descriptionEn,
                        section.descriptionPt
                    ),
                    items: section.items
                        .filter((item) => item.name.trim().length > 0)
                        .map((item) => ({
                            name: item.name.trim(),
                            description: item.description.trim() || null,
                            nameI18n: buildI18nField(item.name, item.nameEn, item.namePt),
                            descriptionI18n: buildI18nField(
                                item.description,
                                item.descriptionEn,
                                item.descriptionPt
                            ),
                            priceCents: item.priceCents,
                            isAvailable: item.isAvailable,
                            photoUrl: item.photoUrl,
                            photoPublicId: item.photoPublicId,
                            photoAlt: item.photoAlt
                        }))
                }))
        };

        const result = await apiClient.put<MenuEnvelope>({ path: basePath, body: payload });
        setState('idle');

        if (result.ok) {
            setMessage(t('commerce.owner.editor.menuManager.saved', 'Carta guardada.'));
            return;
        }

        // A refusal here is the plan speaking, not a failure. `status` is the
        // only thing that separates "your plan does not include this" from a
        // genuine error, and showing the second for the first is how an upsell
        // turns into a bug report.
        //
        // THREE entitlements can now produce this 403 and they mean different
        // things, so the payload decides which upsell to show rather than the
        // response body: every refusal carries `ENTITLEMENT_REQUIRED`, and
        // reading the key out of the message would be parsing prose. Checked
        // in the SAME order `handlePutGastronomyMenu` checks them server-side
        // (photo gate, then translations gate, then the carta gate itself),
        // so a document carrying both an unentitled photo and an unentitled
        // translation is attributed to the photo on both sides.
        if (result.error.status === 403) {
            const carriedPhoto = payload.sections.some((section) =>
                section.items.some((item) => Boolean(item.photoUrl))
            );

            if (carriedPhoto) {
                setIsPhotoLocked(true);
                setMessage(
                    t(
                        'commerce.owner.editor.menuManager.photoLocked',
                        'Las fotos por plato están disponibles en el plan Premium. Podés quitar las fotos y guardar la carta igual.'
                    )
                );
                return;
            }

            const carriedTranslation = payload.sections.some(
                (section) =>
                    Boolean(section.nameI18n) ||
                    Boolean(section.descriptionI18n) ||
                    section.items.some(
                        (item) => Boolean(item.nameI18n) || Boolean(item.descriptionI18n)
                    )
            );

            if (carriedTranslation) {
                setIsTranslationLocked(true);
                setMessage(
                    t(
                        'commerce.owner.editor.menuManager.translationLocked',
                        'Traducir la carta está disponible en el plan Premium. Podés borrar las traducciones y guardar la carta en español.'
                    )
                );
                return;
            }

            setIsLocked(true);
            setMessage(
                t(
                    'commerce.owner.editor.menuManager.locked',
                    'Cargar la carta plato por plato está disponible desde el plan Profesional. Mientras tanto podés subir una foto o un PDF del menú, o dejar el enlace.'
                )
            );
            return;
        }

        setMessage(
            t('commerce.owner.editor.menuManager.saveError', 'No se pudo guardar la carta.')
        );
    }, [basePath, sections, t]);

    // ── The uploaded photo / PDF ────────────────────────────────────────────

    const uploadFile = useCallback(
        async (selected: File) => {
            setState('uploading');
            setMessage(null);

            // A raw `fetch` rather than `apiClient`: this is multipart, and the
            // API is a different origin, so the call needs `credentials:
            // 'include'` to travel with the session cookie — the same shape
            // `MediaSection` and `BrochureDownloadButton` use.
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

            if (!response?.ok) {
                setMessage(
                    t(
                        'commerce.owner.editor.menuManager.uploadError',
                        'No se pudo subir el archivo del menú.'
                    )
                );
                return;
            }

            const payload = (await response.json()) as { data?: { file?: MenuFile } };
            if (payload.data?.file) {
                setFile(payload.data.file);
                setMessage(
                    t('commerce.owner.editor.menuManager.uploaded', 'Archivo del menú subido.')
                );
            }
        },
        [basePath, t]
    );

    const deleteFile = useCallback(async () => {
        setState('saving');
        setMessage(null);

        const result = await apiClient.delete<{ success: boolean }>({ path: `${basePath}-file` });
        setState('idle');

        if (result.ok) {
            setFile(null);
            setMessage(
                t('commerce.owner.editor.menuManager.fileRemoved', 'Archivo del menú eliminado.')
            );
            return;
        }

        setMessage(
            t(
                'commerce.owner.editor.menuManager.deleteError',
                'No se pudo eliminar el archivo del menú.'
            )
        );
    }, [basePath, t]);

    const busy = state !== 'idle';

    /*
     * The scheme gate (HOS-592 / F-02), and it is NOT belt-and-braces here.
     *
     * `menu_file_url` is written by the upload route from what Cloudinary
     * returns — but that is not the ONLY way into the column. Measured against
     * the real schemas: `GastronomyOwnerCreateInputSchema`,
     * `GastronomyAdminCreateInputSchema` and `GastronomyUpdateInputSchema` are
     * all built with `.omit(...)` over `GastronomySchema`, so every field that
     * schema carries is accepted from the request body unless it is named in
     * the omit list. All three took `menuFileUrl: 'javascript:alert(1)'` and
     * kept it verbatim, because `z.string().url()` does not restrict the
     * scheme.
     *
     * The write side is narrowed too (those three now omit the column), but
     * this gate stays: it is the half that does not depend on nobody adding a
     * fourth write path, and it is what makes the value safe no matter how it
     * got into the row — including rows written before that narrowing.
     *
     * `undefined` means the link is DROPPED, never rendered with the raw value.
     */
    const safeFileHref = resolveSafeExternalUrl(file?.url);

    return (
        <section
            className={styles.panel}
            id="editor-menu"
        >
            <h2 className={styles.heading}>
                {t('commerce.owner.editor.menuManager.title', 'Carta')}
            </h2>
            <p className={styles.intro}>
                {t(
                    'commerce.owner.editor.menuManager.intro',
                    'Cargá tu carta plato por plato, o subí una foto o un PDF del menú. Podés usar las dos formas, y ninguna es obligatoria.'
                )}
            </p>

            {/* ── The uploaded photo / PDF ──────────────────────────────── */}
            <div className={styles.fileBlock}>
                <h3 className={styles.subheading}>
                    {t('commerce.owner.editor.menuManager.fileTitle', 'Foto o PDF del menú')}
                </h3>

                {file ? (
                    <div className={styles.fileRow}>
                        {/*
                         * No link when the scheme is not http(s) — and the
                         * Remove button below stays, deliberately. A row whose
                         * URL cannot be linked is exactly the row an owner most
                         * needs to be able to delete.
                         */}
                        {safeFileHref ? (
                            <a
                                className={styles.fileLink}
                                href={safeFileHref}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                {file.kind === 'pdf'
                                    ? t('commerce.owner.editor.menuManager.filePdf', 'Ver el PDF')
                                    : t(
                                          'commerce.owner.editor.menuManager.fileImage',
                                          'Ver la foto'
                                      )}
                            </a>
                        ) : (
                            <span className={styles.intro}>
                                {t(
                                    'commerce.owner.editor.menuManager.fileUnavailable',
                                    'No se puede abrir este archivo. Eliminalo y subilo de nuevo.'
                                )}
                            </span>
                        )}
                        <button
                            type="button"
                            className={styles.dangerButton}
                            disabled={busy}
                            onClick={() => {
                                void deleteFile();
                            }}
                        >
                            {t('commerce.owner.editor.menuManager.removeFile', 'Eliminar')}
                        </button>
                    </div>
                ) : null}

                <label className={styles.uploadLabel}>
                    <span>
                        {file
                            ? t(
                                  'commerce.owner.editor.menuManager.replaceFile',
                                  'Reemplazar el archivo'
                              )
                            : t('commerce.owner.editor.menuManager.addFile', 'Subir foto o PDF')}
                    </span>
                    <input
                        type="file"
                        accept={ACCEPTED_MENU_FILE_TYPES}
                        disabled={busy}
                        onChange={(event) => {
                            const selected = event.target.files?.[0];
                            // The input is cleared so choosing the SAME file
                            // again still fires `change`; without it a failed
                            // upload could not be retried.
                            event.target.value = '';
                            if (selected) {
                                void uploadFile(selected);
                            }
                        }}
                    />
                </label>
            </div>

            {/* ── The structured carta ──────────────────────────────────── */}
            <div className={styles.sectionsBlock}>
                <h3 className={styles.subheading}>
                    {t('commerce.owner.editor.menuManager.sectionsTitle', 'Platos por sección')}
                </h3>

                {sections.map((section, sectionIndex) => (
                    <fieldset
                        // Index-keyed on purpose: a draft row has no id, and the
                        // whole list is re-submitted as a document.
                        // biome-ignore lint/suspicious/noArrayIndexKey: draft rows carry no stable id by design
                        key={`section-${sectionIndex}`}
                        className={styles.sectionCard}
                    >
                        <legend className={styles.srOnly}>
                            {section.name ||
                                t('commerce.owner.editor.menuManager.newSection', 'Nueva sección')}
                        </legend>

                        <div className={styles.sectionHead}>
                            <input
                                className={styles.input}
                                type="text"
                                value={section.name}
                                placeholder={t(
                                    'commerce.owner.editor.menuManager.sectionNamePlaceholder',
                                    'Entradas, Principales, Postres…'
                                )}
                                aria-label={t(
                                    'commerce.owner.editor.menuManager.sectionName',
                                    'Nombre de la sección'
                                )}
                                onChange={(event) => {
                                    patchSection(sectionIndex, { name: event.target.value });
                                }}
                            />
                            <button
                                type="button"
                                className={styles.iconButton}
                                aria-label={t(
                                    'commerce.owner.editor.menuManager.moveSectionUp',
                                    'Subir la sección'
                                )}
                                onClick={() => {
                                    moveSection(sectionIndex, -1);
                                }}
                            >
                                ↑
                            </button>
                            <button
                                type="button"
                                className={styles.iconButton}
                                aria-label={t(
                                    'commerce.owner.editor.menuManager.moveSectionDown',
                                    'Bajar la sección'
                                )}
                                onClick={() => {
                                    moveSection(sectionIndex, 1);
                                }}
                            >
                                ↓
                            </button>
                            <button
                                type="button"
                                className={styles.dangerButton}
                                onClick={() => {
                                    removeSection(sectionIndex);
                                }}
                            >
                                {t('commerce.owner.editor.menuManager.removeSection', 'Quitar')}
                            </button>
                        </div>

                        {/*
                         * HOS-1043. Name-only: this editor has no field for a
                         * section's `description` at all (see the load/save
                         * mapping above), so there is nothing for
                         * `hasDescription` to translate here.
                         */}
                        <MenuTranslationFields
                            nameEn={section.nameEn}
                            namePt={section.namePt}
                            descriptionEn={section.descriptionEn}
                            descriptionPt={section.descriptionPt}
                            hasDescription={false}
                            locked={isTranslationLocked}
                            locale={locale}
                            onChange={(patch) => {
                                patchSection(sectionIndex, patch);
                            }}
                        />

                        {section.items.map((item, itemIndex) => (
                            <div
                                // biome-ignore lint/suspicious/noArrayIndexKey: draft rows carry no stable id by design
                                key={`item-${sectionIndex}-${itemIndex}`}
                                className={styles.itemRow}
                            >
                                <input
                                    className={styles.input}
                                    type="text"
                                    value={item.name}
                                    placeholder={t(
                                        'commerce.owner.editor.menuManager.itemNamePlaceholder',
                                        'Nombre del plato'
                                    )}
                                    aria-label={t(
                                        'commerce.owner.editor.menuManager.itemName',
                                        'Nombre del plato'
                                    )}
                                    onChange={(event) => {
                                        patchItem(sectionIndex, itemIndex, {
                                            name: event.target.value
                                        });
                                    }}
                                />
                                <input
                                    className={styles.input}
                                    type="text"
                                    value={item.description}
                                    placeholder={t(
                                        'commerce.owner.editor.menuManager.itemDescriptionPlaceholder',
                                        'Ingredientes, porción…'
                                    )}
                                    aria-label={t(
                                        'commerce.owner.editor.menuManager.itemDescription',
                                        'Descripción del plato'
                                    )}
                                    onChange={(event) => {
                                        patchItem(sectionIndex, itemIndex, {
                                            description: event.target.value
                                        });
                                    }}
                                />
                                <MenuTranslationFields
                                    nameEn={item.nameEn}
                                    namePt={item.namePt}
                                    descriptionEn={item.descriptionEn}
                                    descriptionPt={item.descriptionPt}
                                    hasDescription={true}
                                    locked={isTranslationLocked}
                                    locale={locale}
                                    onChange={(patch) => {
                                        patchItem(sectionIndex, itemIndex, patch);
                                    }}
                                />
                                {/*
                                 * The owner types PESOS; the state is CENTAVOS,
                                 * because that is what the column stores. Both
                                 * directions come from `@/lib/commerce/price-units`
                                 * — a display that divides without an input that
                                 * multiplies would multiply the price by 100 on
                                 * every save (HOS-809).
                                 */}
                                <input
                                    className={styles.priceInput}
                                    type="number"
                                    min={0}
                                    step={1}
                                    value={centsToPesosInputValue({ cents: item.priceCents })}
                                    placeholder={t(
                                        'commerce.owner.editor.menuManager.itemPricePlaceholder',
                                        'A consultar'
                                    )}
                                    aria-label={t(
                                        'commerce.owner.editor.menuManager.itemPrice',
                                        'Precio del plato'
                                    )}
                                    onChange={(event) => {
                                        patchItem(sectionIndex, itemIndex, {
                                            priceCents: parsePesosInputToCents({
                                                raw: event.target.value
                                            })
                                        });
                                    }}
                                />
                                <label className={styles.availableLabel}>
                                    <input
                                        type="checkbox"
                                        checked={item.isAvailable}
                                        onChange={(event) => {
                                            patchItem(sectionIndex, itemIndex, {
                                                isAvailable: event.target.checked
                                            });
                                        }}
                                    />
                                    {t(
                                        'commerce.owner.editor.menuManager.itemAvailable',
                                        'Disponible'
                                    )}
                                </label>
                                <button
                                    type="button"
                                    className={styles.dangerButton}
                                    onClick={() => {
                                        removeItem(sectionIndex, itemIndex);
                                    }}
                                >
                                    {t('commerce.owner.editor.menuManager.removeItem', 'Quitar')}
                                </button>

                                {/*
                                 * The photo (HOS-1045), on the dish's OWN row —
                                 * that placement is the issue, not a detail.
                                 * `safePhotoHref` is not needed for the preview
                                 * because the value came from our own upload
                                 * route in this same session; the PUBLIC page
                                 * sanitises it anyway, since a row can have been
                                 * written by something else.
                                 */}
                                <div className={styles.itemPhotoRow}>
                                    {item.photoUrl ? (
                                        <img
                                            className={styles.itemPhotoThumb}
                                            src={item.photoUrl}
                                            alt={
                                                item.photoAlt ||
                                                item.name ||
                                                t(
                                                    'commerce.owner.editor.menuManager.photoPreview',
                                                    'Foto del plato'
                                                )
                                            }
                                        />
                                    ) : null}

                                    <label className={styles.itemPhotoLabel}>
                                        <span>
                                            {item.photoUrl
                                                ? t(
                                                      'commerce.owner.editor.menuManager.replacePhoto',
                                                      'Cambiar la foto'
                                                  )
                                                : t(
                                                      'commerce.owner.editor.menuManager.addPhoto',
                                                      'Agregar foto'
                                                  )}
                                        </span>
                                        <input
                                            type="file"
                                            accept={ACCEPTED_ITEM_PHOTO_TYPES}
                                            disabled={busy || isPhotoLocked}
                                            onChange={(event) => {
                                                const selected = event.target.files?.[0];
                                                // Cleared so choosing the SAME
                                                // file again still fires
                                                // `change`; without it a failed
                                                // upload could not be retried.
                                                event.target.value = '';
                                                if (selected) {
                                                    void uploadItemPhoto(
                                                        sectionIndex,
                                                        itemIndex,
                                                        selected
                                                    );
                                                }
                                            }}
                                        />
                                    </label>

                                    {item.photoUrl ? (
                                        <>
                                            <input
                                                className={styles.input}
                                                type="text"
                                                value={item.photoAlt ?? ''}
                                                placeholder={t(
                                                    'commerce.owner.editor.menuManager.photoAltPlaceholder',
                                                    'Describí la foto (opcional)'
                                                )}
                                                aria-label={t(
                                                    'commerce.owner.editor.menuManager.photoAlt',
                                                    'Texto alternativo de la foto'
                                                )}
                                                onChange={(event) => {
                                                    patchItem(sectionIndex, itemIndex, {
                                                        photoAlt: event.target.value || null
                                                    });
                                                }}
                                            />
                                            {/*
                                             * Stays enabled while
                                             * `isPhotoLocked`: removing the
                                             * photo is the way OUT of that
                                             * state, so it is the one control
                                             * the lock must not take away.
                                             */}
                                            <button
                                                type="button"
                                                className={styles.dangerButton}
                                                onClick={() => {
                                                    removeItemPhoto(sectionIndex, itemIndex);
                                                }}
                                            >
                                                {t(
                                                    'commerce.owner.editor.menuManager.removePhoto',
                                                    'Quitar la foto'
                                                )}
                                            </button>
                                        </>
                                    ) : null}
                                </div>
                            </div>
                        ))}

                        <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={() => {
                                addItem(sectionIndex);
                            }}
                        >
                            {t('commerce.owner.editor.menuManager.addItem', 'Agregar plato')}
                        </button>
                    </fieldset>
                ))}

                <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={addSection}
                >
                    {t('commerce.owner.editor.menuManager.addSection', 'Agregar sección')}
                </button>

                {/*
                 * `type="button"`, like every control here: this panel lives
                 * INSIDE the editor's <form>, and a submit button would save the
                 * listing instead of the carta.
                 */}
                <button
                    type="button"
                    className={styles.primaryButton}
                    disabled={busy || isLocked}
                    onClick={() => {
                        void saveMenu();
                    }}
                >
                    {state === 'saving'
                        ? t('commerce.owner.editor.menuManager.saving', 'Guardando…')
                        : t('commerce.owner.editor.menuManager.save', 'Guardar carta')}
                </button>
            </div>

            {message ? (
                <p
                    className={styles.message}
                    role="status"
                >
                    {message}
                </p>
            ) : null}
        </section>
    );
}
